import type { Track } from '@/lib/api/catalog';
import { fetchStreamUrl, reportPlay, requiredPlayMs } from '@/lib/api/player';
import { ApiError } from '@/lib/api/queries';
import { type PlayerState, playerStore, selectCurrentTrack } from '@/stores/player.store';
import { nextPosition } from './queue';

/** Renew a stream token this long before it expires (tokens last 1 h). */
const TOKEN_MARGIN_MS = 60_000;
/** Media Session seek offset when the OS does not give one. */
export const SEEK_STEP_MS = 10_000;
/** Progress is mirrored into the store at this granularity. */
const PROGRESS_STEP_MS = 250;
/** A jump in `currentTime` larger than this between ticks is a seek, not listening. */
const MAX_TICK_S = 2;
const HISTORY_RETRY_MS = 5_000;

interface CachedUrl {
  url: string;
  expiresAt: number;
}

/** One play of one track: a new one starts every time `playbackKey` changes. */
interface PlaySession {
  key: number;
  track: Track;
  playId: string;
  listenedMs: number;
  lastTime: number | null;
  reported: boolean;
  /** Whether a source error was already retried with a fresh token. */
  retried: boolean;
}

const isFresh = (entry: CachedUrl | undefined, now = Date.now()): entry is CachedUrl =>
  entry !== undefined && entry.expiresAt - now > TOKEN_MARGIN_MS;

/**
 * Drives two `<audio>` elements from `player.store`: one plays, the other
 * preloads the next track and takes over when it starts. Stream URLs carry a
 * signed 1 h token, renewed before playing when it is close to expiring and
 * once more if the browser reports a source error (an expired token mid-track).
 */
class AudioEngine {
  private elements: HTMLAudioElement[] = [];
  private active = 0;
  private urls = new Map<string, CachedUrl>();
  private session: PlaySession | null = null;
  /** The playbackKey whose source is set on the active element. */
  private loadedKey: number | null = null;
  private preloaded: { trackId: string; element: number } | null = null;
  /** Where to start once metadata is available (resume after reload, retry). */
  private pendingSeekMs: number | null = null;
  /** Incremented per load, so a stale async load gives up. */
  private loadSeq = 0;
  private lastProgressMs = -1;
  private cleanups: (() => void)[] = [];

  private get audio(): HTMLAudioElement | undefined {
    return this.elements[this.active];
  }

  private get state(): PlayerState {
    return playerStore.getState();
  }

  /** Starts the engine once per page; returns the cleanup for the effect. */
  start(): () => void {
    if (this.cleanups.length > 0) {
      return () => this.stop();
    }
    this.elements = [new Audio(), new Audio()];
    for (const element of this.elements) {
      element.preload = 'auto';
      this.listen(element);
    }

    this.cleanups.push(playerStore.subscribe((state, prev) => this.onStateChange(state, prev)));
    this.registerMediaSession();
    void Promise.resolve(playerStore.persist.rehydrate()).then(() => {
      this.applyVolume(this.state);
      this.updateMetadata();
    });
    return () => this.stop();
  }

  private stop(): void {
    for (const cleanup of this.cleanups.splice(0)) {
      cleanup();
    }
    for (const element of this.elements) {
      element.pause();
      element.removeAttribute('src');
      element.load();
    }
    this.elements = [];
    this.session = null;
    this.loadedKey = null;
    this.preloaded = null;
  }

  // ---- Public controls (keyboard, Media Session and the seek bar) ----

  seek(ms: number): void {
    const duration = this.state.durationMs;
    const target = Math.max(0, duration > 0 ? Math.min(ms, duration - 250) : ms);
    const audio = this.audio;
    if (audio && this.loadedKey === this.state.playbackKey && audio.readyState > 0) {
      audio.currentTime = target / 1000;
    } else {
      // Not loaded yet (e.g. paused after a reload): start there on play.
      this.pendingSeekMs = target;
    }
    this.state.setProgress(target);
    this.updatePositionState();
  }

  seekBy(deltaMs: number): void {
    this.seek(this.state.currentTimeMs + deltaMs);
  }

  // ---- Store → audio ----

  private onStateChange(state: PlayerState, prev: PlayerState): void {
    if (state.volume !== prev.volume || state.muted !== prev.muted) {
      this.applyVolume(state);
    }
    if (state.playbackKey !== prev.playbackKey) {
      this.startSession();
      this.updateMetadata();
      if (state.isPlaying) {
        void this.load(0);
      } else {
        this.audio?.pause();
        this.loadedKey = null;
      }
      return;
    }
    // Shuffle, repeat or a reorder can change what plays next.
    if (
      state.order !== prev.order ||
      state.tracks !== prev.tracks ||
      state.repeat !== prev.repeat ||
      state.position !== prev.position
    ) {
      if (this.loadedKey === state.playbackKey) {
        void this.preloadNext();
      }
    }
    if (state.isPlaying !== prev.isPlaying) {
      if (state.isPlaying) {
        void this.resume();
      } else {
        this.audio?.pause();
      }
      this.setPlaybackState(state.isPlaying);
    }
  }

  private applyVolume({ volume, muted }: PlayerState): void {
    for (const element of this.elements) {
      element.volume = volume;
      element.muted = muted;
    }
  }

  private startSession(): void {
    const track = selectCurrentTrack(this.state);
    this.pendingSeekMs = null;
    this.lastProgressMs = -1;
    this.session = track
      ? {
          key: this.state.playbackKey,
          track,
          playId: crypto.randomUUID(),
          listenedMs: 0,
          lastTime: null,
          reported: false,
          retried: false,
        }
      : null;
  }

  private async resume(): Promise<void> {
    const audio = this.audio;
    const track = selectCurrentTrack(this.state);
    if (!audio || !track) {
      return;
    }
    const seekTo = this.pendingSeekMs ?? 0;
    if (this.session?.key !== this.state.playbackKey) {
      // First play after a reload: the persisted track has no session yet.
      this.startSession();
      this.updateMetadata();
    }
    const loaded = this.loadedKey === this.state.playbackKey;
    if (!loaded || !isFresh(this.urls.get(track.id))) {
      // Nothing loaded, or the token expired while paused: reload where we were.
      await this.load(loaded ? audio.currentTime * 1000 : seekTo);
      return;
    }
    this.playActive();
  }

  /** Points the active element at the current track (swapping in the preload if it matches). */
  private async load(startMs: number, forceFreshUrl = false): Promise<void> {
    const seq = ++this.loadSeq;
    const key = this.state.playbackKey;
    const track = selectCurrentTrack(this.state);
    if (!track || this.elements.length === 0) {
      return;
    }

    const preloaded = this.preloaded;
    if (
      !forceFreshUrl &&
      startMs === 0 &&
      preloaded?.trackId === track.id &&
      !this.elements[preloaded.element]?.error &&
      isFresh(this.urls.get(track.id))
    ) {
      this.swapTo(preloaded.element);
      this.loadedKey = key;
      this.state.setProgress(0, track.durationMs);
      this.playActive();
      return;
    }

    this.state.setBuffering(true);
    let url: string;
    try {
      url = await this.streamUrl(track.id, forceFreshUrl);
    } catch (error) {
      if (seq === this.loadSeq) {
        this.fail(error);
      }
      return;
    }
    const audio = this.audio;
    if (seq !== this.loadSeq || key !== this.state.playbackKey || !audio) {
      return;
    }
    this.discardPreload();
    this.pendingSeekMs = startMs > 0 ? startMs : null;
    audio.src = url;
    this.loadedKey = key;
    this.state.setProgress(startMs, track.durationMs);
    if (this.state.isPlaying) {
      this.playActive();
    }
  }

  private playActive(): void {
    this.audio?.play().catch((error: unknown) => {
      // A newer load interrupted this one; it plays by itself.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      // Autoplay blocked (no user gesture yet) or unsupported source.
      this.state.setPlaying(false);
    });
  }

  private async streamUrl(trackId: string, forceFresh = false): Promise<string> {
    const cached = this.urls.get(trackId);
    if (!forceFresh && isFresh(cached)) {
      return cached.url;
    }
    const { url, expiresAt } = await fetchStreamUrl(trackId);
    this.urls.set(trackId, { url, expiresAt: new Date(expiresAt).getTime() });
    return url;
  }

  private swapTo(index: number): void {
    const previous = this.audio;
    this.active = index;
    this.preloaded = null;
    if (previous && previous !== this.audio) {
      previous.pause();
      previous.removeAttribute('src');
      previous.load();
    }
  }

  private discardPreload(): void {
    const preloaded = this.preloaded;
    this.preloaded = null;
    const element = preloaded ? this.elements[preloaded.element] : undefined;
    if (element && element !== this.audio) {
      element.removeAttribute('src');
      element.load();
    }
  }

  /** Loads the track that will play when this one ends, so the change is gapless-ish. */
  private async preloadNext(): Promise<void> {
    const { position, order, repeat, tracks } = this.state;
    const nextPos = nextPosition(position, order.length, repeat, true);
    const next = nextPos === null || nextPos === position ? null : tracks[order[nextPos] ?? -1];
    if (!next || this.preloaded?.trackId === next.id) {
      return;
    }
    this.discardPreload();
    try {
      const url = await this.streamUrl(next.id);
      const index = 1 - this.active;
      const element = this.elements[index];
      if (!element) {
        return;
      }
      element.src = url;
      element.load();
      this.preloaded = { trackId: next.id, element: index };
    } catch {
      // Preloading is best effort; the track loads normally when it starts.
    }
  }

  private fail(error: unknown): void {
    const message =
      error instanceof ApiError && error.statusCode === 404
        ? 'This track is no longer available.'
        : 'This track could not be played.';
    this.state.setBuffering(false);
    this.state.setError(message);
    this.state.setPlaying(false);
  }

  // ---- Audio → store ----

  private listen(element: HTMLAudioElement): void {
    const on = <K extends keyof HTMLMediaElementEventMap>(type: K, handler: () => void) => {
      const guarded = () => {
        if (element === this.audio) {
          handler();
        }
      };
      element.addEventListener(type, guarded);
      this.cleanups.push(() => element.removeEventListener(type, guarded));
    };

    on('loadedmetadata', () => {
      if (this.pendingSeekMs !== null) {
        element.currentTime = this.pendingSeekMs / 1000;
        this.pendingSeekMs = null;
      }
      const durationMs = Number.isFinite(element.duration) ? element.duration * 1000 : undefined;
      this.state.setProgress(element.currentTime * 1000, durationMs);
      this.updatePositionState();
    });
    on('timeupdate', () => this.onTimeUpdate(element));
    on('seeking', () => {
      if (this.session) {
        this.session.lastTime = null;
      }
    });
    on('seeked', () => {
      if (this.session) {
        this.session.lastTime = element.currentTime;
      }
      this.updatePositionState();
    });
    on('waiting', () => this.state.setBuffering(true));
    on('playing', () => {
      this.state.setBuffering(false);
      this.state.setError(null);
      this.setPlaybackState(true);
      this.updatePositionState();
      void this.preloadNext();
    });
    on('play', () => {
      if (!this.state.isPlaying) {
        this.state.setPlaying(true);
      }
    });
    on('pause', () => {
      // Paused from outside the app (headphones unplugged, another tab took over…).
      if (!element.ended && this.state.isPlaying) {
        this.state.setPlaying(false);
      }
      this.setPlaybackState(false);
    });
    on('ended', () => {
      this.onTimeUpdate(element);
      this.state.next({ auto: true });
    });
    on('error', () => void this.onError(element));
  }

  private onTimeUpdate(element: HTMLAudioElement): void {
    const now = element.currentTime;
    const session = this.session;
    if (session && session.key === this.state.playbackKey) {
      if (session.lastTime !== null) {
        const delta = now - session.lastTime;
        if (delta > 0 && delta < MAX_TICK_S) {
          session.listenedMs += delta * 1000;
        }
      }
      session.lastTime = now;
      this.maybeReport(session);
    }

    const ms = now * 1000;
    if (Math.abs(ms - this.lastProgressMs) >= PROGRESS_STEP_MS) {
      this.lastProgressMs = ms;
      this.state.setProgress(ms);
    }
  }

  /** SPEC §6.4: once per play, after 30 s of actual listening (or the whole short track). */
  private maybeReport(session: PlaySession): void {
    if (session.reported || session.listenedMs < requiredPlayMs(session.track.durationMs)) {
      return;
    }
    session.reported = true;
    const body = {
      playId: session.playId,
      trackId: session.track.id,
      msPlayed: Math.round(session.listenedMs),
      context: this.state.source?.context ?? 'other',
    };
    const send = (retry: boolean) =>
      reportPlay(body).catch((error: unknown) => {
        // The playId makes a retry safe; client errors will not fix themselves.
        const transient = !(error instanceof ApiError) || error.statusCode >= 500;
        if (retry && transient) {
          setTimeout(() => void send(false), HISTORY_RETRY_MS);
        }
      });
    void send(true);
  }

  private async onError(element: HTMLAudioElement): Promise<void> {
    const session = this.session;
    if (!element.error || !session || this.loadedKey !== this.state.playbackKey) {
      return;
    }
    if (session.retried) {
      this.fail(element.error);
      return;
    }
    // Most likely the signed token expired mid-track: get a new one and resume there.
    session.retried = true;
    const resumeAt = element.currentTime * 1000;
    this.urls.delete(session.track.id);
    await this.load(resumeAt, true);
  }

  // ---- Media Session (OS media controls) ----

  private registerMediaSession(): void {
    if (!('mediaSession' in navigator)) {
      return;
    }
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => this.state.setPlaying(true)],
      ['pause', () => this.state.setPlaying(false)],
      ['stop', () => this.state.setPlaying(false)],
      ['previoustrack', () => this.state.previous()],
      ['nexttrack', () => this.state.next()],
      [
        'seekbackward',
        (details) => this.seekBy(-(details.seekOffset ? details.seekOffset * 1000 : SEEK_STEP_MS)),
      ],
      [
        'seekforward',
        (details) => this.seekBy(details.seekOffset ? details.seekOffset * 1000 : SEEK_STEP_MS),
      ],
      [
        'seekto',
        (details) => {
          if (details.seekTime !== undefined) {
            this.seek(details.seekTime * 1000);
          }
        },
      ],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
        this.cleanups.push(() => navigator.mediaSession.setActionHandler(action, null));
      } catch {
        // The browser does not support this action.
      }
    }
  }

  private updateMetadata(): void {
    if (!('mediaSession' in navigator)) {
      return;
    }
    const track = selectCurrentTrack(this.state);
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const cover = track.album.cover;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      artwork: cover
        ? [
            { src: cover.sm, sizes: '64x64', type: 'image/webp' },
            { src: cover.md, sizes: '300x300', type: 'image/webp' },
            { src: cover.lg, sizes: '640x640', type: 'image/webp' },
          ]
        : [],
    });
  }

  private setPlaybackState(playing: boolean): void {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }

  private updatePositionState(): void {
    const audio = this.audio;
    if (!('mediaSession' in navigator) || !audio || !Number.isFinite(audio.duration)) {
      return;
    }
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        position: Math.min(audio.currentTime, audio.duration),
        playbackRate: audio.playbackRate || 1,
      });
    } catch {
      // Invalid while the duration is still unknown.
    }
  }
}

export const audioEngine = new AudioEngine();

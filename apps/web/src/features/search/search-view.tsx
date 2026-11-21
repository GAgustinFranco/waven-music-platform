'use client';

import { useQuery } from '@tanstack/react-query';
import { Search, SearchX } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from 'cn';
import { MediaCard, MediaGrid, MediaGridSkeleton } from '@/components/catalog/media-card';
import { Section } from '@/components/catalog/section';
import { EmptyState, ErrorState, LoadingStatus } from '@/components/catalog/states';
import { TrackList, TrackListSkeleton, TrackRow } from '@/components/catalog/track-row';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { useLikedSet } from '@/features/library/use-liked';
import type { Track } from '@/lib/api/catalog';
import {
  isSearchType,
  MAX_QUERY_LENGTH,
  normalizeQuery,
  searchHref,
  searchQuery,
  type SearchResults,
  type SearchType,
} from '@/lib/api/search';
import { pluralize, releaseYear } from '@/lib/format';
import { usePlayerStore } from '@/stores/player.store';
import { SEARCH_SOURCE } from './source';
import { TopResultCard } from './top-result-card';

/** Long enough to skip most keystrokes, short enough to feel instant. */
const DEBOUNCE_MS = 250;
/** Songs next to the top result on "All". */
const ALL_TRACKS = 4;

const TYPE_LABELS: Record<SearchType, string> = {
  all: 'All',
  track: 'Songs',
  album: 'Albums',
  artist: 'Artists',
};

/**
 * Search as you type (US-10). The URL (`?q=&type=`) is the source of truth, so
 * results survive reloads and can be shared; the input writes to it debounced,
 * with `replace` so typing does not fill the back stack.
 */
export function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const typeParam = params.get('type');
  const type: SearchType = isSearchType(typeParam) ? typeParam : 'all';
  const q = normalizeQuery(urlQuery);

  const [input, setInput] = useState(urlQuery);
  /** The query this view last wrote to the URL, to tell its own updates from navigation. */
  const written = useRef(q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputId = useId();

  // Back/forward or a link changed the URL: show that query instead.
  useEffect(() => {
    if (q !== written.current) {
      clearTimeout(timer.current);
      written.current = q;
      setInput(q);
    }
  }, [q]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const write = (value: string, nextType: SearchType) => {
    clearTimeout(timer.current);
    written.current = normalizeQuery(value);
    router.replace(searchHref(value, nextType), { scroll: false });
  };

  const ready = useSessionReady();
  const query = useQuery({ ...searchQuery(q, type), enabled: ready && q !== '' });
  const data = q === '' ? undefined : query.data;

  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-8 pt-20">
      <h1 className="sr-only">Search</h1>
      <div className="flex flex-col gap-4">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            write(input, type);
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            What do you want to listen to?
          </label>
          <div className="relative max-w-xl">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
            />
            <input
              id={inputId}
              type="search"
              value={input}
              maxLength={MAX_QUERY_LENGTH}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="What do you want to listen to?"
              onChange={(event) => {
                const value = event.target.value;
                setInput(value);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => write(value, type), DEBOUNCE_MS);
              }}
              className="bg-surface-2 border-input text-foreground placeholder:text-muted-foreground h-12 w-full rounded-full border pr-4 pl-12 text-base"
            />
          </div>
        </form>

        <div role="group" aria-label="Filter results" className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABELS) as SearchType[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === type}
              onClick={() => write(input, option)}
              className={cn(
                'ease-standard rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                option === type
                  ? 'bg-foreground text-background'
                  : 'bg-surface-2 text-foreground hover:bg-elevated',
              )}
            >
              {TYPE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {q === '' ? (
        <EmptyState
          icon={Search}
          title="Search Waven"
          description="Find tracks, albums and artists. Accents and small typos are fine."
        />
      ) : query.isError && !data ? (
        <ErrorState onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      ) : !data ? (
        <>
          <LoadingStatus label={`Searching for ${q}`} />
          <ResultsSkeleton type={type} />
        </>
      ) : (
        <div
          aria-busy={query.isPlaceholderData || undefined}
          className={cn(
            'ease-standard transition-opacity duration-150',
            query.isPlaceholderData && 'opacity-75',
          )}
        >
          <Results results={data} q={q} type={type} settled={!query.isPlaceholderData} />
        </div>
      )}
    </div>
  );
}

function Results({
  results,
  q,
  type,
  settled,
}: {
  results: SearchResults;
  q: string;
  type: SearchType;
  settled: boolean;
}) {
  const playQueue = usePlayerStore((state) => state.playQueue);
  const { tracks, albums, artists, topResult } = results;
  const shownTracks = type === 'all' ? tracks.slice(0, ALL_TRACKS) : tracks;
  const liked = useLikedSet(shownTracks.map((track) => track.id));
  const count = tracks.length + albums.length + artists.length;
  const topTrack = topResult?.type === 'track' ? tracks.find((t) => t.id === topResult.id) : null;
  // Playing the top song queues the other results after it.
  const topQueue = useMemo<Track[]>(
    () => (topTrack ? [topTrack, ...tracks.filter((t) => t.id !== topTrack.id)] : []),
    [topTrack, tracks],
  );

  const announcement = settled ? (
    <p role="status" className="sr-only">
      {count === 0 ? `No results for ${q}` : `${pluralize(count, 'result')} for ${q}`}
    </p>
  ) : null;

  if (count === 0) {
    return (
      <>
        {announcement}
        <EmptyState
          icon={SearchX}
          title={`No results found for “${q}”`}
          description="Check the spelling, or try fewer or different keywords."
        />
      </>
    );
  }

  const songs =
    shownTracks.length > 0 ? (
      <Section id="search-songs" title="Songs">
        <TrackList label="Songs">
          {shownTracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              position={index + 1}
              showCover
              showAlbum={type !== 'all'}
              onPlay={() => playQueue(tracks, index, SEARCH_SOURCE)}
              liked={liked?.has(track.id)}
            />
          ))}
        </TrackList>
      </Section>
    ) : null;

  return (
    <div className="flex flex-col gap-10">
      {announcement}
      {type === 'all' && topResult ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Section id="search-top" title="Top result">
            <TopResultCard top={topResult} results={results} queue={topQueue} />
          </Section>
          {songs}
        </div>
      ) : (
        songs
      )}

      {artists.length > 0 ? (
        <Section id="search-artists" title="Artists">
          <MediaGrid label="Artists">
            {artists.map((artist) => (
              <li key={artist.id}>
                <MediaCard
                  href={`/artists/${artist.id}`}
                  title={artist.name}
                  subtitle="Artist"
                  image={artist.image}
                  shape="round"
                />
              </li>
            ))}
          </MediaGrid>
        </Section>
      ) : null}

      {albums.length > 0 ? (
        <Section id="search-albums" title="Albums">
          <MediaGrid label="Albums">
            {albums.map((album) => (
              <li key={album.id}>
                <MediaCard
                  href={`/albums/${album.id}`}
                  title={album.title}
                  subtitle={[releaseYear(album.releaseDate), album.artist.name]
                    .filter(Boolean)
                    .join(' · ')}
                  image={album.cover}
                />
              </li>
            ))}
          </MediaGrid>
        </Section>
      ) : null}
    </div>
  );
}

function ResultsSkeleton({ type }: { type: SearchType }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-10">
      {type === 'all' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Skeleton className="h-56 w-full rounded-md" />
          <TrackListSkeleton count={ALL_TRACKS} />
        </div>
      ) : type === 'track' ? (
        <TrackListSkeleton count={8} />
      ) : null}
      {type !== 'track' ? (
        <MediaGridSkeleton shape={type === 'artist' ? 'round' : 'square'} />
      ) : null}
    </div>
  );
}

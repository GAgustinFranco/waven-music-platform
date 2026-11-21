export type PlayerShortcut =
  | 'toggle-play'
  | 'seek-back'
  | 'seek-forward'
  | 'previous'
  | 'next'
  | 'toggle-mute'
  | 'toggle-shuffle'
  | 'cycle-repeat';

/** ←/→ seek step. */
export const KEYBOARD_SEEK_MS = 5_000;

interface KeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  repeat: boolean;
}

/** What the focused element is, so shortcuts never steal keys it needs. */
export type FocusKind = 'text' | 'slider' | 'control' | 'other';

export function focusKind(element: Element | null): FocusKind {
  if (!element) {
    return 'other';
  }
  if (
    element instanceof HTMLElement &&
    (element.isContentEditable ||
      element.tagName === 'TEXTAREA' ||
      element.tagName === 'SELECT' ||
      (element.tagName === 'INPUT' &&
        !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(
          (element as HTMLInputElement).type,
        )))
  ) {
    return 'text';
  }
  const role = element.getAttribute('role');
  if (role === 'slider' || (element as HTMLInputElement).type === 'range') {
    return 'slider';
  }
  if (
    ['BUTTON', 'A', 'SUMMARY', 'INPUT'].includes(element.tagName) ||
    ['button', 'link', 'menuitem', 'option', 'tab', 'checkbox', 'switch'].includes(role ?? '')
  ) {
    return 'control';
  }
  return 'other';
}

/**
 * Space, ←/→ (seek), Shift+←/→ (previous/next), M, S and R. Text fields keep
 * every key; sliders keep the arrows; buttons and links keep Space.
 */
export function shortcutFor(event: KeyLike, focus: FocusKind): PlayerShortcut | null {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (focus === 'text') {
    return null;
  }
  switch (event.key) {
    case ' ':
      return focus === 'control' || event.repeat ? null : 'toggle-play';
    case 'ArrowLeft':
      return focus === 'slider' ? null : event.shiftKey ? 'previous' : 'seek-back';
    case 'ArrowRight':
      return focus === 'slider' ? null : event.shiftKey ? 'next' : 'seek-forward';
  }
  if (event.shiftKey || event.repeat) {
    return null;
  }
  switch (event.key.toLowerCase()) {
    case 'm':
      return 'toggle-mute';
    case 's':
      return 'toggle-shuffle';
    case 'r':
      return 'cycle-repeat';
    default:
      return null;
  }
}

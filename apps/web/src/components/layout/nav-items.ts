import { Gem, House, Library, Search, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: '/' | '/search' | '/library' | '/premium';
  label: string;
  icon: LucideIcon;
}

/** Primary navigation, shared by the sidebar and the mobile bottom navigation. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Home', icon: House },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/premium', label: 'Premium', icon: Gem },
];

/** Playlists, Liked Songs and the listening history belong to the library. */
const LIBRARY_PAGES = ['/playlists/', '/favorites', '/history'];

export const isActive = (pathname: string, href: NavItem['href']) =>
  href === '/'
    ? pathname === '/'
    : pathname === href ||
      pathname.startsWith(`${href}/`) ||
      (href === '/library' && LIBRARY_PAGES.some((page) => pathname.startsWith(page)));

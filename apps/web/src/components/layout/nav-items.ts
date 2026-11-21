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

export const isActive = (pathname: string, href: NavItem['href']) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

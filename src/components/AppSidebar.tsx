import { BrandMark } from '@/components/BrandMark';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Shield, PanelLeftClose, PanelLeft, Brain, Network, Route, Settings, Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ADMIN_EMAILS } from '@/lib/admin-emails';
import { Button } from '@/components/ui/button';

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}
export const SidebarContext = createContext<SidebarContextType>({
  collapsed: false, setCollapsed: () => {}, mobileOpen: false, setMobileOpen: () => {},
});
export const useSidebarCollapsed = () => useContext(SidebarContext);

const ROOMS = [
  { to: '/practice', label: 'Practice', icon: Brain, match: ['/practice', '/questions', '/assess', '/flashcards', '/osce-in-surgery', '/stations'] },
  { to: '/intelligence', label: 'Performance Intelligence', icon: Network, match: ['/intelligence', '/profile', '/behavior'] },
  { to: '/plan', label: 'Study Plan', icon: Route, match: ['/plan'] },
];

export function AppSidebar({ isMobile }: { isMobile?: boolean }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = ADMIN_EMAILS.includes(user?.email || '');
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebarCollapsed();
  const effectiveCollapsed = isMobile ? false : collapsed;
  const close = () => { if (isMobile) setMobileOpen(false); };
  const training = ['/practice', '/practice/osce', '/plan'].includes(location.pathname);
  const mobileNavRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!training || !isMobile || !mobileOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const nav = mobileNavRef.current;
    if (!nav) return;
    const focusable = () => Array.from(nav.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== 'Tab') return;
      const items = focusable(); const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [training, isMobile, mobileOpen, setMobileOpen]);

  const inner = (
    <>
      <NavLink to="/" onClick={close} className={cn('flex items-center gap-2 py-5', effectiveCollapsed ? 'justify-center px-2' : 'px-6')}>
        <BrandMark />
        {!effectiveCollapsed && <span className="text-lg font-bold font-display tracking-tight">Zyntra</span>}
      </NavLink>
      <nav className={cn('flex flex-1 flex-col justify-center space-y-1 py-2', effectiveCollapsed ? 'px-1.5' : 'px-3')}>
        {ROOMS.map((room) => {
          const active = room.match.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));
          return (
            <NavLink key={room.to} title={effectiveCollapsed ? room.label : undefined} aria-label={room.label} to={room.to} onClick={close} className={cn('flex items-center rounded-lg text-sm font-medium transition-colors', effectiveCollapsed ? 'justify-center py-3' : 'px-3 py-2.5', active ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent')}>{effectiveCollapsed ? <room.icon className="h-4 w-4" aria-hidden="true" /> : room.label}</NavLink>
          );
        })}
      </nav>
      <div className={cn('border-t border-sidebar-border py-3', effectiveCollapsed ? 'px-1.5' : 'px-3')}>
        <NavLink to="/inbox" onClick={close} title={effectiveCollapsed ? 'Notifications' : undefined} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
          <Bell className="h-4 w-4" />{!effectiveCollapsed && 'Notifications'}
        </NavLink>
        <NavLink to="/settings" onClick={close} title={effectiveCollapsed ? 'Settings' : undefined} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
          <Settings className="h-4 w-4" />{!effectiveCollapsed && 'Settings'}
        </NavLink>
        {isAdmin && <NavLink to="/admin" onClick={close} title={effectiveCollapsed ? 'Admin' : undefined} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"><Shield className="h-4 w-4" />{!effectiveCollapsed && 'Admin'}</NavLink>}
        <Button variant="ghost"
          type="button"
          onClick={async () => { close(); await signOut(); navigate('/'); }}
          title={effectiveCollapsed ? 'Log out' : undefined}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />{!effectiveCollapsed && 'Log out'}
        </Button>
        {!isMobile && (
          <Button variant="ghost" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/70">
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </Button>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <TooltipProvider>
        {mobileOpen && <div className={cn('fixed inset-0 z-40', training ? 'bg-background/80' : 'bg-black/60')} onClick={() => setMobileOpen(false)} />}
        <aside ref={mobileNavRef} role={training && mobileOpen ? 'dialog' : undefined} aria-modal={training && mobileOpen ? true : undefined} aria-label="Navigation" inert={training && !mobileOpen ? '' : undefined} className={cn('fixed left-0 top-0 z-50 flex h-dvh w-72 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
          {training && mobileOpen && <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 min-h-11 min-w-11"><PanelLeftClose /></Button>}
          {inner}
        </aside>
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider>
      <aside className={cn('fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all', effectiveCollapsed ? 'w-16' : 'w-64')}>{inner}</aside>
    </TooltipProvider>
  );
}

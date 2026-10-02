import { NavLink, useLocation } from 'react-router-dom';
import { Zap, Shield, PanelLeftClose, PanelLeft, Brain, Network, Route, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createContext, useContext, useState } from 'react';
import { ADMIN_EMAILS } from '@/lib/admin-emails';

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
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = ADMIN_EMAILS.includes(user?.email || '');
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebarCollapsed();
  const effectiveCollapsed = isMobile ? false : collapsed;
  const close = () => { if (isMobile) setMobileOpen(false); };

  const inner = (
    <>
      <NavLink to="/" onClick={close} className={cn('flex items-center gap-2 py-5', effectiveCollapsed ? 'justify-center px-2' : 'px-6')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary"><Zap className="h-4 w-4 text-primary-foreground" /></div>
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
        {<NavLink to="/settings" onClick={close} title={effectiveCollapsed ? 'Settings' : undefined} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"><Settings className="h-4 w-4" />{!effectiveCollapsed && 'Settings'}</NavLink>}
        {isAdmin && <NavLink to="/admin" onClick={close} title={effectiveCollapsed ? 'Admin' : undefined} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"><Shield className="h-4 w-4" />{!effectiveCollapsed && 'Admin'}</NavLink>}
        {!isMobile && (
          <button onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/50">
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </button>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <TooltipProvider>
        {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} />}
        <aside className={cn('fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>{inner}</aside>
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider>
      <aside className={cn('fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all', effectiveCollapsed ? 'w-16' : 'w-64')}>{inner}</aside>
    </TooltipProvider>
  );
}

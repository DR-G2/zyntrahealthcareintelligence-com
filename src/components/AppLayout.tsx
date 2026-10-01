import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppSidebar, SidebarContext, useSidebarCollapsed } from '@/components/AppSidebar';
import { SecurityOverlay } from '@/components/SecurityOverlay';
import { cn } from '@/lib/utils';
import { LegalFooter } from '@/components/LegalFooter';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { Menu, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps { children: ReactNode; }

function AccountMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const name = user?.email?.split('@')[0] || 'Account';
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-accent" aria-expanded={open} aria-haspopup="menu">{name} ▾</button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-52 rounded-lg border border-border bg-card p-1 shadow-md">
          <Link to="/settings" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-accent" role="menuitem">Account</Link>
          <Link to="/settings" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-accent" role="menuitem">Settings</Link>
          <Link to="/inbox" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-accent" role="menuitem">Notifications / Inbox</Link>
          <button onClick={() => { setOpen(false); signOut(); }} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent" role="menuitem">Sign out</button>
        </div>
      )}
    </div>
  );
}

function RoomTabs() {
  const { pathname } = useLocation();
  const inPractice = ['/practice', '/questions', '/assess', '/flashcards', '/osce-in-surgery', '/stations'].some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!inPractice) return null;
  const tab = (to: string, label: string, on: boolean) => (
    <Link to={to} className={cn('rounded-md px-3 py-1.5 text-sm', on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>{label}</Link>
  );
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tab('/practice', 'MCQ', pathname.startsWith('/practice') || pathname.startsWith('/questions') || pathname.startsWith('/assess'))}
      {tab('/osce-in-surgery', 'Surgery · not live', pathname.startsWith('/osce-in-surgery') || pathname.startsWith('/stations'))}
      {tab('/flashcards', 'Flashcards', pathname.startsWith('/flashcards'))}
    </div>
  );
}

function LayoutInner({ children }: AppLayoutProps) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebarCollapsed();
  const isMobile = useIsMobile();
  return (
    <div className="flex min-h-screen">
      <AppSidebar isMobile={isMobile} />
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="flex h-9 w-9 items-center justify-center rounded-lg" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary"><Zap className="h-3.5 w-3.5 text-primary-foreground" /></div></div>
          <AccountMenu />
        </header>
      )}
      <main className={cn('flex-1 flex flex-col min-h-screen', isMobile ? 'ml-0 pt-14 p-4' : collapsed ? 'ml-16 p-6' : 'ml-64 p-6')}>
        {!isMobile && <div className="mb-2 flex justify-end"><AccountMenu /></div>}
        <RoomTabs />
        <div className="flex-1">{children}</div>
        <LegalFooter />
      </main>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const initialSet = useRef(false);
  useEffect(() => {
    if (initialSet.current) return;
    initialSet.current = true;
    if (isTablet) setCollapsed(true);
  }, [isTablet, isMobile]);
  return (
    <SecurityOverlay>
      <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
        <LayoutInner>{children}</LayoutInner>
      </SidebarContext.Provider>
    </SecurityOverlay>
  );
}

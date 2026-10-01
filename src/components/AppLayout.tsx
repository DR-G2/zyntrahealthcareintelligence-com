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
      <button onClick={() => setOpen(v => !v)} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-accent" aria-expanded={open}>{name} ▾</button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-md">
          <Link to="/settings" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-accent">Account</Link>
          <Link to="/settings" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 pl-6 text-sm text-muted-foreground hover:bg-accent">Settings</Link>
          <div className="my-1 border-t border-border" />
          <Link to="/inbox" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-accent">Notifications</Link>
          <Link to="/inbox" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 pl-6 text-sm text-muted-foreground hover:bg-accent">Inbox</Link>
          <div className="my-1 border-t border-border" />
          <button onClick={() => { setOpen(false); signOut(); }} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent">Sign out</button>
        </div>
      )}
    </div>
  );
}

function RoomTabs() {
  const { pathname } = useLocation();
  const item = (to: string, label: string, on: boolean) => (
    <Link to={to} className={cn('flex-1 rounded-md px-3 py-2 text-center text-sm font-medium', on ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>{label}</Link>
  );
  const inPractice = ['/practice', '/questions', '/assess', '/flashcards'].some(p => pathname === p || pathname.startsWith(p + '/'));
  const inPlan = pathname === '/plan';
  if (!inPractice && !inPlan) return null;
  if (inPlan) {
    const generate = location.search.includes('tab=generate');
    return <div className="mb-4 grid grid-cols-2 rounded-lg bg-muted p-1">{item('/plan', 'Current', !generate)}{item('/plan?tab=generate', 'Generate New', generate)}</div>;
  }
  return (
    <div className="mb-4 grid grid-cols-3 rounded-lg bg-muted p-1">
      {item('/practice', 'MCQ', pathname === '/practice' || pathname.startsWith('/questions') || pathname.startsWith('/assess'))}
      {item('/practice/osce', 'OSCE', pathname.startsWith('/practice/osce'))}
      {item('/flashcards', 'Flashcards', pathname.startsWith('/flashcards'))}
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
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary"><Zap className="h-3.5 w-3.5 text-primary-foreground" /></div>
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
  const isTablet = useIsTablet();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const initialSet = useRef(false);
  useEffect(() => { if (!initialSet.current && isTablet) { initialSet.current = true; setCollapsed(true); } }, [isTablet]);
  return (
    <SecurityOverlay>
      <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
        <LayoutInner>{children}</LayoutInner>
      </SidebarContext.Provider>
    </SecurityOverlay>
  );
}

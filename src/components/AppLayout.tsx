import { ReactNode, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppSidebar, SidebarContext, useSidebarCollapsed } from '@/components/AppSidebar';
import { SecurityOverlay } from '@/components/SecurityOverlay';
import { cn } from '@/lib/utils';
import { LegalFooter } from '@/components/LegalFooter';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { Menu, Zap, Settings, LogOut } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps { children: ReactNode; }

function AccountBar() {
  const { user, signOut } = useAuth();
  const name = user?.email?.split('@')[0] || 'Account';
  return (
    <div className="mb-4 flex items-center justify-end gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">{name}</span>
      <NotificationBell collapsed={false} />
      <Link to="/inbox" className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-accent" aria-label="Inbox">Inbox</Link>
      <Link to="/settings" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-accent"><Settings className="h-4 w-4" /> Settings</Link>
      <button onClick={() => signOut()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground hover:bg-accent"><LogOut className="h-4 w-4" /> Sign out</button>
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
        <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="flex h-9 w-9 items-center justify-center rounded-lg" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary"><Zap className="h-3.5 w-3.5 text-primary-foreground" /></div><span className="font-bold font-display">Zyntra</span></div>
        </header>
      )}
      <main className={cn('flex-1 flex flex-col min-h-screen', isMobile ? 'ml-0 pt-14 p-4' : collapsed ? 'ml-16 p-6' : 'ml-64 p-6')}>
        <AccountBar />
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

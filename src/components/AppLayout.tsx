import { ReactNode, useState, useEffect } from 'react';
import { AppSidebar, SidebarContext, useSidebarCollapsed } from '@/components/AppSidebar';
import { SecurityOverlay } from '@/components/SecurityOverlay';
import { cn } from '@/lib/utils';
import { LegalFooter } from '@/components/LegalFooter';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { Menu, Zap } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

function LayoutInner({ children }: AppLayoutProps) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebarCollapsed();
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen">
      <AppSidebar isMobile={isMobile} />

      {/* Mobile header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-accent transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-base font-bold font-display tracking-tight">Zyntra</span>
          </div>
        </header>
      )}

      <main className={cn(
        'flex-1 flex flex-col min-h-screen transition-all duration-300',
        isMobile ? 'ml-0 pt-14 p-4' : collapsed ? 'ml-16 p-6 lg:p-8' : 'ml-64 p-6 lg:p-8'
      )}>
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

  // Default collapsed on tablet
  useEffect(() => {
    if (isTablet) setCollapsed(true);
    else if (!isMobile) setCollapsed(false);
  }, [isTablet, isMobile]);

  return (
    <SecurityOverlay>
      <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
        <LayoutInner>{children}</LayoutInner>
      </SidebarContext.Provider>
    </SecurityOverlay>
  );
}

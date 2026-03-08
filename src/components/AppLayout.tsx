import { ReactNode, useState } from 'react';
import { AppSidebar, SidebarContext, useSidebarCollapsed } from '@/components/AppSidebar';
import { SecurityOverlay } from '@/components/SecurityOverlay';
import { cn } from '@/lib/utils';
import { LegalFooter } from '@/components/LegalFooter';

interface AppLayoutProps {
  children: ReactNode;
}

function LayoutInner({ children }: AppLayoutProps) {
  const { collapsed } = useSidebarCollapsed();
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className={cn('flex-1 flex flex-col min-h-screen p-6 lg:p-8 transition-all duration-300', collapsed ? 'ml-16' : 'ml-64')}>
        <div className="flex-1">{children}</div>
        <LegalFooter />
      </main>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SecurityOverlay>
      <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
        <LayoutInner>{children}</LayoutInner>
      </SidebarContext.Provider>
    </SecurityOverlay>
  );
}

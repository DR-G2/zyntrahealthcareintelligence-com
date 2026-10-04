import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, UserCircle, Zap } from 'lucide-react';
import { AppSidebar, SidebarContext, useSidebarCollapsed } from '@/components/AppSidebar';
import { SecurityOverlay } from '@/components/SecurityOverlay';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { LegalFooter } from '@/components/LegalFooter';

export interface AppLayoutProps {
  children: ReactNode;
}

function RoomTabs() {
  const { pathname, search } = useLocation();
  const item = (to: string, label: string, active: boolean) => (
    <Link
      to={to}
      className={cn(
        'relative rounded-xl border border-transparent px-4 py-2.5 text-center text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80',
        active
          ? 'border-cyan-400/35 bg-cyan-400/12 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
          : 'text-slate-200 hover:border-white/15 hover:bg-white/[0.07] hover:text-white'
      )}
    >
      {active && <span className="absolute inset-x-5 -bottom-px h-px bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />}
      {label}
    </Link>
  );

  const practice = ['/practice', '/questions', '/assess', '/flashcards'].some(
    p => pathname === p || pathname.startsWith(p + '/')
  ) || pathname.startsWith('/practice/ai-lab');
  if (pathname === '/plan') {
    const generate = search.includes('tab=generate');
    return (
      <div className="mx-auto mb-6 grid w-full max-w-sm grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.025] p-1.5">
        {item('/plan', 'Current', !generate)}
        {item('/plan?tab=generate', 'Generate New', generate)}
      </div>
    );
  }
  if (!practice) return null;
  return (
    <div className="mx-auto mb-6 grid w-full max-w-4xl grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[0.025] p-1.5 sm:grid-cols-4">
      {item('/practice', 'MCQ', pathname === '/practice' || pathname.startsWith('/questions') || pathname.startsWith('/assess'))}
      {item('/practice/osce', 'OSCE', pathname.startsWith('/practice/osce'))}
      {item('/flashcards', 'Flashcards', pathname.startsWith('/flashcards'))}
      {item('/practice/ai-lab', 'AI Lab', pathname.startsWith('/practice/ai-lab'))}
    </div>
  );
}

function TopHeader() {
  return (
    <header className="mb-6 flex min-h-10 items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-slate-500">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        Session active
      </div>
      <Link
        to="/settings"
        aria-label="Open account settings"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-cyan-400/30 hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
      >
        <UserCircle className="h-4 w-4 text-cyan-300" />
        <span>Account</span>
      </Link>
    </header>
  );
}

function LayoutInner({ children }: AppLayoutProps) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebarCollapsed();
  const isMobile = useIsMobile();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040812] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[32rem] w-[32rem] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-[-10rem] top-[20%] h-[34rem] w-[34rem] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <AppSidebar isMobile={isMobile} />

      {isMobile && (
        <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[#040812]/85 px-4 backdrop-blur-xl">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Open navigation"
            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" aria-label="Zyntra home" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-300">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">Zyntra</span>
          </Link>
          <Link to="/settings" aria-label="Open account settings" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50">
            <UserCircle className="h-5 w-5" />
          </Link>
        </header>
      )}

      <main
        className={cn(
          'relative z-10 min-h-screen min-w-0 transition-[margin] duration-300',
          isMobile ? 'ml-0 px-4 pb-10 pt-20' : collapsed ? 'ml-16 px-6 pb-10 pt-6' : 'ml-64 px-8 pb-10 pt-6'
        )}
      >
        <div className="mx-auto w-full max-w-7xl min-w-0">
          {!isMobile && <TopHeader />}
          <RoomTabs />
          <div className="min-w-0">{children}</div>
          <LegalFooter />
        </div>
      </main>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const isTablet = useIsTablet();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const initialSet = useRef(false);

  useEffect(() => {
    if (!initialSet.current && isTablet) {
      initialSet.current = true;
      setCollapsed(true);
    }
  }, [isTablet]);

  return (
    <SecurityOverlay>
      <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
        <LayoutInner>{children}</LayoutInner>
      </SidebarContext.Provider>
    </SecurityOverlay>
  );
}

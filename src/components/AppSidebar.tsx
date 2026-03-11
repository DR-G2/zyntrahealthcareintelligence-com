import { NavLink, useLocation } from 'react-router-dom';
import {
  ClipboardCheck, BookOpen, Calendar, Settings, Zap, UserCircle, LogOut, Brain,
  Target, Activity, ChevronRight, Shield, Stethoscope, PanelLeftClose, PanelLeft,
  MessageCircle, Users, Share2, AlertCircle, Rss, History, BarChart3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { createContext, useContext, useState } from 'react';

// Context for sidebar state
interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}
export const SidebarContext = createContext<SidebarContextType>({
  collapsed: false, setCollapsed: () => {},
  mobileOpen: false, setMobileOpen: () => {},
});
export const useSidebarCollapsed = () => useContext(SidebarContext);

const ADMIN_EMAILS = ["gopalrock.naren@gmail.com", "amc.osce.2026@gmail.com", "testuser123@zyntr.website"];
const SUPER_ADMIN_EMAIL = "gopalrock.naren@gmail.com";

interface NavItem { to: string; label: string; icon: React.ElementType; }
interface NavGroup {
  label: string;
  items: (NavItem | { label: string; icon: React.ElementType; children: NavItem[] })[];
}

// navGroups is now a function to support conditional rendering
function getNavGroups(isPaid: boolean): NavGroup[] {
  const appeItems: (NavItem | { label: string; icon: React.ElementType; children: NavItem[] })[] = [
    { to: '/feed', label: 'Feed', icon: Rss },
  ];

  // Only show Diagnostic for trial/free users
  if (!isPaid) {
    appeItems.push({
      label: 'Diagnostic', icon: ClipboardCheck,
      children: [
        { to: '/assess', label: 'MCQ', icon: Zap },
        { to: '/assess/osce', label: 'OSCE', icon: Stethoscope },
      ],
    });
  }

  appeItems.push(
    { to: '/intelligence', label: 'Performance Intelligence', icon: BarChart3 },
    { to: '/review', label: 'Mistake Review', icon: AlertCircle },
    { to: '/history', label: 'Question History', icon: History },
  );

  return [
    {
      label: 'Learn & Practice',
      items: [
        { to: '/practice', label: 'MCQ', icon: Zap },
        { to: '/stations', label: 'OSCE', icon: Activity },
      ],
    },
    {
      label: 'APPE',
      items: appeItems,
    },
    {
      label: 'Study Companion',
      items: [
        { to: '/companion/chat', label: 'AI Chat', icon: MessageCircle },
        { to: '/companion/ai-core', label: 'Zyntra AI Core', icon: Zap },
        { to: '/plan', label: 'Study Plan', icon: Calendar },
        { to: '/companion/groups', label: 'Social Groups', icon: Users },
        { to: '/companion/shared-tests', label: 'Shared Tests', icon: Share2 },
      ],
    },
  ];
}

function isNavItem(item: NavItem | { label: string; icon: React.ElementType; children: NavItem[] }): item is NavItem {
  return 'to' in item;
}

function NavTooltip({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) {
  if (!collapsed) return <>{children}</>;
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

function CollapsibleNav({ item, location, collapsed, onNavigate }: {
  item: { label: string; icon: React.ElementType; children: NavItem[] };
  location: ReturnType<typeof useLocation>;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const isChildActive = item.children.some(
    (child) => location.pathname === child.to || location.pathname.startsWith(child.to + '/')
  );
  const [open, setOpen] = useState(isChildActive);

  if (collapsed) {
    return (
      <NavTooltip label={item.label} collapsed>
        <div className={cn(
          'flex items-center justify-center rounded-lg py-2 transition-colors',
          isChildActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
        )}>
          <item.icon className="h-4 w-4" />
        </div>
      </NavTooltip>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isChildActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}>
        <item.icon className="h-4 w-4" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-90')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
          {item.children.map((child) => {
            const isActive = location.pathname === child.to;
            return (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  isActive ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <child.icon className="h-3.5 w-3.5" />
                {child.label}
              </NavLink>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AppSidebar({ isMobile }: { isMobile?: boolean }) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const gate = useFeatureGate();
  const isAdmin = ADMIN_EMAILS.includes(user?.email || "");
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebarCollapsed();
  const navGroups = getNavGroups(gate.isPaid);

  const closeMobile = () => { if (isMobile) setMobileOpen(false); };
  const effectiveCollapsed = isMobile ? false : collapsed;

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <TooltipProvider>
        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-72 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
          <SidebarInner
            collapsed={false}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            location={location}
            signOut={signOut}
            onNavigate={closeMobile}
            showCollapseToggle={false}
            setCollapsed={setCollapsed}
            currentCollapsed={false}
            navGroups={navGroups}
          />
        </aside>
      </TooltipProvider>
    );
  }

  // Desktop / Tablet: fixed sidebar
  return (
    <TooltipProvider>
      <aside className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300',
        effectiveCollapsed ? 'w-16' : 'w-64'
      )}>
        <SidebarInner
          collapsed={effectiveCollapsed}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          location={location}
          signOut={signOut}
          showCollapseToggle
          setCollapsed={setCollapsed}
          currentCollapsed={effectiveCollapsed}
          navGroups={navGroups}
        />
      </aside>
    </TooltipProvider>
  );
}

function SidebarInner({
  collapsed, isAdmin, isSuperAdmin, location, signOut, onNavigate, showCollapseToggle, setCollapsed, currentCollapsed, navGroups,
}: {
  collapsed: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  location: ReturnType<typeof useLocation>;
  signOut: () => void;
  onNavigate?: () => void;
  showCollapseToggle: boolean;
  setCollapsed: (v: boolean) => void;
  currentCollapsed: boolean;
  navGroups: NavGroup[];
}) {
  return (
    <>
      {/* Logo */}
      <NavLink to="/" onClick={onNavigate} className={cn('flex items-center gap-2 py-5', collapsed ? 'justify-center px-2' : 'px-6')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold font-display tracking-tight text-sidebar-foreground">Zyntra</span>
        )}
      </NavLink>

      {/* Nav */}
      <nav className={cn('flex-1 overflow-y-auto py-2 space-y-4', collapsed ? 'px-1.5' : 'px-3')}>
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (isNavItem(item)) {
                  const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                  return (
                    <NavTooltip key={item.to} label={item.label} collapsed={collapsed}>
                      <NavLink
                        to={item.to}
                        onClick={onNavigate}
                        className={cn(
                          'flex items-center rounded-lg text-sm font-medium transition-colors',
                          collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2',
                          isActive ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && item.label}
                      </NavLink>
                    </NavTooltip>
                  );
                }
                return <CollapsibleNav key={item.label} item={item} location={location} collapsed={collapsed} onNavigate={onNavigate} />;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className={cn('border-t border-sidebar-border py-3 space-y-1', collapsed ? 'px-1.5' : 'px-3')}>
        <NavTooltip label="Settings" collapsed={collapsed}>
          <NavLink
            to="/settings"
            onClick={onNavigate}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2',
              location.pathname === '/settings' ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!collapsed && 'Settings'}
          </NavLink>
        </NavTooltip>

        {isAdmin && (
          <NavTooltip label="Admin" collapsed={collapsed}>
            <NavLink
              to="/admin"
              onClick={onNavigate}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors',
                collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2',
                location.pathname.startsWith('/admin') ? 'bg-sidebar-accent text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <Shield className="h-4 w-4 shrink-0" />
              {!collapsed && 'Admin'}
            </NavLink>
          </NavTooltip>
        )}


        <ThemeToggle />

        <NavTooltip label="Sign Out" collapsed={collapsed}>
          <button
            onClick={() => { signOut(); onNavigate?.(); }}
            className={cn(
              'flex w-full items-center rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors',
              collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && 'Sign Out'}
          </button>
        </NavTooltip>

        {showCollapseToggle && (
          <NavTooltip label={currentCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} collapsed={currentCollapsed}>
            <button
              onClick={() => setCollapsed(!currentCollapsed)}
              className={cn(
                'flex w-full items-center rounded-lg text-sm font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors',
                currentCollapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2'
              )}
            >
              {currentCollapsed ? <PanelLeft className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
              {!currentCollapsed && 'Collapse'}
            </button>
          </NavTooltip>
        )}
      </div>
    </>
  );
}

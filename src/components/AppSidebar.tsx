import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardCheck,
  BookOpen,
  Calendar,
  Settings,
  Zap,
  UserCircle,
  LogOut,
  Brain,
  Target,
  Activity,
  ChevronRight,
  Shield,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

const ADMIN_EMAIL = "gopalrock.naren@gmail.com";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: (NavItem | { label: string; icon: React.ElementType; children: NavItem[] })[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Learn & Practice',
    items: [
      { to: '/practice', label: 'MCQ', icon: Zap },
      { to: '/stations', label: 'OSCE', icon: Activity },
      {
        label: 'Questions',
        icon: BookOpen,
        children: [
          { to: '/questions/mcq', label: 'MCQ', icon: Zap },
          { to: '/questions/osce', label: 'OSCE', icon: Stethoscope },
        ],
      },
      { to: '/trust-your-gut', label: 'Trust Your Gut', icon: Target },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        label: 'Diagnostic',
        icon: ClipboardCheck,
        children: [
          { to: '/assess', label: 'MCQ', icon: Zap },
          { to: '/assess/osce', label: 'OSCE', icon: Stethoscope },
        ],
      },
      { to: '/profile', label: 'Performance', icon: UserCircle },
      { to: '/behavior', label: 'Behavior', icon: Brain },
    ],
  },
  {
    label: 'Planning',
    items: [
      { to: '/plan', label: 'Study Plan', icon: Calendar },
    ],
  },
];

function isNavItem(item: NavItem | { label: string; icon: React.ElementType; children: NavItem[] }): item is NavItem {
  return 'to' in item;
}

function CollapsibleNav({ item, location }: { item: { label: string; icon: React.ElementType; children: NavItem[] }; location: ReturnType<typeof useLocation> }) {
  const isChildActive = item.children.some(
    (child) => location.pathname === child.to || location.pathname.startsWith(child.to + '/')
  );
  const [open, setOpen] = useState(isChildActive);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isChildActive
          ? 'text-sidebar-primary'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
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
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
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

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <NavLink to="/" className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold font-display tracking-tight text-sidebar-foreground">
          Zyntra
        </span>
      </NavLink>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (isNavItem(item)) {
                  const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  );
                }
                return <CollapsibleNav key={item.label} item={item} location={location} />;
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        <NavLink
          to="/settings"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            location.pathname === '/settings'
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
        {isAdmin && (
          <NavLink
            to="/admin"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              location.pathname.startsWith('/admin')
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </NavLink>
        )}
        <ThemeToggle />
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

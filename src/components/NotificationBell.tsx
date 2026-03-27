import { useState, useRef, useEffect } from 'react';
import { Bell, X, TrendingUp, Target, Brain, Clock, BookOpen, Award, Flame, PlayCircle, Repeat, Zap } from 'lucide-react';
import { useTrainingNotifications, TrainingNotification } from '@/hooks/useTrainingNotifications';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const iconMap: Record<string, React.ElementType> = {
  'trending-up': TrendingUp,
  target: Target,
  brain: Brain,
  clock: Clock,
  'book-open': BookOpen,
  award: Award,
  flame: Flame,
  'play-circle': PlayCircle,
  repeat: Repeat,
  zap: Zap,
};

function NotificationIcon({ icon, className }: { icon: string | null; className?: string }) {
  const Icon = iconMap[icon || 'zap'] || Zap;
  return <Icon className={cn('h-4 w-4', className)} />;
}

const categoryColors: Record<string, string> = {
  performance: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  session_performance: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  behavior: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  behavior_stability: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  training_nudge: 'bg-primary/10 text-primary',
  inactivity: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  content: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

interface NotificationBellProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NotificationBell({ collapsed, onNavigate }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllRead, dismiss } = useTrainingNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNotifClick = (notif: TrainingNotification) => {
    if (!notif.read_at) markAsRead(notif.id);
    if (notif.cta_route) {
      navigate(notif.cta_route);
      setOpen(false);
      onNavigate?.();
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2 w-full',
          'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
        )}
      >
        <div className="relative shrink-0">
          <Bell className="h-4 w-4 transition-transform duration-200 hover:scale-110" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {!collapsed && 'Notifications'}
        {!collapsed && unreadCount > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className={cn(
          'absolute z-[60] w-80 rounded-xl border border-border bg-popover shadow-xl',
          collapsed ? 'left-full ml-2 bottom-0' : 'left-0 bottom-full mb-2'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Training Insights</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
                No notifications yet. Complete a practice session to get personalized insights.
              </div>
            ) : (
              notifications.slice(0, 15).map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    'group relative flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-accent/50',
                    !notif.read_at && 'bg-accent/30'
                  )}
                  onClick={() => handleNotifClick(notif)}
                >
                  {/* Icon */}
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    categoryColors[notif.category] || 'bg-muted text-muted-foreground'
                  )}>
                    <NotificationIcon icon={notif.icon} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm leading-tight',
                      !notif.read_at ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
                    )}>
                      {notif.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {notif.body}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {notif.cta_label && (
                        <span className="text-[11px] font-medium text-primary">
                          {notif.cta_label} →
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!notif.read_at && (
                    <div className="absolute top-3 right-9 h-2 w-2 rounded-full bg-primary" />
                  )}

                  {/* Dismiss */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(notif.id);
                    }}
                    className="absolute top-2 right-2 hidden rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground group-hover:block"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

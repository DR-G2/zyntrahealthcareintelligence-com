import { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrainingNotifications, TrainingNotification } from '@/hooks/useTrainingNotifications';
import { cn } from '@/lib/utils';

interface PostSessionInsightBannerProps {
  sessionData?: { correct: number; total: number; avg_time: number };
}

export function PostSessionInsightBanner({ sessionData }: PostSessionInsightBannerProps) {
  const { notifications, triggerPostSession, markAsRead } = useTrainingNotifications();
  const [banner, setBanner] = useState<TrainingNotification | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Trigger generation on mount if session data provided
  useEffect(() => {
    if (sessionData && sessionData.total > 0) {
      triggerPostSession(sessionData);
    }
  }, []);

  // Show newest unread notification as banner
  useEffect(() => {
    if (dismissed) return;
    const newest = notifications.find(
      (n) => !n.read_at && (n.category === 'session_performance' || n.category === 'performance' || n.category === 'behavior')
    );
    if (newest) setBanner(newest);
  }, [notifications, dismissed]);

  if (!banner || dismissed) return null;

  const categoryStyle: Record<string, string> = {
    session_performance: 'border-emerald-500/30 bg-emerald-500/5',
    performance: 'border-primary/30 bg-primary/5',
    behavior: 'border-amber-500/30 bg-amber-500/5',
  };

  return (
    <div className={cn(
      'relative mb-4 rounded-xl border p-4 transition-all animate-in slide-in-from-top-2',
      categoryStyle[banner.category] || 'border-border bg-card'
    )}>
      <button
        onClick={() => {
          setDismissed(true);
          markAsRead(banner.id);
        }}
        className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <h4 className="text-sm font-semibold text-foreground pr-6">{banner.title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{banner.body}</p>
      {banner.cta_label && banner.cta_route && (
        <button
          onClick={() => {
            markAsRead(banner.id);
            navigate(banner.cta_route!);
          }}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {banner.cta_label} <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

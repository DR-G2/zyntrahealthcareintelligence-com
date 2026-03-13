import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Clock, Crown, AlertTriangle } from 'lucide-react';

export function SubscriptionTimer() {
  const { subscription } = useAuth();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (subscription.loading || !subscription.subscribed) return null;

  if (subscription.tier === 'lifetime') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Crown className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">Lifetime Access</span>
      </div>
    );
  }

  if (!subscription.subscription_end) return null;

  const endDate = new Date(subscription.subscription_end).getTime();
  const diffMs = endDate - now;
  if (diffMs <= 0) return null;

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  const isUrgent = days <= 3;

  if (isUrgent) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-warning">
            ⏳ Expires in {days}d {hours}h
          </span>
          <Link to="/pricing" className="ml-2 text-xs text-primary underline hover:text-primary/80">
            Renew now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">
        Plan Active · {days} days remaining
      </span>
    </div>
  );
}

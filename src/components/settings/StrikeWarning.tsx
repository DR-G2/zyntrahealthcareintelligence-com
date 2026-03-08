import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function StrikeWarning() {
  const { watermark } = useAuth();

  if (watermark.strike_count === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
      <div className="flex items-center gap-2">
        {watermark.strike_count >= 3 ? (
          <ShieldAlert className="h-5 w-5 text-destructive" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-destructive" />
        )}
        <span className="text-sm font-semibold text-destructive">
          Piracy Violations
        </span>
        <Badge variant="destructive" className="ml-auto">
          {watermark.strike_count} / 3 strikes
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {watermark.strike_count >= 3
          ? 'Your account has been suspended due to multiple piracy violations.'
          : watermark.strike_count === 2
          ? 'Final warning — one more strike and your account will be suspended.'
          : 'A piracy violation has been recorded on your account. Your watermark visibility has been increased.'}
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Watermark level:</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-destructive rounded-full transition-all"
            style={{ width: `${Math.min((watermark.opacity_light / 0.145) * 100, 100)}%` }}
          />
        </div>
        <span className="font-mono">{(watermark.opacity_light * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

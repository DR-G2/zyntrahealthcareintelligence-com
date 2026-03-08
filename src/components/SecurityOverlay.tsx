import { useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface SecurityOverlayProps {
  children: ReactNode;
  opacityOverride?: number;
}

export function SecurityOverlay({ children, opacityOverride }: SecurityOverlayProps) {
  const { user, profile, watermark } = useAuth();

  const watermarkText = [
    profile?.name || '',
    user?.email || '',
  ].filter(Boolean).join(' • ') || 'Protected Content';

  // Dynamic opacity from watermark settings or override
  const lightOpacity = opacityOverride ?? watermark.opacity_light;
  const darkOpacity = opacityOverride ? opacityOverride + 0.01 : watermark.opacity_dark;

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'PrintScreen') {
      e.preventDefault();
      navigator.clipboard?.writeText?.('');
    }
    if (e.key === 'F12') {
      e.preventDefault();
    }
    if (e.ctrlKey || e.metaKey) {
      const blocked = ['c', 'p', 's', 'u', 'a'];
      if (blocked.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    }
  }, []);

  const handleDragStart = useCallback((e: DragEvent) => {
    e.preventDefault();
  }, []);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      console.warn('[Security] Tab switch detected at', new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleContextMenu, handleKeyDown, handleDragStart, handleVisibilityChange]);

  // DevTools detection
  useEffect(() => {
    let devtoolsOpen = false;
    const threshold = 160;
    const check = () => {
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;
      if ((widthDiff || heightDiff) && !devtoolsOpen) {
        devtoolsOpen = true;
        console.warn('[Security] DevTools may be open');
      } else if (!widthDiff && !heightDiff) {
        devtoolsOpen = false;
      }
    };
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  // Suspension blocker
  if (watermark.suspended) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4 p-8">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold font-display text-destructive">Account Suspended</h1>
          <p className="text-muted-foreground">
            Your account has been suspended due to multiple piracy violations. 
            Please contact support if you believe this is an error.
          </p>
          <p className="text-xs text-muted-foreground">support@zyntraamc.com</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative select-none" style={{ WebkitUserSelect: 'none', MozUserSelect: 'none' } as React.CSSProperties}>
      {children}
      {/* Watermark overlay */}
      <div
        className="fixed inset-0 z-[9999] overflow-hidden"
        style={{ pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <div
          className="absolute"
          style={{
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            transform: 'rotate(-35deg)',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            gap: '80px 60px',
            padding: '40px',
          }}
        >
          {Array.from({ length: 120 }).map((_, i) => (
            <span
              key={i}
              className="whitespace-nowrap text-sm font-medium tracking-wide"
              style={{
                fontFamily: 'monospace',
                color: `hsl(var(--foreground) / ${lightOpacity})`,
              }}
            >
              {watermarkText}
            </span>
          ))}
        </div>
      </div>
      {/* Dark mode uses dark opacity via a media query style */}
      <style>{`
        @media (prefers-color-scheme: dark) {
          [aria-hidden="true"] span {
            color: hsl(var(--foreground) / ${darkOpacity}) !important;
          }
        }
        .dark [aria-hidden="true"] span {
          color: hsl(var(--foreground) / ${darkOpacity}) !important;
        }
      `}</style>
    </div>
  );
}

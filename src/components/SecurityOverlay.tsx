import { useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface SecurityOverlayProps {
  children: ReactNode;
}

export function SecurityOverlay({ children }: SecurityOverlayProps) {
  const { user, profile } = useAuth();

  const watermarkText = [
    profile?.name || '',
    user?.email || '',
  ].filter(Boolean).join(' • ') || 'Protected Content';

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Block PrintScreen
    if (e.key === 'PrintScreen') {
      e.preventDefault();
      navigator.clipboard?.writeText?.('');
    }
    // Block F12
    if (e.key === 'F12') {
      e.preventDefault();
    }
    // Block Ctrl/Cmd shortcuts
    if (e.ctrlKey || e.metaKey) {
      const blocked = ['c', 'p', 's', 'u', 'a'];
      if (blocked.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
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

  // DevTools detection via window size
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
              className="text-foreground/[0.035] dark:text-foreground/[0.045] whitespace-nowrap text-sm font-medium tracking-wide"
              style={{ fontFamily: 'monospace' }}
            >
              {watermarkText}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

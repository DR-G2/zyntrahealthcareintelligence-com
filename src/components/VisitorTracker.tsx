import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useVisitorTracking } from '@/hooks/useVisitorTracking';

/**
 * Global visitor tracker component — renders nothing,
 * just runs the tracking hook at the router level.
 */
export function VisitorTracker() {
  useVisitorTracking();
  return null;
}

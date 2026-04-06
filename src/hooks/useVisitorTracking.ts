import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const VISITOR_ID_KEY = 'zyntra_visitor_id';
const VISIT_COUNT_KEY = 'zyntra_visit_count';
const LAST_VISIT_KEY = 'zyntra_last_visit';

function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

function getVisitInfo() {
  const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1;
  const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
  const isReturning = !!lastVisit;
  localStorage.setItem(VISIT_COUNT_KEY, String(count));
  localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  return { count, isReturning };
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  return { deviceType: isMobile ? 'mobile' : 'desktop', browser };
}

/** Fetch country/city from free IP geolocation API (no key required) */
async function fetchGeoLocation(): Promise<{ country: string; city: string } | null> {
  try {
    const res = await fetch('https://ip-api.com/json/?fields=country,city', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.country) return { country: data.country, city: data.city || 'Unknown' };
    return null;
  } catch {
    return null;
  }
}

// High-intent actions
const HIGH_INTENT_ACTIONS = [
  'click_start_preparing', 'attempt_login', 'start_mcq', 'resume_session',
  'view_readiness_score', 'start_osce', 'click_try_station',
];

// Queue for batching writes
let eventQueue: any[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

async function flushEvents() {
  if (!eventQueue.length) return;
  const batch = [...eventQueue];
  eventQueue = [];

  const pageViews = batch.filter(e => e._table === 'page_views').map(({ _table, ...rest }) => rest);
  const intents = batch.filter(e => e._table === 'intent_signals').map(({ _table, ...rest }) => rest);

  const promises: Promise<any>[] = [];
  if (pageViews.length) promises.push(supabase.from('page_views').insert(pageViews as any));
  if (intents.length) promises.push(supabase.from('intent_signals').insert(intents as any));
  await Promise.allSettled(promises);
}

function queueEvent(event: any) {
  eventQueue.push(event);
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushEvents, 2000);
}

export function useVisitorTracking() {
  const { user } = useAuth();
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
  const visitorId = useRef(getOrCreateVisitorId());
  const pageEntryRef = useRef<{ page: string; time: number } | null>(null);
  const sessionStartRef = useRef(Date.now());
  const pagesVisitedRef = useRef(0);

  // Start session on mount
  useEffect(() => {
    const { count, isReturning } = getVisitInfo();
    const { deviceType, browser } = getDeviceInfo();

    const startSession = async () => {
      // Fetch geo-location in parallel with session creation
      const [geoResult, sessionResult] = await Promise.allSettled([
        fetchGeoLocation(),
        supabase.from('visitor_sessions').insert({
          visitor_id: visitorId.current,
          user_id: user?.id || null,
          device_type: deviceType,
          browser,
          is_returning: isReturning,
          visit_number: count,
          referrer: document.referrer || null,
          platform: 'zyntra',
        } as any).select('id').single(),
      ]);

      const sessionData = sessionResult.status === 'fulfilled' ? sessionResult.value.data : null;
      if (sessionData) {
        sessionIdRef.current = sessionData.id;

        // Update session with geo data if available
        const geo = geoResult.status === 'fulfilled' ? geoResult.value : null;
        if (geo) {
          await supabase.from('visitor_sessions').update({
            country: geo.country,
            city: geo.city,
          } as any).eq('id', sessionData.id);
        }
      }
    };

    startSession();

    const endSession = () => {
      if (!sessionIdRef.current) return;
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
      supabase.from('visitor_sessions').update({
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        pages_visited: pagesVisitedRef.current,
        exit_page: location.pathname,
      } as any).eq('id', sessionIdRef.current).then(() => {});
    };

    const bounceTimer = setTimeout(() => {}, 10000);
    const handleBeforeUnload = () => {
      flushEvents();
      const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
      if (duration < 10 && sessionIdRef.current) {
        queueEvent({
          _table: 'intent_signals',
          visitor_id: visitorId.current,
          user_id: user?.id || null,
          session_id: sessionIdRef.current,
          action: 'bounce',
          intent_level: 'low',
          page: location.pathname,
          platform: 'zyntra',
        });
        flushEvents();
      }
      endSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearTimeout(bounceTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, []); // eslint-disable-line

  // Track page views
  useEffect(() => {
    if (pageEntryRef.current && sessionIdRef.current) {
      const timeOnPage = Math.round((Date.now() - pageEntryRef.current.time) / 1000);
      queueEvent({
        _table: 'page_views',
        visitor_id: visitorId.current,
        user_id: user?.id || null,
        session_id: sessionIdRef.current,
        page: pageEntryRef.current.page,
        time_on_page_seconds: timeOnPage,
        platform: 'zyntra',
      });
    }
    pageEntryRef.current = { page: location.pathname, time: Date.now() };
    pagesVisitedRef.current += 1;
  }, [location.pathname]); // eslint-disable-line

  // Track intent signals
  const trackIntent = useCallback((action: string, metadata?: Record<string, any>) => {
    const level = HIGH_INTENT_ACTIONS.includes(action) ? 'high' : 'medium';
    queueEvent({
      _table: 'intent_signals',
      visitor_id: visitorId.current,
      user_id: user?.id || null,
      session_id: sessionIdRef.current,
      action,
      intent_level: level,
      page: location.pathname,
      metadata: metadata || {},
      platform: 'zyntra',
    });
  }, [user?.id, location.pathname]);

  return { trackIntent, visitorId: visitorId.current };
}

// Standalone nudge function
export async function sendNudge(visitorId: string, userId: string | null, page: string, message: string) {
  await supabase.from('nudge_signals').insert({
    visitor_id: visitorId,
    user_id: userId,
    page,
    message,
    platform: 'zyntra',
  } as any);
}

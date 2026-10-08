import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldAlert, Lock, Camera, Clock3, Scale } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Severity = 'high' | 'critical';

type Enforcement = {
  severity: Severity;
  action: string;
  starts_at: string;
  ends_at: string;
  reason: string;
};

type Notice = {
  id: string;
  severity: 'low' | 'medium';
  title: string;
  message: string;
  tracked_summary: Record<string, unknown>;
  created_at: string;
};

const COPY: Record<Severity, { title: string; duration: string; body: string }> = {
  high: {
    title: 'SUSPECTED ACTIVITY DETECTED',
    duration: '2-hour practice restriction',
    body:
      'Multiple practice-window security signals were detected. Your activity has been recorded for security review. If screenshot evidence was captured, it is restricted to the Zyntra viewport and handled under the security policy.',
  },
  critical: {
    title: 'CRITICAL SECURITY ACTIVITY DETECTED',
    duration: '24-hour practice restriction',
    body:
      'A critical security event was detected and correlated with your session. Evidence relevant to the incident may be forwarded to authorized Zyntra administrators for review, subject to the security and privacy policy.',
  },
};

function formatRemaining(endsAt: string) {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function PracticeSecurityEnforcement({ active = false }: { active?: boolean }) {
  const [enforcement, setEnforcement] = useState<Enforcement | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [remaining, setRemaining] = useState('');
  const [signalCount, setSignalCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setSignalCount(0);
      return;
    }

    const signal = async (signalType: string) => {
      setSignalCount((count) => {
        const next = count + 1;
        void supabase.rpc('record_my_security_session_signal', {
          p_signal_type: signalType,
          p_severity: next >= 2 ? 'high' : 'medium',
          p_value: {
            page: window.location.pathname,
            practice_window: true,
            client_time: new Date().toISOString(),
          },
        });
        return next;
      });
    };

    const onBlur = () => void signal('window_blur');
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void signal('visibility_hidden');
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);



  const load = useCallback(async () => {
    const [banRes, noticeRes] = await Promise.all([
      supabase.rpc('get_my_security_enforcement'),
      supabase.rpc('get_my_security_notices'),
    ]);

    if (!banRes.error) {
      const active = Array.isArray(banRes.data) ? banRes.data[0] : null;
      if (active) setEnforcement(active as Enforcement);
      else setEnforcement(null);
    }

    if (!noticeRes.error && Array.isArray(noticeRes.data)) {
      setNotices(noticeRes.data as Notice[]);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!enforcement) return;
    const tick = () => setRemaining(formatRemaining(enforcement.ends_at));
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => window.clearInterval(timer);
  }, [enforcement]);

  const severity = enforcement?.severity;
  const copy = useMemo(() => severity ? COPY[severity] : null, [severity]);

  if (enforcement && copy) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="security-enforcement-title"
          className="w-full max-w-2xl rounded-2xl border border-red-500/50 bg-[#070B14] shadow-2xl shadow-red-950/50"
        >
          <div className="border-b border-red-500/20 px-6 py-5 flex items-center gap-3">
            <ShieldAlert className="h-7 w-7 text-red-400" />
            <div>
              <h1 id="security-enforcement-title" className="text-lg font-bold tracking-wide text-red-300">
                {copy.title}
              </h1>
              <p className="text-xs text-slate-400">{copy.duration}</p>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6 text-sm text-slate-200">
            <p>{copy.body}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-slate-300">
                  <Camera className="h-4 w-4" />
                  <span className="font-medium">Evidence handling</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Screenshots, when captured, are Zyntra-viewport-only, redacted where configured, access-restricted, and retained according to policy.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-slate-300">
                  <Lock className="h-4 w-4" />
                  <span className="font-medium">Administrator review</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  The incident record and relevant security metadata may be made available to authorized administrators for investigation.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
              <div className="flex items-center gap-2 text-amber-300">
                <Scale className="h-4 w-4" />
                <span className="font-semibold">Policy notice</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Activity that violates Zyntra privacy, security, acceptable-use, or examination-integrity policies may result in further account or legal action where permitted by applicable law and the Terms.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
              <div className="flex items-center gap-2 text-red-300">
                <Clock3 className="h-4 w-4" />
                <span>Restriction remaining</span>
              </div>
              <strong className="text-red-200">{remaining}</strong>
            </div>

            <p className="text-xs text-slate-500">
              This security notice cannot be dismissed during the active restriction. Close the browser to end the current practice session; the restriction itself remains server-enforced until its expiry.
            </p>
          </div>
        </section>
      </div>
    );
  }

  if (notices.length > 0) {
    const notice = notices[0];
    return (
      <div className="fixed bottom-5 right-5 z-[90] w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-amber-500/30 bg-[#070B14]/95 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h2 className="font-semibold text-amber-200">{notice.title}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-300">{notice.message}</p>
            <p className="mt-2 text-xs text-slate-500">
              Tracked: {String(notice.tracked_summary.signal_type ?? 'session security signal')} · stored for security review under policy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

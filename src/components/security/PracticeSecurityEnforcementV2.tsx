import { useCallback, useEffect, useState } from 'react';
import html2canvas from 'html2canvas';
import { AlertTriangle, Camera, Clock3, Lock, Scale, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Severity = 'high' | 'critical';
type Enforcement = { severity: Severity; action: string; starts_at: string; ends_at: string; reason: string; event_count?: number; screenshot_count?: number; forwarded_to_admin?: Record<string, boolean>; not_forwarded?: string[] };
type Notice = { title: string; message: string; tracked_summary?: Record<string, unknown> };

async function hashBlob(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, '0')).join('');
}

async function captureViewport() {
  const root = document.querySelector('[data-zyntra-security-viewport]') as HTMLElement | null;
  if (!root) throw new Error('Zyntra viewport unavailable');
  const canvas = await html2canvas(root, {
    backgroundColor: '#040812',
    useCORS: true,
    logging: false,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    ignoreElements: el => el.matches('input,textarea,[data-security-private="true"]'),
    onclone: doc => doc.querySelectorAll('input,textarea,[data-security-private="true"]').forEach(el => {
      (el as HTMLElement).style.visibility = 'hidden';
    }),
  });
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('capture failed')), 'image/png'));
}

export function PracticeSecurityEnforcementV2({ active = false }: { active?: boolean }) {
  const [ban, setBan] = useState<Enforcement | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [signals, setSignals] = useState(0);
  const [remaining, setRemaining] = useState('');

  const refresh = useCallback(async () => {
    const [b, n] = await Promise.all([
      supabase.rpc('get_my_security_enforcement'),
      supabase.rpc('get_my_security_notices'),
    ]);
    if (!b.error) setBan(Array.isArray(b.data) ? (b.data[0] as Enforcement | undefined) ?? null : null);
    if (!n.error && Array.isArray(n.data) && n.data[0]) setNotice(n.data[0] as Notice);
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!ban) return;
    const tick = () => {
      const ms = Math.max(0, new Date(ban.ends_at).getTime() - Date.now());
      setRemaining(`${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`);
    };
    tick();
    const t = window.setInterval(tick, 30000);
    return () => window.clearInterval(t);
  }, [ban]);

  const sendSignal = useCallback(async (type: string) => {
    setSignals(prev => {
      const next = prev + 1;
      const severity = next >= 2 ? 'high' : 'medium';
      void (async () => {
        const { data, error } = await supabase.rpc('record_my_security_session_signal', {
          p_signal_type: type,
          p_severity: severity,
          p_value: { path: location.pathname, practice_window: true, client_time: new Date().toISOString() },
        });
        if (error || severity !== 'high' || !data) {
          if (!error) await refresh();
          return;
        }

        try {
          const blob = await captureViewport();
          const hash = await hashBlob(blob);
          const { data: auth } = await supabase.auth.getUser();
          if (!auth.user) throw new Error('authentication unavailable');
          const ref = `${auth.user.id}/${data}/${crypto.randomUUID()}.png`;
          const uploaded = await supabase.storage.from('security-evidence').upload(ref, blob, {
            contentType: 'image/png', upsert: false,
          });
          if (uploaded.error) throw uploaded.error;
          const finalized = await supabase.rpc('finalize_my_security_screenshot', {
            p_event_id: data, p_storage_ref: ref, p_content_hash: hash, p_redaction_state: 'redacted',
          });
          if (finalized.error) throw finalized.error;
        } catch {
          await supabase.rpc('enforce_my_security_event', { p_event_id: data });
        }
        await refresh();
      })();
      return next;
    });
  }, [refresh]);

  useEffect(() => {
    if (!active) { setSignals(0); return; }
    const blur = () => void sendSignal('window_blur');
    const hidden = () => { if (document.visibilityState === 'hidden') void sendSignal('visibility_hidden'); };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [active, sendSignal]);

  if (ban) {
    const critical = ban.severity === 'critical';
    return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <section role="alertdialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl border border-red-500/50 bg-[#070B14] shadow-2xl shadow-red-950/50">
        <div className="flex items-center gap-3 border-b border-red-500/20 px-6 py-5">
          <ShieldAlert className="h-7 w-7 text-red-400" />
          <div><h1 className="text-lg font-bold tracking-wide text-red-300">{critical ? 'CRITICAL SECURITY ACTIVITY DETECTED' : 'SUSPECTED ACTIVITY DETECTED'}</h1><p className="text-xs text-slate-400">{critical ? '24-hour practice restriction' : '2-hour practice restriction'}</p></div>
        </div>
        <div className="space-y-5 px-6 py-6 text-sm text-slate-200">
          <p>{critical ? 'A critical security event was detected and correlated with your session. Relevant evidence may be available to authorized administrators for review under policy.' : 'Multiple practice-window security signals were detected. Your activity has been recorded for security review.'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-2 text-slate-300"><Camera className="h-4 w-4" /><span className="font-medium">Evidence</span></div><p className="mt-2 text-xs leading-5 text-slate-400">If a screenshot was successfully captured, it is Zyntra-viewport-only, redacted where configured, hashed, access-restricted and retained according to policy.</p></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-2 text-slate-300"><Lock className="h-4 w-4" /><span className="font-medium">Administrator review</span></div><p className="mt-2 text-xs leading-5 text-slate-400">Relevant security events and evidence may be forwarded to authorized Zyntra administrators. Credentials and secrets are not part of the evidence pipeline.</p></div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4"><div className="flex items-center gap-2 text-amber-300"><Scale className="h-4 w-4" /><span className="font-semibold">Policy notice</span></div><p className="mt-2 text-xs leading-5 text-slate-300">Activity that violates Zyntra privacy, security, acceptable-use, or examination-integrity policies may result in further account or legal action where permitted by applicable law and the Terms.</p></div>
          <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4"><div className="flex items-center gap-2 text-red-300"><Clock3 className="h-4 w-4" /><span>Restriction remaining</span></div><strong className="text-red-200">{remaining}</strong></div>
          <p className="text-xs text-slate-500">This security notice cannot be dismissed while the server-side restriction is active. Closing the browser does not remove the restriction.</p>
        </div>
      </section>
    </div>;
  }

  if (notice) return <div className="fixed bottom-5 right-5 z-[90] w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-amber-500/30 bg-[#070B14]/95 p-5 shadow-2xl backdrop-blur-md"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" /><div><h2 className="font-semibold text-amber-200">{notice.title}</h2><p className="mt-1 text-sm leading-5 text-slate-300">{notice.message}</p><p className="mt-2 text-xs text-slate-500">Tracked: {String(notice.tracked_summary?.signal_type ?? 'practice security signal')} · retained under policy.</p></div></div></div>;

  return null;
}

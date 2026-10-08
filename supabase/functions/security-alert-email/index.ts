import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ALERT_FROM = Deno.env.get('SECURITY_ALERT_FROM_EMAIL');
const ADMIN_EMAILS = (Deno.env.get('SECURITY_ADMIN_EMAILS') || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]!));
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!RESEND_API_KEY || !ALERT_FROM || !ADMIN_EMAILS.length) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Email provider is not configured',
      required: ['RESEND_API_KEY','SECURITY_ALERT_FROM_EMAIL','SECURITY_ADMIN_EMAILS'],
    }), { status: 503, headers: { 'content-type': 'application/json' } });
  }

  const { data: alerts, error } = await db
    .schema('pie')
    .from('security_alert')
    .select('id,incident_id,severity,title,category,summary,created_at')
    .eq('notification_state', 'pending')
    .contains('notification_channels', ['admin_email'])
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) return new Response(JSON.stringify({ ok:false, error:error.message }), { status:500 });

  let sent = 0;
  let failed = 0;

  for (const alert of alerts ?? []) {
    try {
      const { data: incident } = await db
        .schema('pie')
        .from('security_incident')
        .select('id,user_id,severity,event_count,screenshot_count,first_event_at,last_event_at')
        .eq('id', alert.incident_id)
        .single();

      const email = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: ALERT_FROM,
          to: ADMIN_EMAILS,
          subject: `[${String(alert.severity).toUpperCase()}] Zyntra security alert: ${alert.category}`,
          html: `
            <h2>${escapeHtml(alert.title)}</h2>
            <p><strong>Severity:</strong> ${escapeHtml(alert.severity)}</p>
            <p><strong>Category:</strong> ${escapeHtml(alert.category)}</p>
            <p><strong>Summary:</strong> ${escapeHtml(alert.summary)}</p>
            <hr>
            <p><strong>Incident:</strong> ${escapeHtml(alert.incident_id)}</p>
            <p><strong>User:</strong> ${escapeHtml(incident?.user_id)}</p>
            <p><strong>Events:</strong> ${escapeHtml(incident?.event_count)}</p>
            <p><strong>Screenshots:</strong> ${escapeHtml(incident?.screenshot_count)}</p>
            <p><strong>First event:</strong> ${escapeHtml(incident?.first_event_at)}</p>
            <p><strong>Last event:</strong> ${escapeHtml(incident?.last_event_at)}</p>
            <p>This message contains security metadata only. Credentials, passwords, refresh tokens and access tokens are excluded.</p>
          `,
        }),
      });

      if (!email.ok) throw new Error(await email.text());

      await db.schema('pie').from('security_alert')
        .update({ notification_state: 'sent', sent_at: new Date().toISOString() })
        .eq('id', alert.id);

      sent++;
    } catch (e) {
      await db.schema('pie').from('security_alert')
        .update({ notification_state: 'failed' })
        .eq('id', alert.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ ok: failed === 0, processed: (alerts ?? []).length, sent, failed }), {
    headers: { 'content-type': 'application/json' },
  });
});

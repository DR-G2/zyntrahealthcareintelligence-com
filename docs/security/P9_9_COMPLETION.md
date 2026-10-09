# P9.9 Security Completion

## Live controls
- AI Tutor security gateway
- exact event-to-incident membership
- HIGH/CRITICAL correlation and escalation
- 2h HIGH / 24h CRITICAL server enforcement
- viewport-only screenshot capture
- private evidence storage
- evidence hash and redaction metadata
- admin-only evidence access with audit
- capture kill switch
- session-signal debounce
- raw security table isolation
- identity NOT NULL invariants
- realtime admin alerts
- admin email queue
- Resend delivery webhook persistence

## Required deployment secrets

Supabase Edge Functions:
- RESEND_API_KEY
- SECURITY_ALERT_FROM_EMAIL=heisenberg@zyntrahealthcareintelligence.com
- SECURITY_ADMIN_EMAILS=gopalrock.naren@gmail.com
- SECURITY_EMAIL_WORKER_SECRET
- RESEND_WEBHOOK_SECRET

GitHub Actions:
- ZYNTRA_SECURITY_EMAIL_WORKER_SECRET

## Resend webhook
Configure the Resend webhook endpoint:

/functions/v1/security-alert-webhook

Subscribe to delivery events including sent, delivered, bounced and complained.

The webhook is signature-verified and stores only provider delivery metadata needed to reconcile security alerts.

## Completion rule

P9.9 is not considered externally certified until the authenticated security-live-certification workflow passes and the Resend secrets/webhook are configured in the deployment environment.

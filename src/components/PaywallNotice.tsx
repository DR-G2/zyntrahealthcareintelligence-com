import { UpgradePrompt } from '@/components/UpgradePrompt';
import { PAYWALL_MESSAGE } from '@/lib/pie/pie-paid-history-client';

/** Generic paywall shown when a paid RPC refuses with 42501. Never says which check failed. */
export function PaywallNotice({ variant = 'card' }: { variant?: 'card' | 'banner' }) {
  return <UpgradePrompt feature="Paid access" description={PAYWALL_MESSAGE} variant={variant} />;
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Gift, Copy, Check, Users } from 'lucide-react';

export function ReferralCard() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Check for existing referral code
      const { data: existing } = await (supabase
        .from('referrals' as any)
        .select('referral_code, status')
        .eq('referrer_id', user.id)) as any;

      if (existing && existing.length > 0) {
        setReferralCode(existing[0].referral_code);
        setReferralCount(existing.filter((r: any) => r.status === 'completed').length);
      } else {
        // Generate a new code
        const code = `ZYNTRA-${user.id.slice(0, 6).toUpperCase()}`;
        await (supabase.from('referrals' as any).insert({
          referrer_id: user.id,
          referral_code: code,
          status: 'pending',
        } as any) as any);
        setReferralCode(code);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleCopy = async () => {
    const link = `${window.location.origin}/login?ref=${referralCode}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return null;

  const shareLink = `${window.location.origin}/login?ref=${referralCode}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" /> Refer a Friend
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Share your referral link — both you and your friend get <strong>7 free days</strong> of Core access!
        </p>

        <div className="flex gap-2">
          <Input value={shareLink} readOnly className="text-xs bg-muted" />
          <Button variant="outline" size="icon" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{referralCount} successful referral{referralCount !== 1 ? 's' : ''}</span>
        </div>
      </CardContent>
    </Card>
  );
}

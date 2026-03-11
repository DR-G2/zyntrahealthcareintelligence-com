import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CURRENT_TERMS_VERSION } from '@/lib/legal';
import { ProfileCompletionModal } from '@/components/ProfileCompletionModal';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, termsAccepted, termsLoading, acceptTerms } = useAuth();
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);

  if (loading || termsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (profile && !profile.onboarding_complete) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!termsAccepted) {
    const handleAccept = async () => {
      setAccepting(true);
      await acceptTerms();
      setAccepting(false);
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="font-display text-lg">Updated Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-[11px] text-foreground/85 leading-[1.4]">
              We've updated our Terms of Service ({CURRENT_TERMS_VERSION}). Please review and accept to continue using Zyntra.
            </p>
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms-reaccept"
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="terms-reaccept" className="text-[11px] leading-[1.4] text-foreground/85 cursor-pointer">
                I agree to the{' '}
                <Link to="/terms" target="_blank" className="text-primary underline">
                  Terms of Service
                </Link>{' '}
                and Copyright Policy
              </label>
            </div>
            <Button onClick={handleAccept} disabled={!checked || accepting} className="w-full">
              {accepting ? 'Accepting…' : 'Accept & Continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check profile completeness
  const isProfileComplete = profile?.name && profile?.country_of_origin &&
    profile?.user_type && profile?.medical_college && profile?.graduation_year;

  if (!isProfileComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <ProfileCompletionModal profile={profile} />
      </div>
    );
  }

  return <>{children}</>;
}

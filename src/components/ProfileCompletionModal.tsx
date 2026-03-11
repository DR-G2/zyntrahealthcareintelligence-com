import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { UserCircle } from 'lucide-react';

const COUNTRIES = [
  'Australia', 'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal',
  'Philippines', 'Nigeria', 'Egypt', 'Iran', 'Iraq', 'China',
  'United Kingdom', 'United States', 'Canada', 'New Zealand',
  'South Africa', 'Malaysia', 'Indonesia', 'Other',
];

const DEGREES = ['MBBS', 'MD', 'MBChB', 'BMBS', 'Other'];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 40 }, (_, i) => currentYear - i);

interface ProfileCompletionModalProps {
  profile: {
    name?: string | null;
    country_of_origin?: string | null;
    user_type?: string | null;
    medical_college?: string | null;
    graduation_year?: number | null;
    amc_candidate_id?: string | null;
  } | null;
}

export function ProfileCompletionModal({ profile }: ProfileCompletionModalProps) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(profile?.name || '');
  const [country, setCountry] = useState(profile?.country_of_origin || '');
  const [degree, setDegree] = useState(profile?.user_type || '');
  const [university, setUniversity] = useState(profile?.medical_college || '');
  const [gradYear, setGradYear] = useState<string>(profile?.graduation_year?.toString() || '');
  const [amcId, setAmcId] = useState((profile as any)?.amc_candidate_id || '');

  const isValid = name.trim() && country && degree && university.trim() && gradYear;

  const handleSubmit = async () => {
    if (!user || !isValid) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        name: name.trim(),
        country_of_origin: country,
        user_type: degree,
        medical_college: university.trim(),
        graduation_year: parseInt(gradYear),
        amc_candidate_id: amcId.trim() || null,
      } as any).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: 'Profile completed', description: 'You can now access all features.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            <DialogTitle>Complete Your Profile</DialogTitle>
          </div>
          <DialogDescription>
            Please fill in all required fields to access exams and practice stations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pc-name">Full Name *</Label>
            <Input id="pc-name" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" maxLength={100} />
          </div>

          <div className="space-y-1.5">
            <Label>Country *</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Medical Degree *</Label>
            <Select value={degree} onValueChange={setDegree}>
              <SelectTrigger><SelectValue placeholder="Select degree" /></SelectTrigger>
              <SelectContent>
                {DEGREES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pc-uni">University *</Label>
            <Input id="pc-uni" value={university} onChange={e => setUniversity(e.target.value)} placeholder="University / Medical College" maxLength={200} />
          </div>

          <div className="space-y-1.5">
            <Label>Year of Graduation *</Label>
            <Select value={gradYear} onValueChange={setGradYear}>
              <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
              <SelectContent>
                {YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pc-amc">AMC Candidate ID (optional)</Label>
            <Input id="pc-amc" value={amcId} onChange={e => setAmcId(e.target.value)} placeholder="If available" maxLength={50} />
          </div>

          <Button onClick={handleSubmit} disabled={!isValid || saving} className="w-full">
            {saving ? 'Saving…' : 'Save & Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

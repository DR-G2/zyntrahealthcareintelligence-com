import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { User, Calendar, Shield, Info, LogOut, Trash2, Scale, GraduationCap } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { ReferralCard } from '@/components/settings/ReferralCard';
import { StrikeWarning } from '@/components/settings/StrikeWarning';
import { LEGAL_EMAIL } from '@/lib/legal';

export default function Settings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.name ?? '');
  const [examDate, setExamDate] = useState(profile?.exam_date ?? '');
  const [userType, setUserType] = useState(profile?.user_type ?? '');
  const [countryOfOrigin, setCountryOfOrigin] = useState(profile?.country_of_origin ?? '');
  const [countryOfGraduation, setCountryOfGraduation] = useState(profile?.country_of_graduation ?? '');
  const [medicalCollege, setMedicalCollege] = useState(profile?.medical_college ?? '');
  const [graduationYear, setGraduationYear] = useState(profile?.graduation_year?.toString() ?? '');
  const [currentLocation, setCurrentLocation] = useState(profile?.current_location ?? '');
  const [examStage, setExamStage] = useState(profile?.exam_stage ?? '');
  const [examTarget, setExamTarget] = useState(profile?.exam_target ?? '');
  const [amc1Score, setAmc1Score] = useState(profile?.amc1_score?.toString() ?? '');
  const [amc2BookingStatus, setAmc2BookingStatus] = useState(profile?.amc2_booking_status ?? '');
  const [examLocation, setExamLocation] = useState(profile?.exam_location ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: name || null,
        exam_date: examDate || null,
        user_type: userType || null,
        country_of_origin: countryOfOrigin || null,
        country_of_graduation: countryOfGraduation || null,
        medical_college: medicalCollege || null,
        graduation_year: graduationYear ? parseInt(graduationYear) : null,
        current_location: currentLocation || null,
        exam_stage: examStage || null,
        exam_target: examTarget || null,
        amc1_score: amc1Score ? parseInt(amc1Score) : null,
        amc2_booking_status: amc2BookingStatus || null,
        exam_location: examLocation || null,
      } as any)
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to save profile');
    } else {
      toast.success('Profile updated');
      await refreshProfile();
    }
    setSaving(false);
  };

  const handleDeleteData = async () => {
    if (!user) return;
    setDeleting(true);

    // Delete user attempts and performance profile
    await Promise.all([
      supabase.from('user_attempts').delete().eq('user_id', user.id),
      supabase.from('performance_profiles').delete().eq('user_id', user.id),
      supabase.from('bookmarks').delete().eq('user_id', user.id),
      supabase.from('user_notes').delete().eq('user_id', user.id),
      supabase.from('user_progress').delete().eq('user_id', user.id),
      supabase.from('study_plans').delete().eq('user_id', user.id),
    ]);

    // Reset profile fields
    await supabase
      .from('profiles')
      .update({ weak_areas: null, onboarding_complete: false })
      .eq('id', user.id);

    toast.success('All data cleared');
    await refreshProfile();
    setDeleting(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display">Settings</h1>
          <p className="text-muted-foreground">Manage your profile and account</p>
        </div>

        {/* Strike Warning */}
        <StrikeWarning />

        {/* Profile Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ''} disabled className="mt-1 bg-muted" />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Background & Demographics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> Background & Demographics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Country of Origin</Label>
                <Input value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} placeholder="e.g. India" className="mt-1" />
              </div>
              <div>
                <Label>Country of Graduation</Label>
                <Input value={countryOfGraduation} onChange={(e) => setCountryOfGraduation(e.target.value)} placeholder="e.g. India" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Medical College</Label>
                <Input value={medicalCollege} onChange={(e) => setMedicalCollege(e.target.value)} placeholder="College name" className="mt-1" />
              </div>
              <div>
                <Label>Graduation Year</Label>
                <Input type="number" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} placeholder="e.g. 2020" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Current Location</Label>
              <Input value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)} placeholder="City, Country" className="mt-1" />
            </div>
            <div>
              <Label>AMC Exam Stage</Label>
              <Select value={examStage} onValueChange={setExamStage}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="booked">Booked Exam</SelectItem>
                  <SelectItem value="retaking">Retaking Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Exam Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> Exam Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Target Exam Date</Label>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Candidate Type</Label>
              <Select value={userType} onValueChange={setUserType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="img">International Medical Graduate (IMG)</SelectItem>
                  <SelectItem value="local">Local Graduate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Exam Preparing For</Label>
              <Select value={examTarget} onValueChange={setExamTarget}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amc_mcq">AMC MCQ (CAT)</SelectItem>
                  <SelectItem value="amc_clinical">AMC Clinical</SelectItem>
                  <SelectItem value="plab">PLAB</SelectItem>
                  <SelectItem value="usmle">USMLE</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {examTarget === 'amc_clinical' && (
              <>
                <div>
                  <Label>AMC MCQ Score (if passed)</Label>
                  <Input
                    type="number"
                    value={amc1Score}
                    onChange={(e) => setAmc1Score(e.target.value)}
                    placeholder="e.g. 250"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>AMC Clinical Booking Status</Label>
                  <Select value={amc2BookingStatus} onValueChange={setAmc2BookingStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="not_yet">Not Yet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {amc2BookingStatus === 'booked' && (
                  <div>
                    <Label>Exam Location</Label>
                    <Input
                      value={examLocation}
                      onChange={(e) => setExamLocation(e.target.value)}
                      placeholder="e.g. Melbourne, Sydney"
                      className="mt-1"
                    />
                  </div>
                )}
              </>
            )}

            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={handleSignOut} className="w-full justify-start gap-2">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div className="text-sm font-medium text-destructive">Danger Zone</div>
              <p className="text-xs text-muted-foreground">
                This will permanently delete all your practice data, performance profiles, bookmarks, and notes. Your account will remain.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-3.5 w-3.5" /> Delete All My Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your practice attempts, performance data, bookmarks, notes, and study plans. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteData}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? 'Deleting…' : 'Delete Everything'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Legal & Policies */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> Legal & Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-1.5 text-[11px] text-foreground/85">
              <Link to="/terms" className="text-primary underline hover:text-primary/80">Terms of Service</Link>
              <Link to="/terms" className="text-primary underline hover:text-primary/80">Privacy Policy</Link>
            </div>
            <p className="text-[11px] text-foreground/85 leading-[1.4]">
              All Zyntra content is protected under the Copyright Act 1968 (Cth). Unauthorized copying, redistribution, or sharing of content is prohibited and may result in account suspension.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              For account issues, copyright questions, or legal inquiries, contact:{' '}
              <a href={`mailto:${LEGAL_EMAIL}`} className="text-primary underline">{LEGAL_EMAIL}</a>
            </p>
          </CardContent>
        </Card>

        {/* Referral */}
        <ReferralCard />

        {/* About */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" /> About
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Zyntra AMC — v1.0.0</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

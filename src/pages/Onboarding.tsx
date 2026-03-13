import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const userTypes = [
  { value: 'first-timer', label: 'First-Time Candidate', desc: 'Taking the AMC for the first time' },
  { value: 'repeat', label: 'Repeat Candidate', desc: 'Retaking the AMC exam' },
  { value: 'img', label: 'International Medical Graduate', desc: 'IMG pathway candidate' },
];

const examTargets = [
  { value: 'amc_mcq', label: 'AMC MCQ (CAT)' },
  { value: 'amc_clinical', label: 'AMC Clinical' },
  { value: 'plab', label: 'PLAB' },
  { value: 'usmle', label: 'USMLE' },
  { value: 'other', label: 'Other' },
];

const medicalCategories = [
  'Cardiovascular', 'Respiratory', 'Gastrointestinal', 'Neurology',
  'Musculoskeletal', 'Endocrinology', 'Renal', 'Haematology',
  'Infectious Disease', 'Psychiatry', 'Obstetrics & Gynaecology',
  'Paediatrics', 'Dermatology', 'Ophthalmology', 'ENT',
  'Emergency Medicine', 'Pharmacology', 'Ethics & Law',
];

export default function Onboarding() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [userType, setUserType] = useState('');
  const [examTarget, setExamTarget] = useState('');
  const [passedMcq, setPassedMcq] = useState<'yes' | 'no' | 'preparing' | ''>('');
  const [amc1Score, setAmc1Score] = useState('');
  const [amc2BookingStatus, setAmc2BookingStatus] = useState('');
  const [examLocation, setExamLocation] = useState('');
  const [weakAreas, setWeakAreas] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.onboarding_complete) return <Navigate to="/dashboard" replace />;

  const toggleWeakArea = (area: string) => {
    setWeakAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name,
          exam_date: examDate || null,
          user_type: userType,
          exam_target: examTarget || null,
          amc1_score: passedMcq === 'yes' && amc1Score ? parseInt(amc1Score) : null,
          amc2_booking_status: examTarget === 'amc_clinical' ? (amc2BookingStatus || null) : null,
          exam_location: amc2BookingStatus === 'booked' ? (examLocation || null) : null,
          weak_areas: weakAreas,
          onboarding_complete: true,
        } as any)
        .eq('id', session.user.id);
      if (error) throw error;
      await refreshProfile();
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = [
    name.trim().length > 0,     // Step 0: name
    userType.length > 0,        // Step 1: journey
    true,                       // Step 2: exam target (optional)
    true,                       // Step 3: weak areas (optional)
  ][step];

  const totalSteps = 4;

  const steps = [
    // Step 0: Name & Exam Date
    <div key="0" className="space-y-4">
      <div className="space-y-2">
        <Label>Full Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Smith" />
      </div>
      <div className="space-y-2">
        <Label>Exam Date (optional)</Label>
        <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
      </div>
    </div>,

    // Step 1: User Type
    <div key="1" className="space-y-3">
      {userTypes.map((t) => (
        <button
          key={t.value}
          onClick={() => setUserType(t.value)}
          className={cn(
            'w-full rounded-lg border p-4 text-left transition-all',
            userType === t.value
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
              : 'border-border hover:border-primary/30'
          )}
        >
          <div className="font-medium">{t.label}</div>
          <div className="text-sm text-muted-foreground">{t.desc}</div>
        </button>
      ))}
    </div>,

    // Step 2: Exam Target
    <div key="2" className="space-y-4">
      <div className="space-y-2">
        <Label>Exam Preparing For</Label>
        <Select value={examTarget} onValueChange={setExamTarget}>
          <SelectTrigger>
            <SelectValue placeholder="Select exam" />
          </SelectTrigger>
          <SelectContent>
            {examTargets.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {examTarget === 'amc_clinical' && (
        <>
          <div className="space-y-2">
            <Label>Have you passed AMC MCQ?</Label>
            <div className="flex gap-2">
              {(['yes', 'no', 'preparing'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setPassedMcq(opt)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm transition-all capitalize',
                    passedMcq === opt
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {passedMcq === 'yes' && (
            <div className="space-y-2">
              <Label>AMC MCQ Score</Label>
              <Input
                type="number"
                value={amc1Score}
                onChange={(e) => setAmc1Score(e.target.value)}
                placeholder="e.g. 250"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>AMC Clinical Booking Status</Label>
            <Select value={amc2BookingStatus} onValueChange={setAmc2BookingStatus}>
              <SelectTrigger>
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
            <div className="space-y-2">
              <Label>Exam Location</Label>
              <Input
                value={examLocation}
                onChange={(e) => setExamLocation(e.target.value)}
                placeholder="e.g. Melbourne, Sydney"
              />
            </div>
          )}
        </>
      )}
    </div>,

    // Step 3: Weak Areas
    <div key="3" className="space-y-3">
      <p className="text-sm text-muted-foreground">Select areas you'd like to focus on (optional)</p>
      <div className="flex flex-wrap gap-2">
        {medicalCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => toggleWeakArea(cat)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-all',
              weakAreas.includes(cat)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/30'
            )}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>,
  ];

  const stepTitles = ['About You', 'Your Journey', 'Exam Target', 'Focus Areas'];
  const stepDescs = [
    'Tell us a bit about yourself',
    'What describes your exam journey?',
    'Which exam are you preparing for?',
    'Which areas need the most attention?',
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display">Welcome to Zyntra</h1>
          <p className="text-muted-foreground">Let's personalize your experience</p>
        </div>

        {/* Progress */}
        <div className="mb-6 flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">{stepTitles[step]}</CardTitle>
            <CardDescription>{stepDescs[step]}</CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {steps[step]}
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(step - 1)}
                disabled={step === 0}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < totalSteps - 1 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed} className="gap-1">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={submitting} className="gap-1">
                  {submitting ? 'Saving...' : 'Complete'} <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

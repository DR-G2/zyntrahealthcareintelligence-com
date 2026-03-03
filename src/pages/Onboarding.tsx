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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const userTypes = [
  { value: 'first-timer', label: 'First-Time Candidate', desc: 'Taking the AMC for the first time' },
  { value: 'repeat', label: 'Repeat Candidate', desc: 'Retaking the AMC exam' },
  { value: 'img', label: 'International Medical Graduate', desc: 'IMG pathway candidate' },
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
          weak_areas: weakAreas,
          onboarding_complete: true,
        })
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
    name.trim().length > 0,
    userType.length > 0,
    true, // weak areas optional
  ][step];

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

    // Step 2: Weak Areas
    <div key="2" className="space-y-3">
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
          {[0, 1, 2].map((i) => (
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
            <CardTitle className="font-display">
              {['About You', 'Your Journey', 'Focus Areas'][step]}
            </CardTitle>
            <CardDescription>
              {[
                'Tell us a bit about yourself',
                'What describes your exam journey?',
                'Which areas need the most attention?',
              ][step]}
            </CardDescription>
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
              {step < 2 ? (
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

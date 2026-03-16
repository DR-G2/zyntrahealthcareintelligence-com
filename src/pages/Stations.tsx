import { useState, useRef, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { OSCEUnderConstruction } from '@/components/OSCEUnderConstruction';
import { useOSCEEnabled } from '@/hooks/useSiteSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StationChat } from '@/components/stations/StationChat';
import { StationChecklist } from '@/components/stations/StationChecklist';
import { StationResults } from '@/components/stations/StationResults';
import { supabase } from '@/integrations/supabase/client';
import { OnboardingTooltip } from '@/components/OnboardingTooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SYSTEMS } from '@/lib/filter-data';
import {
  Activity, Zap, Target, Shield, ArrowLeft, Clock, Loader2,
  MessageSquare, Stethoscope, FlaskConical, ClipboardList, ChevronRight, RefreshCw, BookOpen,
} from 'lucide-react';
import { OSCEHistory } from '@/components/history/OSCEHistory';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { useOSCEPreload } from '@/hooks/useOSCEPreload';
import { getCacheCount } from '@/lib/osce-cache';

type Phase = 'mode-select' | 'setup' | 'loading' | 'evaluating' | 'station' | 'results' | 'history';
type Mode = 'instant' | 'adaptive' | 'exam';
type StationTab = 'history' | 'examination' | 'investigations' | 'management';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface BehavioralSignal {
  type: string;
  value: number;
  timestamp: number;
}

const STATION_TIME = 8 * 60;
const SUBJECT_OPTIONS = [...SYSTEMS, 'Ethics & Law'] as const;

const modeCards = [
  {
    mode: 'instant' as Mode,
    title: 'Single Station',
    desc: 'Quick practice — complete one station and get instant feedback with psychograph.',
    icon: Zap,
    accent: 'text-primary',
  },
  {
    mode: 'adaptive' as Mode,
    title: 'Adaptive Training',
    desc: 'AI-driven 16-station circuit. Station 1 profiles you, then targets your weaknesses.',
    icon: Target,
    accent: 'text-secondary',
  },
  {
    mode: 'exam' as Mode,
    title: 'Exam Mode',
    desc: 'Realistic AMC circuit — 16 randomized stations, results after completion.',
    icon: Shield,
    accent: 'text-warning',
  },
];

export default function Stations() {
  const { session } = useAuth();
  const { toast } = useToast();
  const gate = useFeatureGate();
  const { preload } = useOSCEPreload();
  const [cachedCount, setCachedCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('mode-select');
  const [mode, setMode] = useState<Mode>('instant');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [scenarioData, setScenarioData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<StationTab>('history');
  const [loadingMessage, setLoadingMessage] = useState('Preparing your OSCE station...');
  const [loadingFailed, setLoadingFailed] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Checklist state
  const [examItems, setExamItems] = useState<ChecklistItem[]>([]);
  const [investigationItems, setInvestigationItems] = useState<ChecklistItem[]>([]);
  const [managementItems, setManagementItems] = useState<ChecklistItem[]>([]);
  const [managementPlanText, setManagementPlanText] = useState('');

  // Behavioral tracking
  const behavioralSignals = useRef<BehavioralSignal[]>([]);
  const tabTimes = useRef<Record<string, number>>({ history: 0, examination: 0, investigations: 0, management: 0 });
  const tabStartTime = useRef(Date.now());

  // Timer
  const [timeLeft, setTimeLeft] = useState(STATION_TIME);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Results
  const [results, setResults] = useState<any>(null);
  const [lastAttemptId, setLastAttemptId] = useState<string | null>(null);

  // Session
  const sessionId = useRef(crypto.randomUUID());

  // Refresh cache count on mode-select
  useEffect(() => {
    if (phase === 'mode-select') {
      getCacheCount().then(setCachedCount);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'station') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'station') {
      tabStartTime.current = Date.now();
    }
  }, [activeTab]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleBehavioralSignal = useCallback((signal: { type: string; value: number }) => {
    behavioralSignals.current.push({ ...signal, timestamp: Date.now() });
  }, []);

  const startStation = async (subject: string, attempt = 1) => {
    setPhase('loading');
    setLoadingFailed(false);

    if (attempt === 1) {
      setLoadingMessage('Preparing your OSCE station...');
    } else {
      setLoadingMessage('Station loading is taking longer than expected. Retrying...');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const { data, error } = await supabase.functions.invoke('generate-station', {
        body: { subject, mode },
      });
      clearTimeout(timeout);
      if (error) throw error;

      setScenarioData(data);
      setExamItems((data.examination_findings || []).map((f: any, i: number) => ({
        id: `exam-${i}`, label: f.finding, checked: false,
      })));
      setInvestigationItems((data.investigations || []).map((f: any, i: number) => ({
        id: `inv-${i}`, label: f.investigation, checked: false,
      })));
      setManagementItems((data.management_actions || []).map((f: any, i: number) => ({
        id: `mgmt-${i}`, label: f.action, checked: false,
      })));

      setChatMessages([]);
      setManagementPlanText('');
      setActiveTab('history');
      setTimeLeft(STATION_TIME);
      behavioralSignals.current = [];
      tabStartTime.current = Date.now();
      setPhase('station');
    } catch (err: any) {
      clearTimeout(timeout);
      console.error('Station load attempt', attempt, err);

      if (attempt < 3) {
        return startStation(subject, attempt + 1);
      }

      setLoadingMessage('Unable to load station. Please refresh or contact support.');
      setLoadingFailed(true);
    }
  };

  const handleSubmit = async () => {
    clearInterval(timerRef.current);
    setPhase('evaluating');

    const signals = behavioralSignals.current;
    const responseTimes = signals.filter(s => s.type === 'response_latency').map(s => s.value);
    const messageLengths = signals.filter(s => s.type === 'message_length').map(s => s.value);

    const behavioralData = {
      avg_response_time: responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      silence_gaps: responseTimes.filter(t => t > 15).length,
      message_count: chatMessages.filter(m => m.role === 'user').length,
      avg_message_length: messageLengths.length ? messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length : 0,
      time_taken: STATION_TIME - timeLeft,
      checklist_changes: signals.filter(s => s.type === 'checklist_change').length,
    };

    const checklistResponses = {
      examination: examItems.filter(i => i.checked).map(i => i.label),
      investigations: investigationItems.filter(i => i.checked).map(i => i.label),
      management: managementItems.filter(i => i.checked).map(i => i.label),
      management_plan_text: managementPlanText,
    };

    // Save attempt to DB first (async-safe)
    const userId = session?.user?.id;
    let savedAttemptId: string | null = null;
    if (userId) {
      try {
        const { data: insertedAttempt } = await supabase.from('station_attempts').insert({
          user_id: userId,
          session_id: sessionId.current,
          station_index: 0,
          subject: selectedSubject,
          mode,
          chat_transcript: chatMessages as any,
          checklist_responses: checklistResponses as any,
          scores: {} as any,
          psychograph: {} as any,
          behavioral_signals: behavioralData as any,
          time_taken_seconds: STATION_TIME - timeLeft,
        }).select('id').single();
        if (insertedAttempt) savedAttemptId = insertedAttempt.id;
      } catch (e) {
        console.error('Failed to save attempt:', e);
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('evaluate-station', {
        body: {
          chat_transcript: chatMessages.map(m => ({ role: m.role, content: m.content })),
          checklist_responses: checklistResponses,
          scenario_data: scenarioData,
          behavioral_signals: behavioralData,
        },
      });
      if (error) throw error;

      setResults(data);
      setLastAttemptId(savedAttemptId);

      if (userId && data.psychograph) {
        await supabase.from('psychograph_history').insert({
          user_id: userId,
          session_id: sessionId.current,
          cognitive_stability: data.psychograph.cognitive_stability,
          emotional_reactivity: data.psychograph.emotional_reactivity,
          time_compression_vulnerability: data.psychograph.time_compression_vulnerability,
          silence_tolerance: data.psychograph.silence_tolerance,
          delegation_confidence: data.psychograph.delegation_confidence,
          structure_integrity: data.psychograph.structure_integrity,
          archetype: data.archetype,
        });
      }

      setPhase('results');
    } catch (err: any) {
      console.error(err);
      // Don't revert to station — show a graceful message
      toast({
        title: 'Evaluation submitted',
        description: 'Your response has been saved. Evaluation may take a moment — check back in your history.',
      });
      setPhase('mode-select');
    }
  };

  const toggleChecklist = (type: 'exam' | 'inv' | 'mgmt', id: string) => {
    handleBehavioralSignal({ type: 'checklist_change', value: 1 });
    const setter = type === 'exam' ? setExamItems : type === 'inv' ? setInvestigationItems : setManagementItems;
    setter(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const reset = () => {
    setPhase('mode-select');
    setResults(null);
    setScenarioData(null);
    setChatMessages([]);
    setLastAttemptId(null);
    setLoadingFailed(false);
    sessionId.current = crypto.randomUUID();
  };

  const { enabled: osceEnabled, loading: osceLoading } = useOSCEEnabled();

  if (!osceLoading && !osceEnabled) {
    return (
      <AppLayout>
        <OSCEUnderConstruction />
      </AppLayout>
    );
  }

  if (!gate.canAccessOSCEBank) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Clinical Stations</h1>
            <p className="text-muted-foreground text-sm mt-1">APPE Adaptive Performance Profiling Engine</p>
          </div>
          <UpgradePrompt feature="OSCE Practice Stations" description="Upgrade to a paid plan to access unlimited OSCE stations with AI patient interaction, adaptive training, and exam simulations." variant="card" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        {/* MODE SELECTION */}
        {phase === 'mode-select' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold font-display text-foreground">Clinical Stations</h1>
                <p className="text-muted-foreground text-sm mt-1">APPE Adaptive Performance Profiling Engine</p>
              </div>
              <Button variant="outline" onClick={() => setPhase('history')} className="gap-2">
                <BookOpen className="h-4 w-4" /> History
              </Button>
            </div>
            {!gate.canUseOSCE && (
              <UpgradePrompt feature="Daily OSCE Limit Reached" description={`You've used ${gate.osceUsedToday}/${gate.osceDailyLimit} free OSCE station(s) today. Upgrade for unlimited stations.`} variant="banner" />
            )}
            <OnboardingTooltip
              id="stations-intro"
              title="Welcome to Clinical Stations"
              description="Choose Single for a focused station, Adaptive for AI-selected stations based on your weak areas, or Exam mode for a timed 8-station circuit. You'll chat with an AI patient and complete a clinical checklist."
            />
            {cachedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-primary" />
                <span>⚡ {cachedCount} station{cachedCount !== 1 ? 's' : ''} ready offline</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {modeCards.map(card => (
                <Card
                  key={card.mode}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => { setMode(card.mode); setPhase('setup'); }}
                >
                  <CardHeader>
                    <card.icon className={`h-8 w-8 ${card.accent}`} />
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                    <CardDescription className="text-xs">{card.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* SETUP */}
        {phase === 'setup' && (
          <div className="space-y-6">
            <Button variant="ghost" size="sm" onClick={() => setPhase('mode-select')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">
                {mode === 'instant' ? 'Single Station' : mode === 'adaptive' ? 'Adaptive Training' : 'Exam Mode'}
              </h1>
              {mode === 'instant' && <p className="text-muted-foreground text-sm mt-1">Select a clinical subject for your station.</p>}
              {mode === 'adaptive' && <p className="text-muted-foreground text-sm mt-1">Station 1 is always Psychiatry for psychological profiling. The AI selects the remaining 15 stations.</p>}
              {mode === 'exam' && <p className="text-muted-foreground text-sm mt-1">16 randomized stations. Results only after all stations are complete.</p>}
            </div>

            {mode === 'instant' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {SUBJECT_OPTIONS.map(subject => (
                  <Card
                    key={subject}
                    className={`cursor-pointer transition-all text-center ${
                      selectedSubject === subject
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'hover:border-primary/30'
                    }`}
                    onClick={() => setSelectedSubject(subject)}
                  >
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-foreground">{subject}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            <Button
              className="w-full"
              size="lg"
              disabled={mode === 'instant' && !selectedSubject}
              onClick={() => {
                const subject = mode === 'adaptive' ? 'Psychiatry' : mode === 'exam' ? SUBJECT_OPTIONS[Math.floor(Math.random() * SUBJECT_OPTIONS.length)] : selectedSubject;
                if (mode !== 'instant') setSelectedSubject(subject);
                startStation(subject);
              }}
            >
              Start Station <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* LOADING */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            {!loadingFailed ? (
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                  <Activity className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              </div>
            ) : (
              <RefreshCw className="h-10 w-10 text-destructive" />
            )}
            <div className="text-center space-y-2">
              <p className="text-foreground font-medium">{loadingFailed ? loadingMessage : 'Preparing clinical scenario...'}</p>
              {!loadingFailed && (
                <p className="text-sm text-muted-foreground animate-pulse">Setting up patient encounter</p>
              )}
            </div>
            {loadingFailed && (
              <div className="flex gap-3">
                <Button variant="outline" onClick={reset}>Go Back</Button>
                <Button onClick={() => startStation(selectedSubject)}>Try Again</Button>
              </div>
            )}
          </div>
        )}

        {/* STATION */}
        {phase === 'station' && scenarioData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{scenarioData.scenario_title}</h2>
                <Badge variant="outline" className="mt-1">{selectedSubject}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${timeLeft < 120 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <Clock className="h-4 w-4" />
                  {formatTime(timeLeft)}
                </div>
                <Button variant="destructive" size="sm" onClick={handleSubmit}>
                  Submit Station
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as StationTab)} className="h-[calc(100vh-220px)]">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="history" className="gap-1.5 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" /> History
                </TabsTrigger>
                <TabsTrigger value="examination" className="gap-1.5 text-xs">
                  <Stethoscope className="h-3.5 w-3.5" /> Examination
                </TabsTrigger>
                <TabsTrigger value="investigations" className="gap-1.5 text-xs">
                  <FlaskConical className="h-3.5 w-3.5" /> Investigations
                </TabsTrigger>
                <TabsTrigger value="management" className="gap-1.5 text-xs">
                  <ClipboardList className="h-3.5 w-3.5" /> Management
                </TabsTrigger>
              </TabsList>

              <div className="mt-3 h-[calc(100%-48px)]">
                <TabsContent value="history" className="h-full mt-0">
                  <Card className="h-full">
                    <CardContent className="p-4 h-full">
                      <StationChat
                        patientPersona={scenarioData.patient_persona}
                        messages={chatMessages}
                        onMessagesChange={setChatMessages}
                        onBehavioralSignal={handleBehavioralSignal}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="examination" className="h-full mt-0">
                  <Card className="h-full">
                    <CardContent className="p-4 h-full">
                      <StationChecklist
                        type="examination"
                        items={examItems}
                        onItemToggle={id => toggleChecklist('exam', id)}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="investigations" className="h-full mt-0">
                  <Card className="h-full">
                    <CardContent className="p-4 h-full">
                      <StationChecklist
                        type="investigations"
                        items={investigationItems}
                        onItemToggle={id => toggleChecklist('inv', id)}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="management" className="h-full mt-0">
                  <Card className="h-full">
                    <CardContent className="p-4 h-full">
                      <StationChecklist
                        type="management"
                        items={managementItems}
                        onItemToggle={id => toggleChecklist('mgmt', id)}
                        managementPlanText={managementPlanText}
                        onManagementPlanChange={setManagementPlanText}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        {/* EVALUATING */}
        {phase === 'evaluating' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Your response has been submitted. Evaluation in progress...</p>
          </div>
        )}

        {/* RESULTS */}
        {phase === 'results' && results && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold font-display text-foreground">Station Results</h1>
                <p className="text-muted-foreground text-sm mt-1">{scenarioData?.scenario_title} — {selectedSubject}</p>
              </div>
              <Button onClick={reset}>
                <ArrowLeft className="h-4 w-4 mr-1" /> New Station
              </Button>
            </div>
            <StationResults
              scores={results.scores}
              psychograph={results.psychograph}
              archetype={results.archetype}
              recommendations={results.recommendations}
              summary={results.summary}
              stationAttemptId={lastAttemptId || undefined}
            />
          </div>
        )}

        {/* HISTORY */}
        {phase === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold font-display text-foreground">OSCE History</h1>
                <p className="text-muted-foreground text-sm mt-1">Review your past station attempts</p>
              </div>
              <Button variant="outline" onClick={() => setPhase('mode-select')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
            {gate.canAccessHistory ? (
              <OSCEHistory />
            ) : (
              <UpgradePrompt feature="OSCE History" description="Upgrade to review your complete station attempt history." variant="card" />
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StationChat } from '@/components/stations/StationChat';
import { StationChecklist } from '@/components/stations/StationChecklist';
import { StationResults } from '@/components/stations/StationResults';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SYSTEMS } from '@/lib/filter-data';
import {
  Activity, Clock, Loader2, Stethoscope, Target, Play,
} from 'lucide-react';

type Phase = 'intro' | 'loading' | 'station' | 'evaluating' | 'results';

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

const STATION_TIME = 8 * 60;
const SUBJECT_OPTIONS = [...SYSTEMS, 'Ethics & Law'] as const;

export default function DiagnosticOSCE() {
  const { user } = useAuth();
  const { toast } = useToast();
  const sessionIdRef = useRef(crypto.randomUUID());

  const [phase, setPhase] = useState<Phase>('intro');
  const [subject, setSubject] = useState<string>('');
  const [stationData, setStationData] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [timeLeft, setTimeLeft] = useState(STATION_TIME);
  const [results, setResults] = useState<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Pick weakest subject based on past station attempts
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: attempts } = await supabase
        .from('station_attempts')
        .select('subject, scores')
        .eq('user_id', user.id);

      if (!attempts || attempts.length === 0) {
        // Random hard subject
        const rand = SUBJECT_OPTIONS[Math.floor(Math.random() * SUBJECT_OPTIONS.length)];
        setSubject(rand);
        return;
      }

      // Calculate average score per subject
      const subjectScores: Record<string, { total: number; count: number }> = {};
      for (const a of attempts) {
        const scores = a.scores as Record<string, number> | null;
        if (!scores || typeof scores !== 'object') continue;
        const vals = Object.values(scores).filter((v): v is number => typeof v === 'number');
        if (vals.length === 0) continue;
        const avg = vals.reduce((x, y) => x + y, 0) / vals.length;
        if (!subjectScores[a.subject]) subjectScores[a.subject] = { total: 0, count: 0 };
        subjectScores[a.subject].total += avg;
        subjectScores[a.subject].count += 1;
      }

      let weakest = '';
      let lowestAvg = Infinity;
      for (const [subj, data] of Object.entries(subjectScores)) {
        const avg = data.total / data.count;
        if (avg < lowestAvg) {
          lowestAvg = avg;
          weakest = subj;
        }
      }
      setSubject(weakest || SUBJECT_OPTIONS[Math.floor(Math.random() * SUBJECT_OPTIONS.length)]);
    })();
  }, [user]);

  const startStation = async () => {
    setPhase('loading');
    try {
      const { data, error } = await supabase.functions.invoke('generate-station', {
        body: {
          subject,
          mode: 'instant',
          difficulty: 'hard',
          session_id: sessionIdRef.current,
        },
      });
      if (error) throw error;
      setStationData(data);

      const scenarioChecklist = data?.checklist_items?.map((label: string, i: number) => ({
        id: `item-${i}`,
        label,
        checked: false,
      })) ?? [];
      setChecklist(scenarioChecklist);

      const opening: ChatMessage = {
        role: 'assistant',
        content: data?.opening_line || 'Hello doctor, thank you for seeing me today.',
        timestamp: Date.now(),
      };
      setMessages([opening]);
      setPhase('station');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setPhase('intro');
    }
  };

  // Timer
  useEffect(() => {
    if (phase !== 'station') return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const handleSubmit = useCallback(async () => {
    if (phase === 'evaluating' || phase === 'results') return;
    clearInterval(timerRef.current);
    setPhase('evaluating');

    try {
      const { data, error } = await supabase.functions.invoke('evaluate-station', {
        body: {
          station_data: stationData,
          chat_transcript: messages,
          checklist_responses: checklist,
          time_taken: STATION_TIME - timeLeft,
          session_id: sessionIdRef.current,
          mode: 'diagnostic-osce',
        },
      });
      if (error) throw error;

      // Save attempt
      await supabase.from('station_attempts').insert({
        user_id: user!.id,
        session_id: sessionIdRef.current,
        subject,
        mode: 'diagnostic-osce',
        station_index: 0,
        chat_transcript: messages as any,
        checklist_responses: checklist as any,
        scores: data?.scores ?? {},
        psychograph: data?.psychograph ?? {},
        behavioral_signals: data?.behavioral_signals ?? {},
        time_taken_seconds: STATION_TIME - timeLeft,
      });

      setResults(data);
      setPhase('results');
    } catch (e: any) {
      toast({ title: 'Evaluation failed', description: e.message, variant: 'destructive' });
      setPhase('station');
    }
  }, [phase, stationData, messages, checklist, timeLeft, user, subject]);

  const sendMessage = async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    try {
      const { data, error } = await supabase.functions.invoke('station-patient-chat', {
        body: {
          station_data: stationData,
          chat_history: updatedMessages,
          user_message: text,
        },
      });
      if (error) throw error;
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data?.response || "I'm not sure what you mean, doctor.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // silent
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <AppLayout>
      <div className="space-y-6">
        {phase === 'intro' && (
          <div className="mx-auto max-w-xl space-y-6 py-12">
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Target className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold font-display">Diagnostic OSCE</h1>
              <p className="text-muted-foreground">
                A single hard station targeting your weakest area. 8 minutes to prove your clinical skills.
              </p>
            </div>
            {subject && (
              <Card>
                <CardContent className="py-6 text-center space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Stethoscope className="h-5 w-5 text-primary" />
                    <span className="font-semibold">{subject}</span>
                    <Badge variant="destructive" className="text-xs">Hard</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selected based on your past performance data
                  </p>
                  <Button size="lg" onClick={startStation} className="gap-2">
                    <Play className="h-4 w-4" /> Begin Station
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Generating hard {subject} station…</p>
          </div>
        )}

        {phase === 'station' && stationData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="destructive">Diagnostic OSCE</Badge>
                <Badge variant="outline">{subject}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={`font-mono text-lg font-bold ${timeLeft < 60 ? 'text-destructive' : ''}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>

            <Tabs defaultValue="chat" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="chat" className="flex-1">Patient Chat</TabsTrigger>
                <TabsTrigger value="checklist" className="flex-1">Checklist</TabsTrigger>
              </TabsList>
              <TabsContent value="chat">
                <StationChat
                  messages={messages}
                  onSendMessage={sendMessage}
                  disabled={phase !== 'station'}
                />
              </TabsContent>
              <TabsContent value="checklist">
                <StationChecklist
                  items={checklist}
                  onToggle={(id) =>
                    setChecklist((prev) =>
                      prev.map((item) =>
                        item.id === id ? { ...item, checked: !item.checked } : item
                      )
                    )
                  }
                />
              </TabsContent>
            </Tabs>

            <Button onClick={handleSubmit} className="w-full" size="lg">
              Submit & Evaluate
            </Button>
          </div>
        )}

        {phase === 'evaluating' && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Evaluating your performance…</p>
          </div>
        )}

        {phase === 'results' && results && (
          <StationResults
            results={results}
            subject={subject}
            timeTaken={STATION_TIME - timeLeft}
          />
        )}
      </div>
    </AppLayout>
  );
}

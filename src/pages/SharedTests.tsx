import { useState, useEffect } from 'react';
import { Share2, Plus, Copy, Users, Trophy, Loader2, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';

interface Participant {
  id: string;
  user_id: string;
  score: any;
  completed_at: string | null;
  joined_at: string;
  email?: string;
  name?: string;
}

interface SharedTest {
  id: string;
  code: string;
  created_by: string;
  test_type: string;
  config: any;
  status: string;
  created_at: string;
  participants: Participant[];
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function SharedTests() {
  const { user } = useAuth();
  const [tests, setTests] = useState<SharedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [testType, setTestType] = useState('mcq');
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => { if (user) loadTests(); }, [user]);

  const loadTests = async () => {
    if (!user) return;
    setLoading(true);

    // Get tests user participates in
    const { data: participations } = await supabase
      .from('shared_test_participants')
      .select('shared_test_id')
      .eq('user_id', user.id);

    const testIds = participations?.map(p => p.shared_test_id) || [];

    // Also get tests user created
    const { data: ownedTests } = await supabase
      .from('shared_tests')
      .select('*')
      .eq('created_by', user.id);

    const allTestIds = [...new Set([...testIds, ...(ownedTests?.map(t => t.id) || [])])];

    if (allTestIds.length === 0) { setTests([]); setLoading(false); return; }

    const { data: testsData } = await supabase
      .from('shared_tests')
      .select('*')
      .in('id', allTestIds)
      .order('created_at', { ascending: false });

    if (!testsData) { setTests([]); setLoading(false); return; }

    const testsWithParticipants: SharedTest[] = await Promise.all(
      testsData.map(async (t) => {
        const { data: parts } = await supabase
          .from('shared_test_participants')
          .select('*')
          .eq('shared_test_id', t.id);

        const userIds = parts?.map(p => p.user_id) || [];
        let profiles: any[] = [];
        if (userIds.length > 0) {
          const { data: p } = await supabase.from('profiles').select('id, email, name').in('id', userIds);
          profiles = p || [];
        }

        return {
          ...t,
          participants: (parts || []).map(p => {
            const profile = profiles.find(pr => pr.id === p.user_id);
            return { ...p, email: profile?.email, name: profile?.name };
          }),
        };
      })
    );

    setTests(testsWithParticipants);
    setLoading(false);
  };

  const createTest = async () => {
    if (!user) return;
    setCreating(true);

    const code = generateCode();
    const { data: test, error } = await supabase
      .from('shared_tests')
      .insert({ code, created_by: user.id, test_type: testType, config: { question_count: 20 } })
      .select()
      .single();

    if (error) { toast.error('Failed to create test'); setCreating(false); return; }

    // Add creator as participant
    await supabase.from('shared_test_participants').insert({
      shared_test_id: test.id, user_id: user.id,
    });

    toast.success(`Test created! Code: ${code}`);
    setShowCreate(false);
    setCreating(false);
    loadTests();
  };

  const joinTest = async () => {
    if (!user || !joinCode.trim()) return;
    setJoining(true);

    const { data: test } = await supabase
      .from('shared_tests')
      .select('*')
      .eq('code', joinCode.trim().toUpperCase())
      .single();

    if (!test) { toast.error('Invalid test code'); setJoining(false); return; }
    if (test.status !== 'open') { toast.error('This test is no longer accepting participants'); setJoining(false); return; }

    const { error } = await supabase.from('shared_test_participants').insert({
      shared_test_id: test.id, user_id: user.id,
    });

    if (error) {
      if (error.code === '23505') toast.error("You've already joined this test");
      else toast.error('Failed to join test');
      setJoining(false);
      return;
    }

    toast.success('Joined test successfully!');
    setJoinCode('');
    setJoining(false);
    loadTests();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display">Shared Tests</h1>
            <p className="text-sm text-muted-foreground mt-1">Challenge friends with the same test and compare scores</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Enter code"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                className="w-32 uppercase font-mono"
                maxLength={6}
              />
              <Button variant="outline" onClick={joinTest} disabled={joining || !joinCode.trim()}>
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join'}
              </Button>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Create Test</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Shared Test</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Test Type</label>
                    <Select value={testType} onValueChange={setTestType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcq">MCQ</SelectItem>
                        <SelectItem value="osce">OSCE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createTest} disabled={creating} className="w-full">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Generate Test Code
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <ListSkeleton items={2} />
        ) : tests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Share2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg">No Shared Tests</h3>
              <p className="text-sm text-muted-foreground mt-1">Create a test or enter a friend's code to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tests.map(test => (
              <Card key={test.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      {test.test_type.toUpperCase()} Test
                      <Badge variant={test.status === 'open' ? 'default' : 'secondary'} className="text-[10px]">
                        {test.status === 'open' ? 'Open' : 'Closed'}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyCode(test.code)} className="font-mono">
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        {test.code}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {test.participants.length} participant{test.participants.length !== 1 ? 's' : ''}
                      <span className="mx-1">·</span>
                      <Clock className="h-4 w-4" />
                      {new Date(test.created_at).toLocaleDateString()}
                    </div>

                    {/* Leaderboard */}
                    <div className="space-y-1.5">
                      {test.participants
                        .sort((a, b) => {
                          const scoreA = a.score?.total ?? -1;
                          const scoreB = b.score?.total ?? -1;
                          return scoreB - scoreA;
                        })
                        .map((p, i) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                {(p.name || p.email || '?')[0].toUpperCase()}
                              </div>
                              <span className="text-sm font-medium">{p.name || p.email || 'Unknown'}</span>
                              {p.user_id === user?.id && <Badge variant="outline" className="text-[10px]">You</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              {p.completed_at ? (
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                  <span className="text-sm font-semibold">{p.score?.total ?? '—'}%</span>
                                </div>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

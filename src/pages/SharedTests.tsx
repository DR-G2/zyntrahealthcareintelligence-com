import { useState, useEffect } from 'react';
import { SYSTEMS } from '@/lib/filter-data';
import { Share2, Plus, Copy, Users, Trophy, Loader2, CheckCircle, Clock, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { ListSkeleton } from '@/components/skeletons/PageSkeleton';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradePrompt } from '@/components/UpgradePrompt';

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
  const gate = useFeatureGate();
  const [tests, setTests] = useState<SharedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [testType, setTestType] = useState('mcq');
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState('20');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  useEffect(() => { if (user) { loadTests(); loadCategories(); } }, [user]);

  const loadCategories = async () => {
    const { data } = await supabase.from('questions').select('category');
    if (data) {
      const unique = [...new Set(data.map(q => q.category))].sort();
      setCategories(unique);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleSubject = (sub: string) => {
    setSelectedSubjects(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  const loadTests = async () => {
    if (!user) return;
    setLoading(true);

    const { data: participations } = await supabase
      .from('shared_test_participants')
      .select('shared_test_id')
      .eq('user_id', user.id);

    const testIds = participations?.map(p => p.shared_test_id) || [];

    const { data: ownedTests } = await supabase
      .from('shared_tests')
      .select('*')
      .eq('created_by', user.id);

    const allTestIds = [...new Set([...testIds, ...(ownedTests?.map(t => t.id) || [])])];

    if (allTestIds.length === 0) { setTests([]); setLoading(false); return; }

    const { data: testsData, error: testsError } = await supabase
      .from('shared_tests')
      .select('*')
      .in('id', allTestIds)
      .order('created_at', { ascending: false });

    if (testsError) { console.error('loadTests error:', testsError); setTests([]); setLoading(false); return; }
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
    if (testType === 'mcq' && selectedCategories.length === 0) {
      toast.error('Please select at least one topic');
      return;
    }
    if (testType === 'osce' && selectedSubjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }
    setCreating(true);

    const code = generateCode();
    const config = testType === 'mcq'
      ? { question_count: parseInt(questionCount), categories: selectedCategories }
      : { subjects: selectedSubjects };
    const { data: test, error } = await supabase
      .from('shared_tests')
      .insert({ code, created_by: user.id, test_type: testType, config })
      .select()
      .single();

    if (error) { console.error('createTest error:', error); toast.error('Failed to create test'); setCreating(false); return; }

    await supabase.from('shared_test_participants').insert({
      shared_test_id: test.id, user_id: user.id,
    });

    toast.success(`Test created! Code: ${code}`);
    setShowCreate(false);
    setCreating(false);
    setSelectedCategories([]);
    setSelectedSubjects([]);
    setQuestionCount('20');
    loadTests();
  };

  const joinTest = async () => {
    if (!user || !joinCode.trim()) return;
    setJoining(true);

    const { data: test, error: lookupError } = await supabase
      .from('shared_tests')
      .select('*')
      .eq('code', joinCode.trim().toUpperCase())
      .single();

    if (lookupError) { console.error('joinTest lookup error:', lookupError); }
    if (!test) { toast.error('Invalid test code'); setJoining(false); return; }
    if (test.status !== 'open') { toast.error('This test is no longer accepting participants'); setJoining(false); return; }

    const { error } = await supabase.from('shared_test_participants').insert({
      shared_test_id: test.id, user_id: user.id,
    });

    if (error) {
      if (error.code === '23505') toast.error("You've already joined this test");
      else { console.error('joinTest insert error:', error); toast.error('Failed to join test'); }
      setJoining(false);
      return;
    }

    toast.success('Joined test successfully!');
    setJoinCode('');
    setJoining(false);
    loadTests();
  };

  const deleteTest = async (testId: string) => {
    // Delete participants first, then the test
    await supabase.from('shared_test_participants').delete().eq('shared_test_id', testId);
    const { error } = await supabase.from('shared_tests').delete().eq('id', testId);
    if (error) { console.error('deleteTest error:', error); toast.error('Failed to delete test'); return; }
    toast.success('Test deleted');
    setTests(prev => prev.filter(t => t.id !== testId));
  };

  const shareTest = async (code: string) => {
    const message = `Join my test on Zyntra! Code: ${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Zyntra Shared Test', text: message }); } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(message);
      toast.success('Share message copied!');
    }
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
            <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) { setSelectedCategories([]); setSelectedSubjects([]); setQuestionCount('20'); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Create Test</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
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

                  {testType === 'mcq' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Topics</label>
                        <p className="text-xs text-muted-foreground">Select categories for the test</p>
                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto rounded-md border border-border p-2">
                          {categories.map(cat => (
                            <Badge
                              key={cat}
                              variant={selectedCategories.includes(cat) ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => toggleCategory(cat)}
                            >
                              {cat}
                              {selectedCategories.includes(cat) && <X className="h-3 w-3 ml-1" />}
                            </Badge>
                          ))}
                          {categories.length === 0 && (
                            <span className="text-xs text-muted-foreground">Loading categories...</span>
                          )}
                        </div>
                        {selectedCategories.length > 0 && (
                          <p className="text-xs text-muted-foreground">{selectedCategories.length} topic{selectedCategories.length !== 1 ? 's' : ''} selected</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Number of Questions</label>
                        <Select value={questionCount} onValueChange={setQuestionCount}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 questions</SelectItem>
                            <SelectItem value="20">20 questions</SelectItem>
                            <SelectItem value="30">30 questions</SelectItem>
                            <SelectItem value="50">50 questions</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {testType === 'osce' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subjects</label>
                      <p className="text-xs text-muted-foreground">Select subjects for the OSCE stations</p>
                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto rounded-md border border-border p-2">
                        {SYSTEMS.map(sub => (
                          <Badge
                            key={sub}
                            variant={selectedSubjects.includes(sub) ? 'default' : 'outline'}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleSubject(sub)}
                          >
                            {sub}
                            {selectedSubjects.includes(sub) && <X className="h-3 w-3 ml-1" />}
                          </Badge>
                        ))}
                      </div>
                      {selectedSubjects.length > 0 && (
                        <p className="text-xs text-muted-foreground">{selectedSubjects.length} subject{selectedSubjects.length !== 1 ? 's' : ''} selected</p>
                      )}
                    </div>
                  )}

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
            {tests.map(test => {
              const testCategories: string[] = test.config?.categories || [];
              const testSubjects: string[] = test.config?.subjects || [];
              const testQuestionCount = test.config?.question_count;
              const isCreator = test.created_by === user?.id;
              return (
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
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => copyCode(test.code)} className="font-mono">
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          {test.code}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => shareTest(test.code)}>
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                        {isCreator && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this test?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the test and remove all participants. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteTest(test.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    {(testCategories.length > 0 || testSubjects.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {testCategories.map(cat => (
                          <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                        ))}
                        {testSubjects.map(sub => (
                          <Badge key={sub} variant="secondary" className="text-[10px]">{sub}</Badge>
                        ))}
                        {testQuestionCount && (
                          <Badge variant="outline" className="text-[10px]">{testQuestionCount} Qs</Badge>
                        )}
                      </div>
                    )}
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
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

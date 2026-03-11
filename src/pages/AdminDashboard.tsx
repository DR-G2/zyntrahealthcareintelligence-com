import { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Upload, FileUp, X, Users, BookOpen, Activity, Pencil, Trash2, Search, ShieldAlert, Radio, ChevronDown, Zap, Brain, Monitor, FileText } from 'lucide-react';
import { PiracyStrikesTab } from '@/components/admin/PiracyStrikesTab';
import { LiveActivityTab } from '@/components/admin/LiveActivityTab';
import { AIControlTab } from '@/components/admin/AIControlTab';
import { UserInspectionPanel } from '@/components/admin/UserInspectionPanel';
import { SystemMonitorTab } from '@/components/admin/SystemMonitorTab';
import { ActivityLogsTab } from '@/components/admin/ActivityLogsTab';

const ADMIN_EMAILS = [
  "gopalrock.naren@gmail.com",
  "amc.osce.2026@gmail.com",
  "testuser123@zyntr.website",
];
const SUPER_ADMIN_EMAIL = "gopalrock.naren@gmail.com";

const CATEGORIES = [
  "Cardiology", "Respiratory", "Gastrointestinal", "Neurology", "Endocrinology",
  "Renal", "Dermatology", "Psychiatry", "Paediatrics", "Obstetrics & Gynaecology",
  "Emergency Medicine", "Infectious Diseases", "Population Health", "ENT",
  "Haematology", "Musculoskeletal", "Surgery"
];

const DIFFICULTIES = ["easy", "medium", "hard"];

const OSCE_SUBJECTS = [
  "Cardiology", "Respiratory", "Gastroenterology", "Neurology", "Endocrinology",
  "Nephrology", "Rheumatology", "Haematology", "Infectious Disease", "Dermatology",
  "Psychiatry", "Obstetrics & Gynaecology", "Paediatrics", "Surgery"
];

// ─── Users Tab ───────────────────────────────────────────────

function UsersTab({ currentUserEmail }: { currentUserEmail: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [grantDialog, setGrantDialog] = useState<{ userId: string; email: string } | null>(null);
  const [grantTier, setGrantTier] = useState("full_access");
  const [grantDuration, setGrantDuration] = useState("permanent");
  const [granting, setGranting] = useState(false);
  const [inspectUser, setInspectUser] = useState<{ id: string; email: string } | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;
  const { toast } = useToast();

  const fetchUsers = async (p = page) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-list-users', {
        body: { page: p, page_size: pageSize }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers(data.users || []);
      setTotalCount(data.total_count || 0);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(page); }, [page]);

  const filtered = users.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.email?.toLowerCase().includes(s) || u.name?.toLowerCase().includes(s) || u.id?.toLowerCase().includes(s);
  });

  const getUserTier = (u: any) => {
    if (u.override) {
      const isExpired = u.override.expires_at && new Date(u.override.expires_at) < new Date();
      if (!isExpired) return { label: u.override.tier, isManual: true };
    }
    if (u.subscription) return { label: u.subscription.product_id || 'paid', isManual: false };
    return { label: 'free', isManual: false };
  };

  const handleGrant = async () => {
    if (!grantDialog) return;
    setGranting(true);
    try {
      const durationMap: Record<string, number | null> = { '7': 7, '30': 30, 'permanent': null };
      const { data, error } = await supabase.functions.invoke('admin-grant-access', {
        body: { action: 'grant', user_id: grantDialog.userId, tier: grantTier, duration_days: durationMap[grantDuration] }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Access granted' });
      setGrantDialog(null);
      fetchUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setGranting(false);
  };

  const handleRevoke = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-grant-access', {
        body: { action: 'revoke', user_id: userId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Access revoked' });
      fetchUsers();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const downloadCSV = () => {
    const headers = ['Email', 'Name', 'Tier', 'Manual Override', 'Payment Status', 'Override Expires', 'Joined'];
    const rows = filtered.map(u => {
      const t = getUserTier(u);
      return [
        u.email || '',
        u.name || '',
        t.label,
        t.isManual ? 'Yes' : 'No',
        u.subscription?.status || 'none',
        u.override?.expires_at ? new Date(u.override.expires_at).toLocaleDateString() : '',
        new Date(u.created_at).toLocaleDateString(),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `zyntra-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" onClick={downloadCSV}>
          <FileUp className="h-4 w-4 mr-2" /> Download CSV
        </Button>
        <Button variant="outline" onClick={() => fetchUsers()} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Refresh
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Account Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => {
                const t = getUserTier(u);
                return (
                  <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setInspectUser({ id: u.id, email: u.email })}>
                    <TableCell className="font-mono text-xs">{u.email}</TableCell>
                    <TableCell>{u.name || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={t.label === 'free' ? 'secondary' : 'default'}>{t.label}</Badge>
                        {t.isManual && <Badge variant="outline" className="text-xs border-primary text-primary">Manual</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.is_banned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="outline" className="text-primary border-primary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.presence?.last_seen_at ? new Date(u.presence.last_seen_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground max-w-[100px] truncate">{u.id}</TableCell>
                    <TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {t.isManual ? (
                          <Button variant="destructive" size="sm" onClick={() => handleRevoke(u.id)}>Revoke</Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setGrantDialog({ userId: u.id, email: u.email })}>Grant</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
              )}
            </TableBody>
           </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {Math.min((page - 1) * pageSize + 1, totalCount)}–{Math.min(page * pageSize, totalCount)} of {totalCount} users
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page * pageSize >= totalCount} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>

      {/* Grant Access Dialog */}
      <Dialog open={!!grantDialog} onOpenChange={open => !open && setGrantDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Grant Access to {grantDialog?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tier</label>
              <Select value={grantTier} onValueChange={setGrantTier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_access">Full Access</SelectItem>
                  <SelectItem value="mcq_only">MCQ Only</SelectItem>
                  <SelectItem value="osce_only">OSCE Only</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Duration</label>
              <Select value={grantDuration} onValueChange={setGrantDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialog(null)}>Cancel</Button>
            <Button onClick={handleGrant} disabled={granting}>{granting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Grant Access</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserInspectionPanel
        userId={inspectUser?.id || null}
        email={inspectUser?.email}
        open={!!inspectUser}
        onOpenChange={(open) => !open && setInspectUser(null)}
        currentUserEmail={currentUserEmail}
        onUserUpdated={fetchUsers}
      />
    </div>
  );
}

// Helper to get current user email for role checks
function useCurrentUserEmail() {
  const { user } = useAuth();
  return user?.email || "";
}

// ─── MCQ Tab ─────────────────────────────────────────────────

function MCQTab() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [category, setCategory] = useState("Cardiology");
  const [difficulty, setDifficulty] = useState("medium");
  const [batchSize, setBatchSize] = useState("10");
  const [jsonInput, setJsonInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [editQ, setEditQ] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const addLog = (msg: string) => setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const fetchQuestions = async () => {
    setLoadingQ(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'list' }
      });
      if (error) throw error;
      setQuestions(data.questions || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoadingQ(false);
  };

  useEffect(() => { fetchQuestions(); }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setJsonInput(ev.target?.result as string || "");
    reader.readAsText(file);
  };

  const clearFileInput = () => {
    setJsonInput(""); setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generateBatch = async () => {
    setGenerating(true);
    addLog(`Generating ${batchSize} ${difficulty} questions for ${category}...`);
    try {
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: { category, difficulty, batch_size: parseInt(batchSize) }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      addLog(`✅ Generated ${data.count} questions`);
      toast({ title: 'Success', description: `Generated ${data.count} questions` });
      fetchQuestions();
    } catch (e: any) {
      addLog(`❌ ${e.message}`);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const generateAll = async () => {
    setBulkGenerating(true);
    addLog('Starting bulk generation...');
    let total = 0;
    for (const cat of CATEGORIES) {
      for (const diff of DIFFICULTIES) {
        addLog(`Generating 10 ${diff} for ${cat}...`);
        try {
          const { data, error } = await supabase.functions.invoke('generate-questions', {
            body: { category: cat, difficulty: diff, batch_size: 10 }
          });
          if (error) throw error;
          total += data?.count || 0;
          addLog(`✅ ${cat} (${diff}): ${data?.count}`);
        } catch (e: any) {
          addLog(`❌ ${cat} (${diff}): ${e.message}`);
          if (e.message?.includes('429')) await new Promise(r => setTimeout(r, 10000));
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    addLog(`🎉 Done! Total: ${total}`);
    toast({ title: 'Complete', description: `Generated ${total} questions` });
    fetchQuestions();
    setBulkGenerating(false);
  };

  const importQuestions = async () => {
    setImporting(true);
    try {
      const parsed = JSON.parse(jsonInput);
      const qs = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(qs)) throw new Error("Expected JSON array");
      addLog(`Importing ${qs.length} questions...`);
      const { data, error } = await supabase.functions.invoke('import-questions', { body: { questions: qs } });
      if (error) throw error;
      addLog(`✅ Imported ${data.imported}`);
      toast({ title: 'Imported', description: `${data.imported} questions` });
      setJsonInput("");
      fetchQuestions();
    } catch (e: any) {
      addLog(`❌ ${e.message}`);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  const saveQuestion = async () => {
    if (!editQ) return;
    setSaving(true);
    try {
      const { id, created_at, ...rest } = editQ;
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'update', question_id: id, question_data: rest }
      });
      if (error) throw error;
      toast({ title: 'Saved' });
      setEditQ(null);
      fetchQuestions();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const deleteQuestion = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'delete', question_id: id }
      });
      if (error) throw error;
      toast({ title: 'Deleted' });
      fetchQuestions();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const filteredQ = questions.filter(q =>
    !searchQ || q.question_text?.toLowerCase().includes(searchQ.toLowerCase()) || q.category?.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Generate */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" /> AI Generator</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Category</label>
              <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Difficulty</label>
              <Select value={difficulty} onValueChange={setDifficulty}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Batch Size</label>
              <Select value={batchSize} onValueChange={setBatchSize}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[5, 10, 15, 20].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={generateBatch} disabled={generating || bulkGenerating}>{generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Generate Batch</Button>
            <Button variant="outline" onClick={generateAll} disabled={generating || bulkGenerating}>{bulkGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Generate All (500+)</Button>
          </div>
        </CardContent>
      </Card>

      {/* Cleanup & Normalize */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Trash2 className="h-5 w-5 text-destructive" /> Clean & Normalize Questions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Removes garbage template questions, deduplicates, and normalizes all categories to match the filter system.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={cleaning}>{cleaning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Run Cleanup</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run question cleanup?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete junk/duplicate questions and normalize categories. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  setCleaning(true);
                  addLog('Running cleanup...');
                  try {
                    const { data, error } = await supabase.functions.invoke('admin-cleanup-questions');
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    const s = data.summary;
                    addLog(`✅ Cleanup complete: ${data.total_deleted} deleted (${s.garbage_deleted} garbage, ${s.template_deleted} template, ${s.duplicates_deleted} duplicates), ${s.categories_normalized} categories normalized`);
                    addLog(`📊 ${data.total_before} → ${data.total_after} questions remaining`);
                    if (data.category_distribution) {
                      addLog(`Categories: ${Object.entries(data.category_distribution).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
                    }
                    toast({ title: 'Cleanup complete', description: `${data.total_deleted} junk removed, ${s.categories_normalized} categories normalized` });
                    fetchQuestions();
                  } catch (e: any) {
                    addLog(`❌ ${e.message}`);
                    toast({ title: 'Error', description: e.message, variant: 'destructive' });
                  }
                  setCleaning(false);
                }}>Run Cleanup</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5 text-primary" /> Import JSON</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4 mr-2" /> Choose File</Button>
            {fileName && <div className="flex items-center gap-2"><Badge variant="secondary">{fileName}</Badge><Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFileInput}><X className="h-3 w-3" /></Button></div>}
          </div>
          <Textarea placeholder="Or paste JSON array..." className="min-h-[120px] font-mono text-xs" value={jsonInput} onChange={e => setJsonInput(e.target.value)} />
          <Button onClick={importQuestions} disabled={importing || !jsonInput.trim()}>{importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Import</Button>
        </CardContent>
      </Card>

      {/* Browse */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Question Bank ({questions.length})</CardTitle>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingQ ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Question</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQ.slice(0, 100).map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="text-xs max-w-[300px] truncate">{q.question_text?.slice(0, 100)}</TableCell>
                    <TableCell><Badge variant="outline">{q.category}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{q.difficulty}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(q.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditQ({ ...q })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete question?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this question and all related data.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteQuestion(q.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editQ} onOpenChange={open => !open && setEditQ(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Question</DialogTitle></DialogHeader>
          {editQ && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Question Text</label>
                <Textarea value={editQ.question_text} onChange={e => setEditQ({ ...editQ, question_text: e.target.value })} className="min-h-[100px]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={editQ.category} onValueChange={v => setEditQ({ ...editQ, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Difficulty</label>
                  <Select value={editQ.difficulty} onValueChange={v => setEditQ({ ...editQ, difficulty: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DIFFICULTIES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Correct Answer</label>
                <Input value={editQ.correct_answer} onChange={e => setEditQ({ ...editQ, correct_answer: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Options (JSON)</label>
                <Textarea value={JSON.stringify(editQ.options, null, 2)} onChange={e => { try { setEditQ({ ...editQ, options: JSON.parse(e.target.value) }); } catch {} }} className="font-mono text-xs min-h-[80px]" />
              </div>
              <div>
                <label className="text-sm font-medium">Explanation</label>
                <Textarea value={editQ.explanation || ''} onChange={e => setEditQ({ ...editQ, explanation: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditQ(null)}>Cancel</Button>
            <Button onClick={saveQuestion} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log */}
      {log.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Activity Log</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs">
              {log.map((l, i) => <div key={i} className="text-muted-foreground">{l}</div>)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── OSCE Tab ────────────────────────────────────────────────

function OSCETab() {
  const { toast } = useToast();
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchS, setSearchS] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genSubject, setGenSubject] = useState("Cardiology");
  const [importing, setImporting] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editS, setEditS] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const fetchStations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-stations', {
        body: { action: 'list' }
      });
      if (error) throw error;
      setStations(data.stations || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchStations(); }, []);

  const generateStation = async () => {
    setGenerating(true);
    addLog(`Generating OSCE station for ${genSubject}...`);
    try {
      const { data, error } = await supabase.functions.invoke('generate-station', {
        body: { subject: genSubject, mode: 'instant' }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      addLog(`✅ Generated: ${data.scenario?.scenario_title || 'Station'}`);
      toast({ title: 'Generated', description: `OSCE station for ${genSubject}` });
      fetchStations();
    } catch (e: any) {
      addLog(`❌ ${e.message}`);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setJsonInput(ev.target?.result as string || "");
    reader.readAsText(file);
  };

  const clearFileInput = () => {
    setJsonInput(""); setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const importStations = async () => {
    setImporting(true);
    try {
      const parsed = JSON.parse(jsonInput);
      const arr = Array.isArray(parsed) ? parsed : parsed.stations;
      if (!Array.isArray(arr)) throw new Error("Expected JSON array");
      addLog(`Importing ${arr.length} stations...`);
      const { data, error } = await supabase.functions.invoke('admin-manage-stations', {
        body: { action: 'import', stations: arr }
      });
      if (error) throw error;
      addLog(`✅ Imported ${data.imported}`);
      if (data.errors?.length) data.errors.forEach((e: string) => addLog(`⚠️ ${e}`));
      toast({ title: 'Imported', description: `${data.imported} stations` });
      setJsonInput("");
      fetchStations();
    } catch (e: any) {
      addLog(`❌ ${e.message}`);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setImporting(false);
  };

  const saveStation = async () => {
    if (!editS) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('admin-manage-stations', {
        body: {
          action: 'update',
          station_id: editS.id,
          station_data: {
            scenario_title: editS.scenario_title,
            subject: editS.subject,
            scenario_data: editS.scenario_data,
          }
        }
      });
      if (error) throw error;
      toast({ title: 'Saved' });
      setEditS(null);
      fetchStations();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const deleteStation = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-manage-stations', {
        body: { action: 'delete', station_id: id }
      });
      if (error) throw error;
      toast({ title: 'Deleted' });
      fetchStations();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const filteredS = stations.filter(s =>
    !searchS || s.scenario_title?.toLowerCase().includes(searchS.toLowerCase()) || s.subject?.toLowerCase().includes(searchS.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Generate */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-primary" /> Generate OSCE Station</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <label className="text-sm text-muted-foreground mb-1 block">Subject</label>
            <Select value={genSubject} onValueChange={setGenSubject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OSCE_SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button onClick={generateStation} disabled={generating}>{generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Generate Station</Button>
        </CardContent>
      </Card>

      {/* Cleanup & Normalize */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Trash2 className="h-5 w-5 text-destructive" /> Clean & Normalize Stations</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Removes garbage template stations, deduplicates, and normalizes all subjects to match the OSCE filter system.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={cleaning}>{cleaning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Run Cleanup</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run station cleanup?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete junk/duplicate stations and normalize subjects. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  setCleaning(true);
                  addLog('Running station cleanup...');
                  try {
                    const { data, error } = await supabase.functions.invoke('admin-cleanup-stations');
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    const s = data.summary;
                    addLog(`✅ Cleanup complete: ${data.total_deleted} deleted (${s.garbage_deleted} garbage, ${s.duplicates_deleted} duplicates), ${s.subjects_normalized} subjects normalized`);
                    addLog(`📊 ${data.total_before} → ${data.total_after} stations remaining`);
                    if (data.subject_distribution) {
                      addLog(`Subjects: ${Object.entries(data.subject_distribution).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
                    }
                    toast({ title: 'Cleanup complete', description: `${data.total_deleted} junk removed, ${s.subjects_normalized} subjects normalized` });
                    fetchStations();
                  } catch (e: any) {
                    addLog(`❌ ${e.message}`);
                    toast({ title: 'Error', description: e.message, variant: 'destructive' });
                  }
                  setCleaning(false);
                }}>Run Cleanup</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5 text-primary" /> Import Stations (JSON)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Expected format:</p>
            <pre className="overflow-x-auto">{`[{
  "subject": "Cardiology",
  "scenario_title": "Acute MI Presentation",
  "scenario_data": { "patient_persona": {...}, "checklist": {...} }
}]`}</pre>
          </div>
          <div className="flex items-center gap-3">
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4 mr-2" /> Choose File</Button>
            {fileName && <div className="flex items-center gap-2"><Badge variant="secondary">{fileName}</Badge><Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFileInput}><X className="h-3 w-3" /></Button></div>}
          </div>
          <Textarea placeholder="Or paste JSON..." className="min-h-[120px] font-mono text-xs" value={jsonInput} onChange={e => setJsonInput(e.target.value)} />
          <Button onClick={importStations} disabled={importing || !jsonInput.trim()}>{importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Import</Button>
        </CardContent>
      </Card>

      {/* Browse */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Station Bank ({stations.length})</CardTitle>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchS} onChange={e => setSearchS(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredS.slice(0, 100).map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{s.scenario_title || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{s.subject}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditS({ ...s })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete station?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this OSCE station.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteStation(s.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editS} onOpenChange={open => !open && setEditS(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Station</DialogTitle></DialogHeader>
          {editS && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input value={editS.scenario_title} onChange={e => setEditS({ ...editS, scenario_title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Select value={editS.subject} onValueChange={v => setEditS({ ...editS, subject: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OSCE_SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
              <div>
                <label className="text-sm font-medium">Scenario Data (JSON)</label>
                <Textarea
                  value={JSON.stringify(editS.scenario_data, null, 2)}
                  onChange={e => { try { setEditS({ ...editS, scenario_data: JSON.parse(e.target.value) }); } catch {} }}
                  className="font-mono text-xs min-h-[200px]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditS(null)}>Cancel</Button>
            <Button onClick={saveStation} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log */}
      {log.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Activity Log</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs">
              {log.map((l, i) => <div key={i} className="text-muted-foreground">{l}</div>)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Cleanup Report Types ────────────────────────────────────

interface CleanupReport {
  mcq: any | null;
  osce: any | null;
}

// ─── Cleanup Report Dialog ───────────────────────────────────

function CleanupReportDialog({ report, open, onOpenChange }: { report: CleanupReport; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mcqOpen, setMcqOpen] = useState(true);
  const [osceOpen, setOsceOpen] = useState(true);

  const renderDeletedTable = (items: any[], type: 'mcq' | 'osce') => {
    if (!items?.length) return <p className="text-sm text-muted-foreground py-2">No items deleted.</p>;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50%]">{type === 'mcq' ? 'Question' : 'Station'}</TableHead>
            <TableHead>{type === 'mcq' ? 'Category' : 'Subject'}</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item: any, i: number) => (
            <TableRow key={i}>
              <TableCell className="text-xs max-w-[300px] truncate">{item.title}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{item.category || item.subject}</Badge></TableCell>
              <TableCell><Badge variant={item.reason === 'garbage' ? 'destructive' : 'secondary'} className="text-xs">{item.reason}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderNormalizedTable = (items: any[], type: 'mcq' | 'osce') => {
    if (!items?.length) return <p className="text-sm text-muted-foreground py-2">No items normalized.</p>;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">{type === 'mcq' ? 'Question' : 'Station'}</TableHead>
            <TableHead>Old</TableHead>
            <TableHead>→</TableHead>
            <TableHead>New</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item: any, i: number) => (
            <TableRow key={i}>
              <TableCell className="text-xs max-w-[250px] truncate">{item.title}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs text-destructive">{item.old_category || item.old_subject}</Badge></TableCell>
              <TableCell className="text-muted-foreground">→</TableCell>
              <TableCell><Badge variant="outline" className="text-xs text-primary">{item.new_category || item.new_subject}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderDistribution = (dist: Record<string, number> | undefined) => {
    if (!dist) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
          <Badge key={k} variant="secondary" className="text-xs">{k}: {v}</Badge>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Full Cleanup Report</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* MCQ Section */}
            {report.mcq && (
              <Collapsible open={mcqOpen} onOpenChange={setMcqOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between text-left font-semibold text-base">
                    <span>📝 MCQ Report — {report.mcq.total_deleted} deleted, {report.mcq.summary?.categories_normalized || 0} normalized</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${mcqOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pl-2">
                  <div className="grid grid-cols-3 gap-3">
                    <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{report.mcq.total_before}</div><div className="text-xs text-muted-foreground">Before</div></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-destructive">{report.mcq.total_deleted}</div><div className="text-xs text-muted-foreground">Deleted</div></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-primary">{report.mcq.total_after}</div><div className="text-xs text-muted-foreground">After</div></CardContent></Card>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Garbage: {report.mcq.summary?.garbage_deleted || 0} · Template: {report.mcq.summary?.template_deleted || 0} · Duplicates: {report.mcq.summary?.duplicates_deleted || 0} · Normalized: {report.mcq.summary?.categories_normalized || 0}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Deleted Items</h4>
                    {renderDeletedTable(report.mcq.deleted_items, 'mcq')}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Normalized Categories</h4>
                    {renderNormalizedTable(report.mcq.normalized_items, 'mcq')}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Final Distribution</h4>
                    {renderDistribution(report.mcq.category_distribution)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* OSCE Section */}
            {report.osce && (
              <Collapsible open={osceOpen} onOpenChange={setOsceOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between text-left font-semibold text-base">
                    <span>🏥 OSCE Report — {report.osce.total_deleted} deleted, {report.osce.summary?.subjects_normalized || 0} normalized</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${osceOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pl-2">
                  <div className="grid grid-cols-3 gap-3">
                    <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold">{report.osce.total_before}</div><div className="text-xs text-muted-foreground">Before</div></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-destructive">{report.osce.total_deleted}</div><div className="text-xs text-muted-foreground">Deleted</div></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><div className="text-2xl font-bold text-primary">{report.osce.total_after}</div><div className="text-xs text-muted-foreground">After</div></CardContent></Card>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Garbage: {report.osce.summary?.garbage_deleted || 0} · Duplicates: {report.osce.summary?.duplicates_deleted || 0} · Normalized: {report.osce.summary?.subjects_normalized || 0}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Deleted Items</h4>
                    {renderDeletedTable(report.osce.deleted_items, 'osce')}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Normalized Subjects</h4>
                    {renderNormalizedTable(report.osce.normalized_items, 'osce')}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Final Distribution</h4>
                    {renderDistribution(report.osce.subject_distribution)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────

export default function AdminDashboard() {
  const [fullCleaning, setFullCleaning] = useState(false);
  const [cleanupReport, setCleanupReport] = useState<CleanupReport>({ mcq: null, osce: null });
  const [reportOpen, setReportOpen] = useState(false);
  const [adminOnline, setAdminOnline] = useState<{ email: string; role: string; online: boolean }[]>([]);
  const { toast } = useToast();
  const currentUserEmail = useCurrentUserEmail();
  const isSuperAdmin = currentUserEmail === SUPER_ADMIN_EMAIL;

  // Fetch admin online status
  useEffect(() => {
    const fetchAdminPresence = async () => {
      try {
        const { data: presenceData } = await supabase
          .from('user_presence')
          .select('user_id, last_seen_at, is_online');
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email');

        const emailMap: Record<string, string> = {};
        (profiles || []).forEach(p => { if (p.email) emailMap[p.id] = p.email; });

        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const adminRoleMap: Record<string, string> = {
          'gopalrock.naren@gmail.com': 'Super Admin',
          'amc.osce.2026@gmail.com': 'Admin',
          'testuser123@zyntr.website': 'Admin',
        };

        const result = ADMIN_EMAILS.map(email => {
          const userId = Object.entries(emailMap).find(([, e]) => e === email)?.[0];
          const presence = (presenceData || []).find(p => p.user_id === userId);
          const isOnline = presence?.last_seen_at ? new Date(presence.last_seen_at) > fiveMinAgo : false;
          return { email, role: adminRoleMap[email] || 'Admin', online: isOnline };
        });
        setAdminOnline(result);
      } catch { /* silent */ }
    };
    fetchAdminPresence();
    const interval = setInterval(fetchAdminPresence, 30000);
    return () => clearInterval(interval);
  }, []);

  const runFullCleanup = async () => {
    setFullCleaning(true);
    try {
      const [mcqRes, osceRes] = await Promise.all([
        supabase.functions.invoke('admin-cleanup-questions'),
        supabase.functions.invoke('admin-cleanup-stations'),
      ]);
      if (mcqRes.error) throw mcqRes.error;
      if (osceRes.error) throw osceRes.error;
      if (mcqRes.data?.error) throw new Error(mcqRes.data.error);
      if (osceRes.data?.error) throw new Error(osceRes.data.error);

      const report = { mcq: mcqRes.data, osce: osceRes.data };
      setCleanupReport(report);
      setReportOpen(true);

      const totalDeleted = (mcqRes.data.total_deleted || 0) + (osceRes.data.total_deleted || 0);
      const totalNormalized = (mcqRes.data.summary?.categories_normalized || 0) + (osceRes.data.summary?.subjects_normalized || 0);
      toast({ title: 'Full cleanup complete', description: `${totalDeleted} items deleted, ${totalNormalized} normalized` });
    } catch (e: any) {
      toast({ title: 'Cleanup failed', description: e.message, variant: 'destructive' });
    }
    setFullCleaning(false);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl py-8 space-y-6">
        <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>

        {/* Admins Online Panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admins Online</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 pt-0">
            {adminOnline.map(a => (
              <div key={a.email} className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${a.online ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                <span className="font-mono text-xs">{a.email}</span>
                <Badge variant="outline" className="text-[10px]">{a.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Full Cleanup Card — Super Admin only */}
        {isSuperAdmin && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Run Full Cleanup</h3>
                <p className="text-sm text-muted-foreground">Clean & normalize both MCQ questions and OSCE stations in one go.</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={fullCleaning}>{fullCleaning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Run Full Cleanup</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Run full cleanup on MCQ + OSCE?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete junk/duplicate questions AND stations. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={runFullCleanup}>Run Full Cleanup</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}

        <CleanupReportDialog report={cleanupReport} open={reportOpen} onOpenChange={setReportOpen} />

        <Tabs defaultValue="live">
          <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-8' : 'grid-cols-5'}`}>
            <TabsTrigger value="live" className="gap-2"><Radio className="h-4 w-4" /> Activity</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Users</TabsTrigger>
            <TabsTrigger value="mcq" className="gap-2"><BookOpen className="h-4 w-4" /> MCQ</TabsTrigger>
            <TabsTrigger value="osce" className="gap-2"><Activity className="h-4 w-4" /> OSCE</TabsTrigger>
            <TabsTrigger value="strikes" className="gap-2"><ShieldAlert className="h-4 w-4" /> Strikes</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="ai-core" className="gap-2"><Brain className="h-4 w-4" /> AI Core</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="system" className="gap-2"><Zap className="h-4 w-4" /> System</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="logs" className="gap-2"><FileText className="h-4 w-4" /> Logs</TabsTrigger>}
          </TabsList>
          <TabsContent value="live"><LiveActivityTab /></TabsContent>
          <TabsContent value="users"><UsersTab currentUserEmail={currentUserEmail} /></TabsContent>
          <TabsContent value="mcq"><MCQTab /></TabsContent>
          <TabsContent value="osce"><OSCETab /></TabsContent>
          <TabsContent value="strikes"><PiracyStrikesTab /></TabsContent>
          {isSuperAdmin && <TabsContent value="ai-core"><AIControlTab /></TabsContent>}
          {isSuperAdmin && <TabsContent value="system"><SystemMonitorTab /></TabsContent>}
          {isSuperAdmin && <TabsContent value="logs"><ActivityLogsTab /></TabsContent>}
        </Tabs>
      </div>
    </AppLayout>
  );
}

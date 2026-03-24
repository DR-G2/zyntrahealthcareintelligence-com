import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, Check, X, GripVertical, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Subject { id: string; name: string; display_order: number; }
interface Subtopic { id: string; name: string; subject_id: string; display_order: number; }
interface SubtopicManagerProps { subjects: Subject[]; onRefresh: () => void; }

export function SubtopicManager({ subjects, onRefresh }: SubtopicManagerProps) {
  const { toast } = useToast();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingQns, setDeletingQns] = useState<string | null>(null);

  useEffect(() => {
    if (subjects.length && !selectedSubjectId) setSelectedSubjectId(subjects[0].id);
  }, [subjects, selectedSubjectId]);

  useEffect(() => { if (selectedSubjectId) fetchSubtopics(); }, [selectedSubjectId]);

  const fetchSubtopics = async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'manage_subtopic', subtopic_action: 'list', subject_id: selectedSubjectId }
      });
      if (error) throw error;
      setSubtopics(data?.subtopics || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const addSubtopic = async () => {
    if (!newName.trim() || !selectedSubjectId) return;
    setAdding(true);
    try {
      const maxOrder = Math.max(0, ...subtopics.map(s => s.display_order));
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'manage_subtopic', subtopic_action: 'add', subtopic_name: newName.trim(), subject_id: selectedSubjectId, display_order: maxOrder + 1 }
      });
      if (error) throw error;
      setNewName('');
      toast({ title: 'Subtopic added' });
      fetchSubtopics();
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const renameSubtopic = async (id: string) => {
    if (!editName.trim()) { setEditingId(null); return; }
    try {
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'manage_subtopic', subtopic_action: 'rename', subtopic_id: id, subtopic_name: editName.trim() }
      });
      if (error) throw error;
      toast({ title: 'Subtopic renamed' });
      setEditingId(null);
      fetchSubtopics();
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const deleteSubtopic = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'manage_subtopic', subtopic_action: 'delete', subtopic_id: id }
      });
      if (error) throw error;
      toast({ title: 'Subtopic deleted' });
      fetchSubtopics();
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const deleteAllQuestions = async (subtopicName: string) => {
    setDeletingQns(subtopicName);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'delete_by_subtopic', subtopic_name: subtopicName }
      });
      if (error) throw error;
      toast({ title: `Deleted ${data?.deleted_count || 0} questions from "${subtopicName}"` });
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setDeletingQns(null);
  };

  const selectedSubjectName = subjects.find(s => s.id === selectedSubjectId)?.name || '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manage Subtopics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
          <SelectTrigger><SelectValue placeholder="Select subject…" /></SelectTrigger>
          <SelectContent>
            {subjects.sort((a, b) => a.display_order - b.display_order).map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            placeholder={`New subtopic under ${selectedSubjectName}...`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubtopic()}
          />
          <Button onClick={addSubtopic} disabled={adding || !newName.trim() || !selectedSubjectId} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {subtopics.length === 0 && selectedSubjectId && (
              <p className="text-sm text-muted-foreground text-center py-3">No subtopics yet</p>
            )}
            {subtopics.sort((a, b) => a.display_order - b.display_order).map(st => (
              <div key={st.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                {editingId === st.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-7 text-sm flex-1"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && renameSubtopic(st.id)}
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => renameSubtopic(st.id)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm flex-1">{st.name}</span>
                    <Badge variant="outline" className="text-[10px]">{st.display_order}</Badge>
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => { setEditingId(st.id); setEditName(st.name); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>

                    {/* Delete all questions in subtopic */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-orange-500" title="Delete all questions in this subtopic">
                          <AlertTriangle className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>🗑 Delete ALL questions in "{st.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete every question with subtopic "{st.name}" including all related bookmarks, notes, and attempts. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteAllQuestions(st.name)}
                            disabled={deletingQns === st.name}
                          >
                            {deletingQns === st.name ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Confirm Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Delete subtopic + all its questions */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>🗑 Delete "{st.name}" and ALL its questions?</AlertDialogTitle>
                          <AlertDialogDescription>This will delete the subtopic entry AND permanently delete every question under "{st.name}" including all related data. This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                              await deleteAllQuestions(st.name);
                              await deleteSubtopic(st.id);
                            }}
                          >Confirm Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

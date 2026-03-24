import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, Check, X, GripVertical, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Subject {
  id: string;
  name: string;
  display_order: number;
}

interface SubjectManagerProps {
  subjects: Subject[];
  onRefresh: () => void;
}

export function SubjectManager({ subjects, onRefresh }: SubjectManagerProps) {
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingQns, setDeletingQns] = useState<string | null>(null);

  const addSubject = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const maxOrder = Math.max(0, ...subjects.map(s => s.display_order));
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'manage_subject', subject_action: 'add', subject_name: newName.trim(), display_order: maxOrder + 1 }
      });
      if (error) throw error;
      setNewName('');
      toast({ title: 'Subject added' });
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const renameSubject = async (id: string, oldName: string) => {
    if (!editName.trim() || editName === oldName) { setEditingId(null); return; }
    try {
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'manage_subject', subject_action: 'rename', subject_id: id, old_name: oldName, new_name: editName.trim() }
      });
      if (error) throw error;
      toast({ title: 'Subject renamed' });
      setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const deleteSubject = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'manage_subject', subject_action: 'delete', subject_id: id }
      });
      if (error) throw error;
      toast({ title: 'Subject deleted' });
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const deleteAllQuestions = async (subjectName: string) => {
    setDeletingQns(subjectName);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-questions', {
        body: { action: 'delete_by_subject', subject_name: subjectName }
      });
      if (error) throw error;
      toast({ title: `Deleted ${data?.deleted_count || 0} questions from "${subjectName}"` });
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setDeletingQns(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manage Subjects</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="New subject name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubject()}
          />
          <Button onClick={addSubject} disabled={adding || !newName.trim()} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {subjects.sort((a, b) => a.display_order - b.display_order).map(s => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
              {editingId === s.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && renameSubject(s.id, s.name)}
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => renameSubject(s.id, s.name)}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm flex-1">{s.name}</span>
                  <Badge variant="outline" className="text-[10px]">{s.display_order}</Badge>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => { setEditingId(s.id); setEditName(s.name); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>

                  {/* Delete all questions in subject */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-orange-500" title="Delete all questions in this subject">
                        <AlertTriangle className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>🗑 Delete ALL questions in "{s.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete every question categorised under "{s.name}" including all related bookmarks, notes, and attempts. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteAllQuestions(s.name)}
                          disabled={deletingQns === s.name}
                        >
                          {deletingQns === s.name ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Confirm Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Delete subject + all its questions */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>🗑 Delete "{s.name}" and ALL its questions?</AlertDialogTitle>
                        <AlertDialogDescription>This will delete the subject entry AND permanently delete every question under "{s.name}" including all related data. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={async () => {
                            await deleteAllQuestions(s.name);
                            await deleteSubject(s.id);
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
      </CardContent>
    </Card>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, MessageCircle, ArrowLeft, Plus, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Thread {
  id: string;
  admin_id: string;
  candidate_id: string;
  admin_email: string;
  candidate_email: string | null;
  subject: string;
  created_at: string;
  updated_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  thread_id: string;
  sender_role: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export function MessagesTab() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeEmail, setComposeEmail] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchThreads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-send-message', {
        body: { action: 'list_threads' },
      });
      if (error) throw error;
      setThreads(data.threads || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { fetchThreads(); }, []);

  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-send-message', {
        body: { action: 'get_messages', thread_id: thread.id },
      });
      if (error) throw error;
      setMessages(data.messages || []);
      // Update unread count locally
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread_count: 0 } : t));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoadingMessages(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel('admin-messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_messages' }, (payload) => {
        const newMsg = payload.new as Message;
        if (selectedThread && newMsg.thread_id === selectedThread.id) {
          setMessages(prev => [...prev, newMsg]);
        }
        // Refresh threads for unread counts
        fetchThreads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedThread]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedThread) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('admin-send-message', {
        body: { candidate_id: selectedThread.candidate_id, content: replyText.trim() },
      });
      if (error) throw error;
      setReplyText('');
      // Refresh messages
      await openThread(selectedThread);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSending(false);
  };

  const handleCompose = async () => {
    if (!composeEmail.trim() || !composeContent.trim()) return;
    setComposeSending(true);
    try {
      // Look up candidate by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', composeEmail.trim())
        .maybeSingle();
      if (!profile) throw new Error('User not found with that email');

      const { data, error } = await supabase.functions.invoke('admin-send-message', {
        body: { candidate_id: profile.id, content: composeContent.trim(), subject: composeSubject.trim() || undefined },
      });
      if (error) throw error;
      toast({ title: 'Message sent' });
      setComposeOpen(false);
      setComposeEmail('');
      setComposeSubject('');
      setComposeContent('');
      fetchThreads();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setComposeSending(false);
  };

  // Thread view
  if (selectedThread) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h3 className="font-semibold text-sm">{selectedThread.candidate_email || 'Unknown'}</h3>
            <p className="text-xs text-muted-foreground">{selectedThread.subject}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] p-4">
              {loadingMessages ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No messages yet</p>
              ) : (
                <div className="space-y-3">
                  {messages.map(msg => (
                    <div key={msg.id} className={cn('flex', msg.sender_role === 'admin' ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                        msg.sender_role === 'admin'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      )}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className={cn(
                          'text-[10px] mt-1',
                          msg.sender_role === 'admin' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                        )}>
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Textarea
            placeholder="Type a reply..."
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            className="min-h-[60px]"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
          />
          <Button onClick={sendReply} disabled={sending || !replyText.trim()} className="self-end">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // Thread list view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Message Threads</h3>
        <Button onClick={() => setComposeOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Message</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : threads.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No message threads yet. Send your first message to a candidate.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {threads.map(thread => (
            <Card
              key={thread.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => openThread(thread)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{thread.candidate_email || 'Unknown'}</p>
                    {thread.unread_count > 0 && (
                      <Badge variant="default" className="text-[10px] px-1.5">{thread.unread_count}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{thread.subject}</p>
                </div>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                  {new Date(thread.updated_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Candidate Email</label>
              <Input placeholder="user@example.com" value={composeEmail} onChange={e => setComposeEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Subject (optional)</label>
              <Input placeholder="Subject" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <Textarea placeholder="Type your message..." value={composeContent} onChange={e => setComposeContent(e.target.value)} className="min-h-[100px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button onClick={handleCompose} disabled={composeSending || !composeEmail.trim() || !composeContent.trim()}>
              {composeSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

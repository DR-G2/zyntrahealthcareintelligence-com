import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Send, ArrowLeft, Mail, Inbox as InboxIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Thread {
  id: string;
  subject: string;
  admin_email: string;
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

export default function Inbox() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchThreads = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_message_threads' as any)
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const threadList = (data || []) as any[];

      // Get unread counts
      const threadIds = threadList.map((t: any) => t.id);
      let unreadMap: Record<string, number> = {};
      if (threadIds.length > 0) {
        const { data: unread } = await supabase
          .from('admin_messages' as any)
          .select('thread_id')
          .in('thread_id', threadIds)
          .eq('sender_role', 'admin')
          .is('read_at', null);
        for (const msg of (unread || []) as any[]) {
          unreadMap[msg.thread_id] = (unreadMap[msg.thread_id] || 0) + 1;
        }
      }

      setThreads(threadList.map((t: any) => ({ ...t, unread_count: unreadMap[t.id] || 0 })));
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
      const { data, error } = await supabase
        .from('admin_messages' as any)
        .select('*')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data || []) as any[]);

      // Mark admin messages as read
      await supabase
        .from('admin_messages' as any)
        .update({ read_at: new Date().toISOString() })
        .eq('thread_id', thread.id)
        .eq('sender_role', 'admin')
        .is('read_at', null);

      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread_count: 0 } : t));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setLoadingMessages(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_messages' }, (payload) => {
        const newMsg = payload.new as Message;
        if (selectedThread && newMsg.thread_id === selectedThread.id) {
          setMessages(prev => [...prev, newMsg]);
        }
        fetchThreads();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedThread]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedThread || !user) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from('admin_messages' as any)
        .insert({
          thread_id: selectedThread.id,
          sender_role: 'candidate',
          sender_id: user.id,
          content: replyText.trim(),
        });
      if (error) throw error;
      setReplyText('');
      await openThread(selectedThread);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setSending(false);
  };

  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          {selectedThread && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <InboxIcon className="h-6 w-6" /> Inbox
            {totalUnread > 0 && <Badge variant="default" className="text-xs">{totalUnread}</Badge>}
          </h1>
        </div>

        {selectedThread ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">{selectedThread.subject}</h3>
              <p className="text-xs text-muted-foreground">From admin</p>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px] p-4">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No messages</p>
                  ) : (
                    <div className="space-y-3">
                      {messages.map(msg => (
                        <div key={msg.id} className={cn('flex', msg.sender_role === 'candidate' ? 'justify-end' : 'justify-start')}>
                          <div className={cn(
                            'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                            msg.sender_role === 'candidate'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          )}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <p className={cn(
                              'text-[10px] mt-1',
                              msg.sender_role === 'candidate' ? 'text-primary-foreground/60' : 'text-muted-foreground'
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
        ) : (
          <>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : threads.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No messages</p>
                  <p className="text-sm">You'll see messages here when an admin contacts you.</p>
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
                          <p className={cn('text-sm truncate', thread.unread_count > 0 ? 'font-bold' : 'font-medium')}>
                            {thread.subject}
                          </p>
                          {thread.unread_count > 0 && (
                            <Badge variant="default" className="text-[10px] px-1.5">{thread.unread_count}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">From admin</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                        {new Date(thread.updated_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Loader2, Plus, Trash2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { OnboardingTooltip } from '@/components/OnboardingTooltip';

type Msg = { role: 'user' | 'assistant'; content: string };

interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  updated_at: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-buddy`;

async function streamChat({ messages, onDelta, onDone, onError }: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    if (resp.status === 429) { onError('Rate limit exceeded.'); return; }
    if (resp.status === 402) { onError('AI credits exhausted.'); return; }
    onError('Failed to connect.'); return;
  }
  if (!resp.body) { onError('No response body'); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { buffer = line + '\n' + buffer; break; }
    }
  }
  onDone();
}

const quickPrompts = [
  'What are the most common AMC exam topics?',
  'Explain the approach to chest pain',
  'Key differences between Type 1 and Type 2 diabetes',
  'How to manage acute asthma in adults?',
  'Common causes of abdominal pain by quadrant',
];

export default function CompanionChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => { if (user) loadConversations(); }, [user]);

  const loadConversations = async () => {
    if (!user) return;
    setLoadingConvos(true);
    const { data } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(30);
    if (data) {
      setConversations(data.map((c: any) => ({
        id: c.id, title: c.title,
        messages: (c.messages || []) as Msg[],
        updated_at: c.updated_at,
      })));
    }
    setLoadingConvos(false);
  };

  const saveConversation = useCallback(async (msgs: Msg[], convoId: string | null) => {
    if (!user || msgs.length === 0) return convoId;
    const title = msgs[0]?.content?.slice(0, 60) || 'New conversation';
    if (convoId) {
      await supabase.from('chat_conversations').update({ messages: msgs as any, title }).eq('id', convoId);
      return convoId;
    } else {
      const { data } = await supabase.from('chat_conversations').insert({
        user_id: user.id, messages: msgs as any, title,
      }).select('id').single();
      if (data) { setActiveConvoId(data.id); return data.id; }
    }
    return convoId;
  }, [user]);

  const debouncedSave = useCallback((msgs: Msg[], convoId: string | null) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveConversation(msgs, convoId).then(newId => {
        if (newId && newId !== convoId) setActiveConvoId(newId);
      });
    }, 1000);
  }, [saveConversation]);

  const startNewChat = () => { setMessages([]); setActiveConvoId(null); };

  const loadConversation = (convo: Conversation) => {
    setMessages(convo.messages);
    setActiveConvoId(convo.id);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('chat_conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) { setMessages([]); setActiveConvoId(null); }
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    let currentConvoId = activeConvoId;

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: newMsgs,
        onDelta: upsertAssistant,
        onDone: () => {
          setIsLoading(false);
          setMessages(prev => { debouncedSave(prev, currentConvoId); return prev; });
        },
        onError: (msg) => { toast.error(msg); setIsLoading(false); },
      });
    } catch { toast.error('Failed to connect'); setIsLoading(false); }
  }, [messages, isLoading, activeConvoId, debouncedSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] gap-4">
        {/* Sidebar - conversation history */}
        <div className="hidden md:flex w-72 flex-col rounded-xl border bg-card">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-sm">Conversations</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startNewChat}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-2">
            {loadingConvos ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>
            ) : (
              <div className="space-y-1">
                {conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => loadConversation(c)}
                    className={cn(
                      'w-full text-left rounded-lg p-2.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between group',
                      activeConvoId === c.id && 'bg-primary/10 text-primary'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.title}</p>
                      <p className="text-muted-foreground mt-0.5">{c.messages.length} msgs</p>
                    </div>
                    <button onClick={(e) => deleteConversation(c.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
            <span className="font-display font-semibold">AI Study Chat</span>
          </div>
          <div className="px-5 pt-4">
            <OnboardingTooltip
              id="chat-intro"
              title="Meet your AI Study Buddy"
              description="Ask any medical or AMC-related question. Your conversations are saved in the sidebar. Try the quick prompts below to get started — responses support full markdown formatting."
            />
          </div>

          <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="max-w-lg mx-auto space-y-4 pt-12">
                <div className="text-center space-y-2">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">AMC Study Buddy</h2>
                  <p className="text-sm text-muted-foreground">Ask me anything about medical concepts, AMC exam topics, or clinical reasoning.</p>
                </div>
                <div className="grid gap-2">
                  {quickPrompts.map(q => (
                    <button key={q} onClick={() => sendMessage(q)} className="text-left rounded-lg border p-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[80%] rounded-xl px-4 py-3 text-sm',
                      msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-xl px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-4">
            <div className="flex items-end gap-2 max-w-3xl mx-auto">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a medical question..."
                className="flex-1 resize-none rounded-lg border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[42px] max-h-32"
                rows={1}
              />
              <Button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} size="icon" className="h-[42px] w-[42px] shrink-0">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Loader2, Plus, History, Trash2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Msg = { role: 'user' | 'assistant'; content: string };

interface QuestionContext {
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  category: string;
  diagnosis_explanation?: string | null;
  first_line_investigation?: string | null;
  best_treatment?: string | null;
}

interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  question_context: QuestionContext | null;
  updated_at: string;
}

interface StudyBuddyProps {
  questionContext?: QuestionContext | null;
  onClearContext?: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-buddy`;

async function streamChat({
  messages,
  context,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  context?: QuestionContext | null;
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
    body: JSON.stringify({ messages, context }),
  });

  if (!resp.ok) {
    if (resp.status === 429) { onError('Rate limit exceeded. Please wait a moment.'); return; }
    if (resp.status === 402) { onError('AI credits exhausted. Please add credits.'); return; }
    onError('Failed to connect to Study Buddy.'); return;
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
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  if (buffer.trim()) {
    for (const raw of buffer.split('\n')) {
      if (!raw || !raw.startsWith('data: ')) continue;
      const json = raw.slice(6).trim();
      if (json === '[DONE]') continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }
  onDone();
}

const quickPrompts = [
  'What are the most common AMC exam topics?',
  'Explain the approach to chest pain',
  'Key differences between Type 1 and Type 2 diabetes',
];

export function StudyBuddy({ questionContext, onClearContext }: StudyBuddyProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (questionContext && !open) {
      setOpen(true);
    }
  }, [questionContext]);

  // Load conversations on open
  useEffect(() => {
    if (open && user) {
      loadConversations();
    }
  }, [open, user]);

  const loadConversations = async () => {
    if (!user) return;
    setLoadingConvos(true);
    const { data } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (data) {
      setConversations(data.map((c: any) => ({
        id: c.id,
        title: c.title,
        messages: (c.messages || []) as Msg[],
        question_context: c.question_context as QuestionContext | null,
        updated_at: c.updated_at,
      })));
    }
    setLoadingConvos(false);
  };

  const saveConversation = useCallback(async (msgs: Msg[], convoId: string | null, ctx?: QuestionContext | null) => {
    if (!user || msgs.length === 0) return;

    const title = msgs[0]?.content?.slice(0, 50) || 'New conversation';

    if (convoId) {
      await supabase.from('chat_conversations').update({
        messages: msgs as any,
        title,
        question_context: ctx as any,
      }).eq('id', convoId);
    } else {
      const { data } = await supabase.from('chat_conversations').insert({
        user_id: user.id,
        messages: msgs as any,
        title,
        question_context: ctx as any,
      }).select('id').single();
      if (data) {
        setActiveConvoId(data.id);
        return data.id;
      }
    }
    return convoId;
  }, [user]);

  const debouncedSave = useCallback((msgs: Msg[], convoId: string | null, ctx?: QuestionContext | null) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveConversation(msgs, convoId, ctx).then(newId => {
        if (newId && newId !== convoId) setActiveConvoId(newId);
      });
    }, 1000);
  }, [saveConversation]);

  const startNewChat = () => {
    setMessages([]);
    setActiveConvoId(null);
    setShowHistory(false);
    onClearContext?.();
  };

  const loadConversation = (convo: Conversation) => {
    setMessages(convo.messages);
    setActiveConvoId(convo.id);
    setShowHistory(false);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('chat_conversations').delete().eq('id', id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) {
      setMessages([]);
      setActiveConvoId(null);
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    const currentConvoId = activeConvoId;

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
        context: questionContext,
        onDelta: upsertAssistant,
        onDone: () => {
          setIsLoading(false);
          // Save after streaming completes
          setMessages(prev => {
            debouncedSave(prev, currentConvoId, questionContext);
            return prev;
          });
        },
        onError: (msg) => { toast.error(msg); setIsLoading(false); },
      });
    } catch {
      toast.error('Failed to connect to Study Buddy');
      setIsLoading(false);
    }
  }, [messages, isLoading, questionContext, activeConvoId, debouncedSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[560px] rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-2xl">
              <div className="flex items-center gap-2">
                {showHistory && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10"
                    onClick={() => setShowHistory(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <Sparkles className="h-5 w-5" />
                <span className="font-display font-semibold text-sm">
                  {showHistory ? 'Chat History' : 'Study Buddy'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {!showHistory && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10"
                      onClick={() => setShowHistory(true)}
                      title="Chat history"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/10"
                      onClick={startNewChat}
                      title="New chat"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* History view */}
            {showHistory ? (
              <ScrollArea className="flex-1 px-3 py-3">
                {loadingConvos ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No past conversations</p>
                ) : (
                  <div className="space-y-1.5">
                    {conversations.map(c => (
                      <button
                        key={c.id}
                        onClick={() => loadConversation(c)}
                        className={cn(
                          'w-full text-left rounded-lg border p-2.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between group',
                          activeConvoId === c.id && 'border-primary/50 bg-primary/5'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-foreground">{c.title}</p>
                          <p className="text-muted-foreground mt-0.5">
                            {c.messages.length} messages · {new Date(c.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteConversation(c.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            ) : (
              <>
                {/* Context banner */}
                {questionContext && (
                  <div className="px-3 py-2 bg-accent text-accent-foreground text-xs flex items-center justify-between border-b">
                    <span className="truncate">📋 Context: {questionContext.category} question loaded</span>
                    <button
                      onClick={() => onClearContext?.()}
                      className="text-xs underline ml-2 shrink-0 hover:opacity-80"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Messages */}
                <ScrollArea className="flex-1 px-3 py-3" ref={scrollRef}>
                  {messages.length === 0 && (
                    <div className="space-y-3 pt-4">
                      <p className="text-sm text-muted-foreground text-center">
                        👋 Hi! I'm your AMC Study Buddy. Ask me anything about medical concepts.
                      </p>
                      <div className="space-y-2">
                        {quickPrompts.map((q) => (
                          <button
                            key={q}
                            onClick={() => sendMessage(q)}
                            className="w-full text-left rounded-lg border border-border p-2.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                        {questionContext && (
                          <button
                            onClick={() => sendMessage('Explain this question in detail. Why is the correct answer right, and what are the common traps?')}
                            className="w-full text-left rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-primary font-medium hover:bg-primary/10 transition-colors"
                          >
                            ✨ Explain this question in detail
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {messages.map((msg, i) => (
                      <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted text-foreground rounded-bl-sm'
                          )}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>
                    ))}
                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-xl px-3 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="border-t p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask me anything..."
                      rows={1}
                      className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={!input.trim() || isLoading}
                      onClick={() => sendMessage(input)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

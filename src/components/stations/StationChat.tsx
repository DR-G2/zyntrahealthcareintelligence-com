import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, User, Stethoscope } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface StationChatProps {
  patientPersona: any;
  messages: ChatMessage[];
  onMessagesChange: (msgs: ChatMessage[]) => void;
  onBehavioralSignal: (signal: { type: string; value: number }) => void;
  disabled?: boolean;
}

export function StationChat({ patientPersona, messages, onMessagesChange, onBehavioralSignal, disabled }: StationChatProps) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageTime = useRef<number>(Date.now());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || disabled) return;

    const now = Date.now();
    const timeSinceLastMsg = (now - lastMessageTime.current) / 1000;
    lastMessageTime.current = now;

    onBehavioralSignal({ type: 'response_latency', value: timeSinceLastMsg });
    onBehavioralSignal({ type: 'message_length', value: input.trim().split(/\s+/).length });

    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: now };
    const updated = [...messages, userMsg];
    onMessagesChange(updated);
    setInput('');
    setIsStreaming(true);

    try {
      const apiMessages = updated.map(m => ({ role: m.role, content: m.content }));
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/station-patient-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages, patient_persona: patientPersona }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error('Failed to get response');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              const assistantMsg: ChatMessage = { role: 'assistant', content: assistantContent, timestamp: Date.now() };
              onMessagesChange(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return [...prev.slice(0, -1), assistantMsg];
                }
                return [...prev, assistantMsg];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = { role: 'assistant', content: '*The patient seems distracted for a moment...*\n\n(Connection error — please try again)', timestamp: Date.now() };
      onMessagesChange([...updated, errorMsg]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 border-b border-border mb-3">
        <div className="h-8 w-8 rounded-full bg-secondary/20 flex items-center justify-center">
          <User className="h-4 w-4 text-secondary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{patientPersona?.name || 'Patient'}, {patientPersona?.age || ''}</p>
          <p className="text-xs text-muted-foreground">Presenting: {patientPersona?.presenting_complaint || 'See scenario'}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>The patient is seated and waiting.</p>
            <p className="text-xs mt-1">Begin your consultation by greeting the patient.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-4 py-2.5 text-sm">
              <span className="animate-pulse">●●●</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t border-border mt-3">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Type your question to the patient..."
          disabled={isStreaming || disabled}
          className="flex-1"
        />
        <Button onClick={sendMessage} disabled={!input.trim() || isStreaming || disabled} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

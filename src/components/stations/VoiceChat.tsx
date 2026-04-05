import { useVoiceChat } from '@/hooks/useVoiceChat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface VoiceChatProps {
  onSendMessage: (text: string) => void;
  lastAssistantMessage?: string;
  disabled?: boolean;
}

export function VoiceChat({ onSendMessage, lastAssistantMessage, disabled }: VoiceChatProps) {
  const { isListening, isSpeaking, supported, transcript, startListening, stopListening, speak, stopSpeaking } = useVoiceChat({
    onTranscript: (text) => {
      onSendMessage(text);
    },
  });

  if (!supported) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Voice not supported in this browser
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isListening ? 'destructive' : 'outline'}
        size="icon"
        onClick={isListening ? stopListening : startListening}
        disabled={disabled || isSpeaking}
        className="relative"
      >
        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {isListening && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive animate-pulse" />
        )}
      </Button>

      {lastAssistantMessage && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => isSpeaking ? stopSpeaking() : speak(lastAssistantMessage)}
          disabled={disabled}
        >
          {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      )}

      {isListening && transcript && (
        <span className="text-xs text-muted-foreground italic truncate max-w-[200px]">{transcript}</span>
      )}

      {isListening && !transcript && (
        <span className="text-xs text-muted-foreground animate-pulse">Listening...</span>
      )}
    </div>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { sendNudge } from '@/hooks/useVisitorTracking';
import { toast } from 'sonner';

const NUDGE_OPTIONS = [
  { label: "I'm stuck", emoji: '😵' },
  { label: 'Waiting for feature', emoji: '⏳' },
  { label: 'Ready to start', emoji: '🚀' },
  { label: 'Just checking', emoji: '👀' },
];

const FUN_RESPONSES = [
  "We see you 👀 — hang tight!",
  "Don't worry, we're coming! 🏃",
  "Almost ready for you 🚀",
  "Your nudge has been felt! 💪",
];

export function NudgeButton() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const visitorId = localStorage.getItem('zyntra_visitor_id') || 'unknown';

  const handleNudge = async (option: string) => {
    try {
      await sendNudge(visitorId, user?.id || null, location.pathname, option);
      setSent(true);
      const response = FUN_RESPONSES[Math.floor(Math.random() * FUN_RESPONSES.length)];
      toast.success(response);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 2000);
    } catch {
      toast.error('Failed to send nudge');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-56 rounded-xl border border-border bg-card shadow-lg p-3 space-y-2"
          >
            <p className="text-xs font-semibold text-foreground mb-2">What's on your mind?</p>
            {NUDGE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleNudge(opt.label)}
                disabled={sent}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors text-left disabled:opacity-50"
              >
                <span>{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        size="icon"
        onClick={() => setOpen(!open)}
        className="h-12 w-12 rounded-full shadow-lg relative"
        variant={open ? 'secondary' : 'default'}
      >
        {open ? <X className="h-5 w-5" /> : <Hand className="h-5 w-5" />}
        {!open && (
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background"
          />
        )}
      </Button>
    </div>
  );
}

import { useAuth } from '@/contexts/AuthContext';

const DAILY_KEY_PREFIX = 'zyntra_daily_';

function getTodayKey(feature: string): string {
  const today = new Date().toISOString().split('T')[0];
  return `${DAILY_KEY_PREFIX}${feature}_${today}`;
}

function getDailyCount(feature: string): number {
  const key = getTodayKey(feature);
  return parseInt(localStorage.getItem(key) || '0', 10);
}

function incrementDailyCount(feature: string): number {
  const key = getTodayKey(feature);
  const count = getDailyCount(feature) + 1;
  localStorage.setItem(key, String(count));
  return count;
}

export interface FeatureGate {
  isPaid: boolean;
  tier: string;
  // Limits
  mcqDailyLimit: number;
  mcqUsedToday: number;
  canUseMCQ: boolean;
  osceDailyLimit: number;
  osceUsedToday: number;
  canUseOSCE: boolean;
  promptDailyLimit: number;
  promptsUsedToday: number;
  canUsePrompt: boolean;
  questionBankLimit: number | null; // null = unlimited
  // Feature access
  canAccessAnalytics: boolean;
  canAccessBehavior: boolean;
  canAccessTrustGut: boolean;
  canAccessReadiness: boolean;
  canAccessAdaptiveOSCE: boolean;
  canAccessExamMode: boolean;
  // Actions
  recordMCQ: () => void;
  recordOSCE: () => void;
  recordPrompt: () => void;
}

export function useFeatureGate(): FeatureGate {
  const { subscription } = useAuth();
  const isPaid = subscription.subscribed;
  const tier = subscription.tier;

  const mcqUsedToday = getDailyCount('mcq');
  const osceUsedToday = getDailyCount('osce');
  const promptsUsedToday = getDailyCount('prompt');

  if (isPaid) {
    return {
      isPaid: true,
      tier,
      mcqDailyLimit: Infinity,
      mcqUsedToday,
      canUseMCQ: true,
      osceDailyLimit: Infinity,
      osceUsedToday,
      canUseOSCE: true,
      promptDailyLimit: Infinity,
      promptsUsedToday,
      canUsePrompt: true,
      questionBankLimit: null,
      canAccessAnalytics: true,
      canAccessBehavior: true,
      canAccessTrustGut: true,
      canAccessReadiness: true,
      canAccessAdaptiveOSCE: true,
      canAccessExamMode: true,
      recordMCQ: () => incrementDailyCount('mcq'),
      recordOSCE: () => incrementDailyCount('osce'),
      recordPrompt: () => incrementDailyCount('prompt'),
    };
  }

  // Free tier limits
  const MCQ_LIMIT = 20;
  const OSCE_LIMIT = 1;
  const PROMPT_LIMIT = 5;
  const QUESTION_BANK_LIMIT = 200;

  return {
    isPaid: false,
    tier: 'free',
    mcqDailyLimit: MCQ_LIMIT,
    mcqUsedToday,
    canUseMCQ: mcqUsedToday < MCQ_LIMIT,
    osceDailyLimit: OSCE_LIMIT,
    osceUsedToday,
    canUseOSCE: osceUsedToday < OSCE_LIMIT,
    promptDailyLimit: PROMPT_LIMIT,
    promptsUsedToday,
    canUsePrompt: promptsUsedToday < PROMPT_LIMIT,
    questionBankLimit: QUESTION_BANK_LIMIT,
    canAccessAnalytics: false,
    canAccessBehavior: false,
    canAccessTrustGut: false,
    canAccessReadiness: false,
    canAccessAdaptiveOSCE: false,
    canAccessExamMode: false,
    recordMCQ: () => incrementDailyCount('mcq'),
    recordOSCE: () => incrementDailyCount('osce'),
    recordPrompt: () => incrementDailyCount('prompt'),
  };
}

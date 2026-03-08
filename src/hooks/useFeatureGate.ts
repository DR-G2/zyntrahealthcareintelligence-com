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
  mcqDailyLimit: number;
  mcqUsedToday: number;
  canUseMCQ: boolean;
  osceDailyLimit: number;
  osceUsedToday: number;
  canUseOSCE: boolean;
  promptDailyLimit: number;
  promptsUsedToday: number;
  canUsePrompt: boolean;
  questionBankLimit: number | null;
  canAccessAnalytics: boolean;
  canAccessBehavior: boolean;
  canAccessTrustGut: boolean;
  canAccessReadiness: boolean;
  canAccessAdaptiveOSCE: boolean;
  canAccessExamMode: boolean;
  canSaveBookmarks: boolean;
  canAccessNotes: boolean;
  canAccessHistory: boolean;
  canAccessLearningPoints: boolean;
  recordMCQ: () => void;
  recordOSCE: () => void;
  recordPrompt: () => void;
}

const FREE_MCQ_LIMIT = 20;
const FREE_OSCE_LIMIT = 1;
const FREE_PROMPT_LIMIT = 5;
const FREE_QUESTION_BANK = 200;

export function useFeatureGate(): FeatureGate {
  const { subscription } = useAuth();
  const isPaid = subscription.subscribed;
  const tier = subscription.tier;

  const mcqUsedToday = getDailyCount('mcq');
  const osceUsedToday = getDailyCount('osce');
  const promptsUsedToday = getDailyCount('prompt');

  const record = {
    recordMCQ: () => incrementDailyCount('mcq'),
    recordOSCE: () => incrementDailyCount('osce'),
    recordPrompt: () => incrementDailyCount('prompt'),
  };

  // Full access or lifetime — everything unlimited
  if (tier === 'full_access' || tier === 'lifetime') {
    return {
      isPaid: true, tier,
      mcqDailyLimit: Infinity, mcqUsedToday, canUseMCQ: true,
      osceDailyLimit: Infinity, osceUsedToday, canUseOSCE: true,
      promptDailyLimit: Infinity, promptsUsedToday, canUsePrompt: true,
      questionBankLimit: null,
      canAccessAnalytics: true, canAccessBehavior: true, canAccessTrustGut: true,
      canAccessReadiness: true, canAccessAdaptiveOSCE: true, canAccessExamMode: true,
      canSaveBookmarks: true, canAccessNotes: true, canAccessHistory: true, canAccessLearningPoints: true,
      ...record,
    };
  }

  // MCQ Only — unlimited MCQ, free-tier OSCE
  if (tier === 'mcq_only') {
    return {
      isPaid: true, tier,
      mcqDailyLimit: Infinity, mcqUsedToday, canUseMCQ: true,
      osceDailyLimit: FREE_OSCE_LIMIT, osceUsedToday, canUseOSCE: osceUsedToday < FREE_OSCE_LIMIT,
      promptDailyLimit: Infinity, promptsUsedToday, canUsePrompt: true,
      questionBankLimit: null,
      canAccessAnalytics: true, canAccessBehavior: true, canAccessTrustGut: true,
      canAccessReadiness: true, canAccessAdaptiveOSCE: false, canAccessExamMode: true,
      canSaveBookmarks: true, canAccessNotes: true, canAccessHistory: true, canAccessLearningPoints: true,
      ...record,
    };
  }

  // OSCE Only — unlimited OSCE, free-tier MCQ
  if (tier === 'osce_only') {
    return {
      isPaid: true, tier,
      mcqDailyLimit: FREE_MCQ_LIMIT, mcqUsedToday, canUseMCQ: mcqUsedToday < FREE_MCQ_LIMIT,
      osceDailyLimit: Infinity, osceUsedToday, canUseOSCE: true,
      promptDailyLimit: Infinity, promptsUsedToday, canUsePrompt: true,
      questionBankLimit: FREE_QUESTION_BANK,
      canAccessAnalytics: true, canAccessBehavior: true, canAccessTrustGut: true,
      canAccessReadiness: true, canAccessAdaptiveOSCE: true, canAccessExamMode: false,
      canSaveBookmarks: true, canAccessNotes: true, canAccessHistory: true, canAccessLearningPoints: true,
      ...record,
    };
  }

  // Free tier
  return {
    isPaid: false, tier: 'free',
    mcqDailyLimit: FREE_MCQ_LIMIT, mcqUsedToday, canUseMCQ: mcqUsedToday < FREE_MCQ_LIMIT,
    osceDailyLimit: FREE_OSCE_LIMIT, osceUsedToday, canUseOSCE: osceUsedToday < FREE_OSCE_LIMIT,
    promptDailyLimit: FREE_PROMPT_LIMIT, promptsUsedToday, canUsePrompt: promptsUsedToday < FREE_PROMPT_LIMIT,
    questionBankLimit: FREE_QUESTION_BANK,
    canAccessAnalytics: false, canAccessBehavior: false, canAccessTrustGut: false,
    canAccessReadiness: false, canAccessAdaptiveOSCE: false, canAccessExamMode: false,
    ...record,
  };
}

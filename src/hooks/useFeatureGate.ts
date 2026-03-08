import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useCallback } from 'react';

export interface FeatureGate {
  isPaid: boolean;
  tier: string;
  loading: boolean;
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
  canAccessMistakeReview: boolean;
  canAccessSocialGroups: boolean;
  canAccessSharedTests: boolean;
  canAccessStudyPlan: boolean;
  recordMCQ: () => Promise<void>;
  recordOSCE: () => Promise<void>;
  recordPrompt: () => Promise<void>;
}

const FREE_MCQ_LIMIT = 20;
const FREE_OSCE_LIMIT = 1;
const FREE_PROMPT_LIMIT = 5;
const FREE_QUESTION_BANK = 200;

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function useFeatureGate(): FeatureGate {
  const { user, subscription } = useAuth();
  const isPaid = subscription.subscribed;
  const tier = subscription.tier;

  const [loading, setLoading] = useState(true);
  const [mcqUsedToday, setMcqUsedToday] = useState(0);
  const [osceUsedToday, setOsceUsedToday] = useState(0);
  const [promptsUsedToday, setPromptsUsedToday] = useState(0);

  // Fetch today's usage from DB
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const today = getToday();
    supabase
      .from('user_usage_logs')
      .select('mcq_attempts, osce_attempts, ai_prompts_used')
      .eq('user_id', user.id)
      .eq('usage_date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMcqUsedToday(data.mcq_attempts);
          setOsceUsedToday(data.osce_attempts);
          setPromptsUsedToday(data.ai_prompts_used);
        }
        setLoading(false);
      });
  }, [user]);

  const increment = useCallback(async (field: 'mcq_attempts' | 'osce_attempts' | 'ai_prompts_used') => {
    if (!user) return;
    const today = getToday();

    // Try update first
    const { data: updated } = await supabase
      .from('user_usage_logs')
      .update({ [field]: (field === 'mcq_attempts' ? mcqUsedToday : field === 'osce_attempts' ? osceUsedToday : promptsUsedToday) + 1 })
      .eq('user_id', user.id)
      .eq('usage_date', today)
      .select()
      .maybeSingle();

    if (!updated) {
      // Insert new row
      await supabase.from('user_usage_logs').insert({
        user_id: user.id,
        usage_date: today,
        [field]: 1,
      } as any);
    }

    // Update local state
    if (field === 'mcq_attempts') setMcqUsedToday(p => p + 1);
    else if (field === 'osce_attempts') setOsceUsedToday(p => p + 1);
    else setPromptsUsedToday(p => p + 1);
  }, [user, mcqUsedToday, osceUsedToday, promptsUsedToday]);

  const recordMCQ = useCallback(() => increment('mcq_attempts'), [increment]);
  const recordOSCE = useCallback(() => increment('osce_attempts'), [increment]);
  const recordPrompt = useCallback(() => increment('ai_prompts_used'), [increment]);

  const base = { isPaid, tier, loading, mcqUsedToday, osceUsedToday, promptsUsedToday, recordMCQ, recordOSCE, recordPrompt };

  // Full access or lifetime — everything unlimited
  if (tier === 'full_access' || tier === 'lifetime') {
    return {
      ...base, isPaid: true,
      mcqDailyLimit: Infinity, canUseMCQ: true,
      osceDailyLimit: Infinity, canUseOSCE: true,
      promptDailyLimit: Infinity, canUsePrompt: true,
      questionBankLimit: null,
      canAccessAnalytics: true, canAccessBehavior: true, canAccessTrustGut: true,
      canAccessReadiness: true, canAccessAdaptiveOSCE: true, canAccessExamMode: true,
      canSaveBookmarks: true, canAccessNotes: true, canAccessHistory: true, canAccessLearningPoints: true,
      canAccessMistakeReview: true, canAccessSocialGroups: true, canAccessSharedTests: true, canAccessStudyPlan: true,
    };
  }

  // MCQ Only — unlimited MCQ, NO OSCE at all
  if (tier === 'mcq_only') {
    return {
      ...base, isPaid: true,
      mcqDailyLimit: Infinity, canUseMCQ: true,
      osceDailyLimit: 0, canUseOSCE: false,
      promptDailyLimit: Infinity, canUsePrompt: true,
      questionBankLimit: null,
      canAccessAnalytics: true, canAccessBehavior: true, canAccessTrustGut: true,
      canAccessReadiness: true, canAccessAdaptiveOSCE: false, canAccessExamMode: false,
      canSaveBookmarks: true, canAccessNotes: true, canAccessHistory: true, canAccessLearningPoints: true,
      canAccessMistakeReview: true, canAccessSocialGroups: false, canAccessSharedTests: false, canAccessStudyPlan: true,
    };
  }

  // OSCE Only — unlimited OSCE, NO MCQ at all
  if (tier === 'osce_only') {
    return {
      ...base, isPaid: true,
      mcqDailyLimit: 0, canUseMCQ: false,
      osceDailyLimit: Infinity, canUseOSCE: true,
      promptDailyLimit: Infinity, canUsePrompt: true,
      questionBankLimit: null,
      canAccessAnalytics: false, canAccessBehavior: true, canAccessTrustGut: false,
      canAccessReadiness: false, canAccessAdaptiveOSCE: true, canAccessExamMode: true,
      canSaveBookmarks: true, canAccessNotes: true, canAccessHistory: true, canAccessLearningPoints: true,
      canAccessMistakeReview: false, canAccessSocialGroups: false, canAccessSharedTests: false, canAccessStudyPlan: true,
    };
  }

  // Free tier
  return {
    ...base, isPaid: false, tier: 'free',
    mcqDailyLimit: FREE_MCQ_LIMIT, canUseMCQ: mcqUsedToday < FREE_MCQ_LIMIT,
    osceDailyLimit: FREE_OSCE_LIMIT, canUseOSCE: osceUsedToday < FREE_OSCE_LIMIT,
    promptDailyLimit: FREE_PROMPT_LIMIT, canUsePrompt: promptsUsedToday < FREE_PROMPT_LIMIT,
    questionBankLimit: FREE_QUESTION_BANK,
    canAccessAnalytics: false, canAccessBehavior: false, canAccessTrustGut: false,
    canAccessReadiness: false, canAccessAdaptiveOSCE: false, canAccessExamMode: false,
    canSaveBookmarks: false, canAccessNotes: false, canAccessHistory: false, canAccessLearningPoints: false,
    canAccessMistakeReview: false, canAccessSocialGroups: false, canAccessSharedTests: false, canAccessStudyPlan: false,
  };
}

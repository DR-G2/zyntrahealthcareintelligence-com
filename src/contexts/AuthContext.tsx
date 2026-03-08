import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { CURRENT_TERMS_VERSION } from '@/lib/legal';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  user_type: string | null;
  exam_date: string | null;
  weak_areas: string[] | null;
  onboarding_complete: boolean;
}

export interface WatermarkState {
  opacity_light: number;
  opacity_dark: number;
  suspended: boolean;
  strike_count: number;
  loading: boolean;
}

export interface SubscriptionState {
  subscribed: boolean;
  tier: 'free' | 'mcq_only' | 'osce_only' | 'full_access' | 'lifetime';
  subscription_end: string | null;
  loading: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  subscription: SubscriptionState;
  watermark: WatermarkState;
  termsAccepted: boolean;
  termsLoading: boolean;
  acceptTerms: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    subscribed: false,
    tier: 'free',
    subscription_end: null,
    loading: true,
  });
  const [watermark, setWatermark] = useState<WatermarkState>({
    opacity_light: 0.055,
    opacity_dark: 0.065,
    suspended: false,
    strike_count: 0,
    loading: true,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsLoading, setTermsLoading] = useState(true);

  const fetchTermsAcceptance = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_legal_acceptance')
        .select('terms_version')
        .eq('user_id', userId)
        .eq('terms_version', CURRENT_TERMS_VERSION)
        .limit(1)
        .maybeSingle();
      setTermsAccepted(!!data);
    } catch {
      setTermsAccepted(false);
    } finally {
      setTermsLoading(false);
    }
  };

  const acceptTerms = async () => {
    if (!user) return;
    await supabase.from('user_legal_acceptance').insert({
      user_id: user.id,
      terms_version: CURRENT_TERMS_VERSION,
      user_agent: navigator.userAgent,
    });
    setTermsAccepted(true);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
  };

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setSubscription({
        subscribed: data?.subscribed ?? false,
        tier: data?.tier ?? 'free',
        subscription_end: data?.subscription_end ?? null,
        loading: false,
      });
    } catch (e) {
      console.error('check-subscription error:', e);
      setSubscription(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchWatermark = async (userId: string) => {
    try {
      const [settingsRes, strikesRes] = await Promise.all([
        supabase.from('watermark_settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('piracy_strikes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);
      const settings = settingsRes.data;
      const strikeCount = strikesRes.count ?? 0;
      setWatermark({
        opacity_light: settings?.opacity_light ?? 0.055,
        opacity_dark: settings?.opacity_dark ?? 0.065,
        suspended: settings?.suspended ?? false,
        strike_count: strikeCount,
        loading: false,
      });
    } catch (e) {
      console.error('watermark fetch error:', e);
      setWatermark(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
          setTimeout(() => checkSubscription(), 100);
          setTimeout(() => fetchWatermark(session.user.id), 0);
        } else {
          setProfile(null);
          setSubscription({ subscribed: false, tier: 'free', subscription_end: null, loading: false });
          setWatermark({ opacity_light: 0.055, opacity_dark: 0.065, suspended: false, strike_count: 0, loading: false });
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        checkSubscription();
        fetchWatermark(session.user.id);
      } else {
        setSubscription(prev => ({ ...prev, loading: false }));
        setWatermark(prev => ({ ...prev, loading: false }));
      }
      setLoading(false);
    });

    return () => authSub.unsubscribe();
  }, []);

  // Periodic refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, subscription, watermark, signUp, signIn, signOut, refreshProfile, checkSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

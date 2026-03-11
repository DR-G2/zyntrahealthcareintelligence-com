import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
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
  country_of_origin: string | null;
  country_of_graduation: string | null;
  medical_college: string | null;
  graduation_year: number | null;
  current_location: string | null;
  exam_stage: string | null;
  is_banned?: boolean;
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
    subscribed: false, tier: 'free', subscription_end: null, loading: true,
  });
  const [watermark, setWatermark] = useState<WatermarkState>({
    opacity_light: 0.055, opacity_dark: 0.065, suspended: false, strike_count: 0, loading: true,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsLoading, setTermsLoading] = useState(true);

  // Refs to prevent redundant fetches on TOKEN_REFRESHED
  const termsAcceptedRef = useRef(false);
  const isFetchingRef = useRef(false);

  const fetchTermsAcceptance = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_legal_acceptance')
        .select('terms_version')
        .eq('user_id', userId)
        .eq('terms_version', CURRENT_TERMS_VERSION)
        .limit(1)
        .maybeSingle();
      const accepted = !!data;
      termsAcceptedRef.current = accepted;
      setTermsAccepted(accepted);
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
    termsAcceptedRef.current = true;
    setTermsAccepted(true);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data?.is_banned) {
      await supabase.auth.signOut();
      return;
    }
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
      setWatermark({
        opacity_light: settingsRes.data?.opacity_light ?? 0.055,
        opacity_dark: settingsRes.data?.opacity_dark ?? 0.065,
        suspended: settingsRes.data?.suspended ?? false,
        strike_count: strikesRes.count ?? 0,
        loading: false,
      });
    } catch (e) {
      console.error('watermark fetch error:', e);
      setWatermark(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchAllUserData = async (userId: string) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      await Promise.all([
        fetchProfile(userId),
        checkSubscription(),
        fetchWatermark(userId),
        fetchTermsAcceptance(userId),
      ]);
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Handle "Remember Me"
  useEffect(() => {
    const rememberMe = localStorage.getItem('zyntra_remember_me');
    if (rememberMe === 'false') {
      const sessionActive = sessionStorage.getItem('zyntra_session_active');
      if (!sessionActive) {
        supabase.auth.signOut();
        return;
      }
    }
  }, []);

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // On TOKEN_REFRESHED, skip full re-fetch if terms already accepted
          if (event === 'TOKEN_REFRESHED') {
            // Only refresh profile (for ban check) — skip terms, watermark, subscription
            setTimeout(() => fetchProfile(session.user.id), 0);
            return;
          }

          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            setTimeout(() => fetchAllUserData(session.user.id), 0);
          }
        } else {
          setProfile(null);
          setSubscription({ subscribed: false, tier: 'free', subscription_end: null, loading: false });
          setWatermark({ opacity_light: 0.055, opacity_dark: 0.065, suspended: false, strike_count: 0, loading: false });
          termsAcceptedRef.current = false;
          setTermsAccepted(false);
          setTermsLoading(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAllUserData(session.user.id);
      } else {
        setSubscription(prev => ({ ...prev, loading: false }));
        setWatermark(prev => ({ ...prev, loading: false }));
        setTermsLoading(false);
      }
      setLoading(false);
    });

    return () => authSub.unsubscribe();
  }, []);

  // Periodic subscription refresh every 5 minutes (reduced from 60s)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 300000);
    return () => clearInterval(interval);
  }, [user]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    localStorage.removeItem('zyntra_remember_me');
    sessionStorage.removeItem('zyntra_session_active');
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, subscription, watermark, termsAccepted, termsLoading, acceptTerms, signUp, signIn, signOut, refreshProfile, checkSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

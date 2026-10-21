import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSiteSetting(key: string, defaultValue: boolean = false) {
  const [enabled, setEnabled] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('site_settings' as any)
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          const value = (data as any).setting_value;
          setEnabled(value === true || value === 'true');
        } else {
          setEnabled(defaultValue);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEnabled(defaultValue);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [key, defaultValue]);

  return { enabled, loading };
}

export function useShowAboutPricing() {
  const { enabled, loading } = useSiteSetting('show_about_pricing');
  return { show: enabled, loading };
}

export function useMaintenanceMode() {
  return useSiteSetting('maintenance_mode');
}

export function useRegistrationOpen() {
  return useSiteSetting('registration_open', true);
}

export function useOSCEEnabled() {
  return useSiteSetting('osce_enabled', false);
}

export function useMCQTempEnabled() {
  return useSiteSetting('mcq_temp_enabled', false);
}

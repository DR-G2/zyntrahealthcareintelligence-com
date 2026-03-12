import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSiteSetting(key: string, defaultValue: boolean = false) {
  const [enabled, setEnabled] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('site_settings' as any)
      .select('value')
      .eq('key', key)
      .maybeSingle()
      .then(({ data }) => {
        setEnabled((data as any)?.value === true);
        setLoading(false);
      });
  }, [key]);

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

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useShowAboutPricing() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('site_settings' as any)
      .select('value')
      .eq('key', 'show_about_pricing')
      .maybeSingle()
      .then(({ data }) => {
        setShow((data as any)?.value === true);
        setLoading(false);
      });
  }, []);

  return { show, loading };
}

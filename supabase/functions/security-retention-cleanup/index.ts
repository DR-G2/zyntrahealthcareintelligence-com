import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async () => {
  try {
    const { data: policy, error: policyError } = await supabase
      .schema('pie')
      .from('security_screenshot_policy')
      .select('retention_days')
      .eq('id', true)
      .single();
    if (policyError) throw policyError;

    const cutoff = new Date(Date.now() - Number(policy.retention_days) * 86400000).toISOString();
    const { data: evidence, error: evidenceError } = await supabase
      .schema('pie')
      .from('security_evidence')
      .select('id,storage_ref')
      .eq('evidence_type', 'screenshot')
      .lt('created_at', cutoff);
    if (evidenceError) throw evidenceError;

    let deletedObjects = 0;
    const refs = (evidence ?? []).map((e) => e.storage_ref).filter(Boolean);
    if (refs.length) {
      const { error: storageError } = await supabase.storage.from('security-evidence').remove(refs);
      if (storageError) throw storageError;
      deletedObjects = refs.length;
    }

    const ids = (evidence ?? []).map((e) => e.id);
    if (ids.length) {
      const { error: deleteError } = await supabase
        .schema('pie')
        .from('security_evidence')
        .delete()
        .in('id', ids);
      if (deleteError) throw deleteError;
    }

    return new Response(JSON.stringify({
      ok: true,
      cutoff,
      evidence_deleted: ids.length,
      objects_deleted: deletedObjects,
    }), { headers: { 'content-type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});

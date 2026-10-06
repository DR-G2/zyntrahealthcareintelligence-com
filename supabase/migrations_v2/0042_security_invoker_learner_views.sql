create or replace view public.my_readiness with (security_invoker=true) as
select user_id,readiness_score,readiness_band,dimensions,model_version,calculated_at
from intelligence.readiness_dna
where user_id=auth.uid();
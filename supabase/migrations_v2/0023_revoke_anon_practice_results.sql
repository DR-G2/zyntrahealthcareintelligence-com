-- Practice results are authenticated learner data. Anonymous clients must not execute the RPC.
revoke execute on function public.get_practice_session_results(uuid) from anon;
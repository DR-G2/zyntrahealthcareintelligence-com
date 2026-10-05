GRANT SELECT, INSERT ON public.behavior_events TO authenticated;
GRANT ALL ON public.behavior_events TO service_role;
NOTIFY pgrst, 'reload schema';
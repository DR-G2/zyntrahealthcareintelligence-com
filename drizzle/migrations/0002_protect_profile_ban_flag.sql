CREATE OR REPLACE FUNCTION public.prevent_self_ban_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin(auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Not allowed to change ban status';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_self_ban_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_ban_change BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_ban_change();
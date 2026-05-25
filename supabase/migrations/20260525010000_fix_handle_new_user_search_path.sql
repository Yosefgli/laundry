-- Fix handle_new_user trigger: add SET search_path = public so that
-- the employees table (in public schema) can be found when the trigger
-- runs on auth.users. Without this, Supabase uses a restricted
-- search_path that omits public, causing "relation employees does not exist".

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create if metadata provides a name; otherwise let admin create manually
  IF NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN
    INSERT INTO public.employees (user_id, full_name, role)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Remove the SELECT policy that exposes tokens to client
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.google_calendar_tokens;

-- Add a secure view/function to check connection status without exposing tokens
CREATE OR REPLACE FUNCTION public.is_google_calendar_connected()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.google_calendar_tokens WHERE user_id = auth.uid()
  );
$$;
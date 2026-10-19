-- Supabase migrations and RLS policies for QuickFix
-- Run these in your Supabase SQL editor (Project > SQL) OR apply via your DB migration tooling.
-- WARNING: review policies and adapt table/column names to match your schema before running.

-- 1) Add optional columns used by the client
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS provider_name text,
  ADD COLUMN IF NOT EXISTS decline_reason text;

-- 2) Ensure row-level security is enabled on tables the client relies on
ALTER TABLE IF EXISTS public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.providers ENABLE ROW LEVEL SECURITY;

-- 3) Policies for service_requests
-- Customers may select their own requests
CREATE POLICY IF NOT EXISTS "Customers can view own requests"
  ON public.service_requests
  FOR SELECT
  USING (customer_id = auth.uid());

-- Customers may insert requests where customer_id equals auth.uid()
CREATE POLICY IF NOT EXISTS "Customers can insert own requests"
  ON public.service_requests
  FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Providers may select requests that reference their provider id
CREATE POLICY IF NOT EXISTS "Providers can view related requests"
  ON public.service_requests
  FOR SELECT
  USING (
    provider_id IN (
      SELECT id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- Providers may update requests for their provider
CREATE POLICY IF NOT EXISTS "Providers can update related requests"
  ON public.service_requests
  FOR UPDATE
  USING (
    provider_id IN (
      SELECT id FROM public.providers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id IN (
      SELECT id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- 4) Policies for providers table (basic)
CREATE POLICY IF NOT EXISTS "Users can view own provider profile"
  ON public.providers
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can insert own provider profile"
  ON public.providers
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update own provider profile"
  ON public.providers
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notes / next steps:
-- - If your providers table uses a different column for the foreign key to auth (e.g. account_id), update the queries above.
-- - If you plan to allow admins or support roles to view or edit data, create separate policies that allow those roles (check auth.role or a custom claim).
-- - After applying these policies, test insert/select/update flows from the browser client. If an operation fails with RLS, the error message in the browser console will show details.
-- - Do NOT add the Supabase service_role key to the client. Keep the anon/publishable key in your browser bundle and rely on RLS for security.

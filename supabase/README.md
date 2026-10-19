# Supabase run instructions

This repository now contains SQL to add required columns and Row Level Security (RLS) policies used by the client.

File: supabase/policies_and_migrations.sql

How to apply
1. Open your Supabase project dashboard
2. Click "SQL" -> "New query"
3. Paste the contents of supabase/policies_and_migrations.sql
4. Run the query

Validation checklist (after running):
- service_requests table contains provider_name and decline_reason columns
- RLS is enabled on service_requests and providers
- Policies exist (Customers can view own requests, Customers can insert own requests, Providers can view related requests, Providers can update related requests, and provider profile policies)

If anything fails during execution, copy the SQL error and share it here and I will update the migration/policy statements.

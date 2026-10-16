-- Run once in the existing Supabase project's SQL Editor before deploying.
-- Keeps existing inquiries unchanged and does not alter RLS or public access.
alter table public.booking_requests add column if not exists payment_method text
  check (payment_method in ('cash', 'card', 'gcash', 'other'));

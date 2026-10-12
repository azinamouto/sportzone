-- Sports Zone: Supabase Schema for Booking Requests & Customer Inquiries
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)

create table if not exists public.booking_requests (
  id text primary key,
  name text not null,
  phone text not null,
  email text,
  sport text not null,
  date text,
  time text,
  duration numeric default 1,
  message text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'completed')),
  admin_notes text default '',
  court_assigned text default '',
  estimated_price numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.booking_requests enable row level security;

-- Policy: Allow anonymous users / customers to submit court booking requests
create policy "Allow public submissions"
  on public.booking_requests
  for insert
  with check (true);

-- Policy: Allow read access for admin dashboard (or public if anon key is used)
create policy "Allow read access"
  on public.booking_requests
  for select
  using (true);

-- Policy: Allow update status for admin dashboard
create policy "Allow update access"
  on public.booking_requests
  for update
  using (true);

-- Policy: Allow delete for admin dashboard
create policy "Allow delete access"
  on public.booking_requests
  for delete
  using (true);

-- Realtime publication (optional, allows instant dashboard refreshes)
alter publication supabase_realtime add table public.booking_requests;

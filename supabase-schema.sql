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
-- Existing inquiries remain admin-only; new receipts use an unguessable token.
alter table public.booking_requests add column if not exists tracking_token_hash text;

alter table public.booking_requests enable row level security;

-- All access goes through the Express API using its server-only service role.
-- Remove legacy policies that allowed public access to admin data.
drop policy if exists "Allow public submissions" on public.booking_requests;
drop policy if exists "Allow read access" on public.booking_requests;
drop policy if exists "Allow update access" on public.booking_requests;
drop policy if exists "Allow delete access" on public.booking_requests;

-- Shared sessions survive function restarts and work across Vercel instances.
-- Store only token hashes; no public policies grant access to this table.
create table if not exists public.admin_sessions (
  token_hash text primary key,
  expires_at timestamp with time zone not null
);
alter table public.admin_sessions enable row level security;
create index if not exists admin_sessions_expires_at_idx
  on public.admin_sessions (expires_at);

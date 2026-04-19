-- Migration 005: expenses + bank balances for full Finance view.
-- Run after 004.

-- Categorized expenses, optionally tied to a specific Loop for per-night profit.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,           -- 'driver_pay' | 'fuel' | 'insurance' | 'marketing' | 'platform_fees' | 'other'
  vendor text,
  amount_cents int not null,
  group_id uuid references public.groups(id) on delete set null,
  expense_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (expense_date desc);
create index if not exists expenses_group_idx on public.expenses (group_id);

-- Manually entered bank account snapshots so finance can show a full cash position.
create table if not exists public.bank_balances (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  balance_cents int not null,
  as_of timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists bank_balances_account_asof_idx
  on public.bank_balances (account_name, as_of desc);

alter table public.expenses enable row level security;
alter table public.bank_balances enable row level security;

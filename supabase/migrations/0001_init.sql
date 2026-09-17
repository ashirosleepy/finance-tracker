-- ============================================================================
-- Personal Finance Tracker — Initial schema
-- Run this whole file once in Supabase SQL Editor (or via `supabase db push`)
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type account_type as enum ('bank', 'ewallet', 'cash', 'savings');

create type transaction_type as enum (
  'income',
  'expense',
  'transfer',
  'adjustment',
  'credit_card_charge',
  'credit_card_payment',
  'debt_lend',       -- I lend money to someone
  'debt_borrow',     -- I borrow money from someone
  'debt_collect',    -- someone repays me
  'debt_repay'       -- I repay a debt I owe
);

create type debt_direction as enum ('i_owe', 'owed_to_me');

create type recurring_frequency as enum ('daily', 'weekly', 'monthly', 'yearly', 'custom');

create type recurring_status as enum ('active', 'paused');

create type category_kind as enum ('income', 'expense');

create type budget_period as enum ('month', 'year');

-- ----------------------------------------------------------------------------
-- PROFILES (1 row per auth user — mainly for display name / settings)
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'VND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- ACCOUNTS
-- ----------------------------------------------------------------------------
create table accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type account_type not null,
  account_number text,
  opening_balance numeric(18,2) not null default 0,
  interest_rate numeric(6,3),        -- only meaningful for type = savings
  start_date date,                   -- only meaningful for type = savings
  maturity_date date,                -- only meaningful for type = savings
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on accounts(user_id);

-- ----------------------------------------------------------------------------
-- CATEGORIES
-- ----------------------------------------------------------------------------
create table categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind category_kind not null,
  icon text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

create index categories_user_id_idx on categories(user_id);

-- ----------------------------------------------------------------------------
-- CREDIT CARDS
-- ----------------------------------------------------------------------------
create table credit_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  credit_limit numeric(18,2) not null default 0,
  statement_day int not null check (statement_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index credit_cards_user_id_idx on credit_cards(user_id);

-- ----------------------------------------------------------------------------
-- DEBTS
-- ----------------------------------------------------------------------------
create table debts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction debt_direction not null,
  person_name text not null,
  principal_amount numeric(18,2) not null check (principal_amount > 0),
  start_date date not null default current_date,
  due_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index debts_user_id_idx on debts(user_id);

create table debt_payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references debts(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index debt_payments_debt_id_idx on debt_payments(debt_id);

-- ----------------------------------------------------------------------------
-- RECURRING PAYMENTS
-- ----------------------------------------------------------------------------
create table recurring_payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(18,2) not null check (amount > 0),
  frequency recurring_frequency not null,
  interval_days int,                 -- only used when frequency = 'custom'
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  next_due_date date not null,
  status recurring_status not null default 'active',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_payments_user_id_idx on recurring_payments(user_id);

-- ----------------------------------------------------------------------------
-- TRANSACTIONS (the single source of truth ledger)
-- ----------------------------------------------------------------------------
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type transaction_type not null,
  amount numeric(18,2) not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  from_account_id uuid references accounts(id) on delete set null,
  to_account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  description text,
  note text,
  debt_id uuid references debts(id) on delete set null,
  credit_card_id uuid references credit_cards(id) on delete set null,
  recurring_payment_id uuid references recurring_payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_user_id_idx on transactions(user_id);
create index transactions_occurred_at_idx on transactions(occurred_at);
create index transactions_type_idx on transactions(type);
create index transactions_from_account_idx on transactions(from_account_id);
create index transactions_to_account_idx on transactions(to_account_id);
create index transactions_debt_idx on transactions(debt_id);
create index transactions_credit_card_idx on transactions(credit_card_id);

-- ----------------------------------------------------------------------------
-- SAVINGS GOALS (optional metadata layer on top of a savings-type account)
-- ----------------------------------------------------------------------------
create table savings_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  name text not null,
  target_amount numeric(18,2),
  target_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index savings_goals_user_id_idx on savings_goals(user_id);

-- ----------------------------------------------------------------------------
-- BUDGETS
-- ----------------------------------------------------------------------------
create table budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references categories(id) on delete cascade,
  period budget_period not null,
  period_start date not null,
  amount numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budgets_user_id_idx on budgets(user_id);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  related_table text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications(user_id);

-- ============================================================================
-- VIEWS — computed balances (never store balances directly)
-- ============================================================================

-- Net effect of every transaction on every account it touches, in one row per (transaction, account)
-- Every transaction that sets from_account_id decreases that account by `amount`;
-- every transaction that sets to_account_id increases that account by `amount`.
-- This is true uniformly across all transaction types (income only sets to_account_id,
-- expense/credit_card_payment/debt_lend/debt_repay only set from_account_id, transfer
-- sets both, and adjustment uses whichever leg matches the correction direction).
create view account_transaction_effects as
  select from_account_id as account_id, user_id,
         -amount as delta,
         occurred_at
  from transactions
  where from_account_id is not null
  union all
  select to_account_id as account_id, user_id,
         amount as delta,
         occurred_at
  from transactions
  where to_account_id is not null;

-- Current balance per account = opening_balance + sum of all effects
create view account_balances as
  select
    a.id as account_id,
    a.user_id,
    a.name,
    a.type,
    a.opening_balance,
    a.opening_balance + coalesce(sum(e.delta), 0) as current_balance
  from accounts a
  left join account_transaction_effects e on e.account_id = a.id
  group by a.id;

-- Credit card used balance = charges - payments
create view credit_card_balances as
  select
    c.id as credit_card_id,
    c.user_id,
    c.name,
    c.credit_limit,
    coalesce(sum(case when t.type = 'credit_card_charge' then t.amount else 0 end), 0)
      - coalesce(sum(case when t.type = 'credit_card_payment' then t.amount else 0 end), 0) as used_balance
  from credit_cards c
  left join transactions t on t.credit_card_id = c.id
  group by c.id;

-- Debt remaining = principal - sum(debt_payments)
create view debt_balances as
  select
    d.id as debt_id,
    d.user_id,
    d.direction,
    d.person_name,
    d.principal_amount,
    d.start_date,
    d.due_date,
    coalesce(sum(p.amount), 0) as paid_amount,
    d.principal_amount - coalesce(sum(p.amount), 0) as remaining_amount,
    case
      when d.principal_amount - coalesce(sum(p.amount), 0) <= 0 then 'paid'
      when d.due_date is not null and d.due_date < current_date then 'overdue'
      else 'active'
    end as status
  from debts d
  left join debt_payments p on p.debt_id = d.id
  group by d.id;

-- One-row summary per user: assets, liabilities, net worth
create view net_worth_summary as
  select
    ab.user_id,
    sum(case when ab.type in ('bank','ewallet','cash') then ab.current_balance else 0 end) as liquid_balance,
    sum(case when ab.type = 'savings' then ab.current_balance else 0 end) as savings_balance,
    sum(ab.current_balance) as total_real_assets
  from account_balances ab
  group by ab.user_id;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table profiles enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table credit_cards enable row level security;
alter table debts enable row level security;
alter table debt_payments enable row level security;
alter table recurring_payments enable row level security;
alter table transactions enable row level security;
alter table savings_goals enable row level security;
alter table budgets enable row level security;
alter table notifications enable row level security;

create policy "profiles: own row" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "accounts: own rows" on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "categories: own rows" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "credit_cards: own rows" on credit_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "debts: own rows" on debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "debt_payments: own rows" on debt_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recurring_payments: own rows" on recurring_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions: own rows" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "savings_goals: own rows" on savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "budgets: own rows" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notifications: own rows" on notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Views inherit RLS from underlying tables automatically in Postgres/Supabase
-- as long as they are created without `security definer` (default here), so
-- no extra policies are needed for the views above.

-- ============================================================================
-- DEFAULT CATEGORIES — inserted per-user the first time they load the app
-- (handled in app code via lib/queries.js -> ensureDefaultCategories, since
--  we don't know the user's id at migration time)
-- ============================================================================

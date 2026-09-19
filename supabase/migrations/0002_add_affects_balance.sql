-- ============================================================================
-- Migration: add `affects_balance` flag to transactions
--
-- Purpose: let the user log a past/historical transaction purely for
-- record-keeping (spending history, category reports, search) WITHOUT it
-- changing any current account/credit-card balance. Default is `true` so
-- every existing row, and every normal new transaction, behaves exactly as
-- before. Only rows explicitly marked `false` are excluded from balance math.
-- ============================================================================

-- 1. New column on the ledger table -----------------------------------------
alter table transactions
  add column affects_balance boolean not null default true;

-- 2. Re-point the balance views to respect the flag --------------------------
-- account_transaction_effects / account_balances / credit_card_balances all
-- read straight from `transactions`, so each needs the extra filter.
-- `create or replace view` is safe here: the output column list/types are
-- unchanged, only the underlying WHERE conditions get stricter.

create or replace view account_transaction_effects as
  select from_account_id as account_id, user_id,
         -amount as delta,
         occurred_at
  from transactions
  where from_account_id is not null
    and affects_balance
  union all
  select to_account_id as account_id, user_id,
         amount as delta,
         occurred_at
  from transactions
  where to_account_id is not null
    and affects_balance;

create or replace view account_balances as
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

create or replace view credit_card_balances as
  select
    c.id as credit_card_id,
    c.user_id,
    c.name,
    c.credit_limit,
    coalesce(sum(case when t.type = 'credit_card_charge' and t.affects_balance then t.amount else 0 end), 0)
      - coalesce(sum(case when t.type = 'credit_card_payment' and t.affects_balance then t.amount else 0 end), 0) as used_balance
  from credit_cards c
  left join transactions t on t.credit_card_id = c.id
  group by c.id;

-- net_worth_summary and debt_balances need no change: net_worth_summary reads
-- from account_balances (already fixed above), and debt_balances is derived
-- from debt_payments, not transactions.

-- 0004_add_bnpl_installments.sql
-- Shopee trả sau (BNPL) + kế hoạch trả góp.
--
-- Mô hình:
--   * ShopeePay (ví thật)        -> accounts, type = 'ewallet' (không đổi gì)
--   * Shopee trả sau (hạn mức)   -> bnpl_accounts
--   * Mua trả góp                -> installment_plans + installment_payments (từng kỳ)
--   * Mua bằng trả sau           -> transactions.type = 'bnpl_charge'  (ghi nhận chi tiêu, KHÔNG trừ tiền thật)
--   * Trả nợ / trả kỳ góp        -> transactions.type = 'bnpl_payment' (trừ tiền từ tài khoản thật)

-- ---------------------------------------------------------------------------
-- 1) Loại giao dịch mới
-- ---------------------------------------------------------------------------
-- transaction_type là enum: hai giá trị bnpl_charge / bnpl_payment được thêm ở
-- 0003_add_bnpl_enum_values.sql — phải chạy file đó (riêng, xong rồi) TRƯỚC file này.

-- ---------------------------------------------------------------------------
-- 2) Tài khoản hạn mức (Shopee trả sau)
-- ---------------------------------------------------------------------------
create table public.bnpl_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  credit_limit   numeric not null check (credit_limit >= 0),
  statement_day  smallint not null default 5  check (statement_day between 1 and 31),
  due_day        smallint not null default 20 check (due_day between 1 and 31),
  note           text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) Kế hoạch trả góp + từng kỳ
-- ---------------------------------------------------------------------------
create table public.installment_plans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  bnpl_account_id  uuid not null references public.bnpl_accounts(id) on delete restrict,
  name             text not null,
  total_amount     numeric not null check (total_amount > 0),   -- giá trị mua (gốc)
  months           smallint not null check (months between 1 and 60),
  fee_total        numeric not null default 0 check (fee_total >= 0), -- tổng phí/lãi cả kế hoạch
  monthly_amount   numeric not null,                            -- trung bình/kỳ (để hiển thị)
  first_due_date   date not null,
  purchased_at     timestamptz not null default now(),
  note             text,
  created_at       timestamptz not null default now()
);

create table public.installment_payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  plan_id          uuid not null references public.installment_plans(id) on delete cascade,
  period_no        smallint not null,
  due_date         date not null,
  principal_amount numeric not null check (principal_amount >= 0),
  fee_amount       numeric not null default 0 check (fee_amount >= 0),
  amount           numeric generated always as (principal_amount + fee_amount) stored,
  paid_at          timestamptz,
  transaction_id   uuid references public.transactions(id) on delete set null,
  unique (plan_id, period_no)
);
create index on public.installment_payments (plan_id);
create index on public.installment_payments (due_date) where paid_at is null;

-- ---------------------------------------------------------------------------
-- 4) Liên kết từ transactions
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column bnpl_account_id        uuid references public.bnpl_accounts(id)        on delete restrict,
  add column installment_plan_id    uuid references public.installment_plans(id)    on delete set null,
  add column installment_payment_id uuid references public.installment_payments(id) on delete set null;

create index on public.transactions (bnpl_account_id);
create index on public.transactions (installment_plan_id);

-- Xoá giao dịch trả kỳ góp -> kỳ đó quay lại trạng thái "chưa trả".
create or replace function public.reset_installment_on_tx_delete()
returns trigger language plpgsql as $$
begin
  update public.installment_payments
     set paid_at = null, transaction_id = null
   where transaction_id = old.id;
  return old;
end $$;

create trigger trg_reset_installment_on_tx_delete
  before delete on public.transactions
  for each row execute function public.reset_installment_on_tx_delete();

-- ---------------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------------
alter table public.bnpl_accounts        enable row level security;
alter table public.installment_plans    enable row level security;
alter table public.installment_payments enable row level security;

create policy "own rows" on public.bnpl_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.installment_plans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.installment_payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) Views (số dư luôn tính từ giao dịch/kỳ, không lưu cột)
-- ---------------------------------------------------------------------------
-- Hạn mức đã dùng = tổng mua bằng trả sau
--                 - phần GỐC của các kỳ góp đã trả
--                 - các khoản trả nợ lẻ (không thuộc kỳ góp nào)
create or replace view public.bnpl_balances
with (security_invoker = true) as
select
  b.id as bnpl_id,
  b.user_id,
  b.name,
  b.credit_limit,
  b.statement_day,
  b.due_day,
  b.note,
  u.used_balance,
  b.credit_limit - u.used_balance as available_balance
from public.bnpl_accounts b
cross join lateral (
  select greatest(
    coalesce((select sum(t.amount) from public.transactions t
               where t.bnpl_account_id = b.id and t.type = 'bnpl_charge'
                 and t.affects_balance), 0)
    - coalesce((select sum(ip.principal_amount)
                  from public.installment_payments ip
                  join public.installment_plans p on p.id = ip.plan_id
                 where p.bnpl_account_id = b.id and ip.paid_at is not null), 0)
    - coalesce((select sum(t.amount) from public.transactions t
                 where t.bnpl_account_id = b.id and t.type = 'bnpl_payment'
                   and t.installment_payment_id is null and t.affects_balance), 0),
    0) as used_balance
) u;

create or replace view public.installment_plan_summary
with (security_invoker = true) as
select
  p.id as plan_id,
  p.user_id,
  p.bnpl_account_id,
  b.name as bnpl_name,
  p.name,
  p.total_amount,
  p.months,
  p.fee_total,
  p.monthly_amount,
  p.first_due_date,
  p.purchased_at,
  count(ip.id) filter (where ip.paid_at is not null)                        as paid_count,
  coalesce(sum(ip.amount) filter (where ip.paid_at is not null), 0)         as paid_amount,
  coalesce(sum(ip.amount) filter (where ip.paid_at is null), 0)             as remaining_amount,
  min(ip.due_date) filter (where ip.paid_at is null)                        as next_due_date,
  count(ip.id) filter (where ip.paid_at is null and ip.due_date < current_date) as overdue_count,
  case
    when count(ip.id) filter (where ip.paid_at is null) = 0 then 'completed'
    when count(ip.id) filter (where ip.paid_at is null and ip.due_date < current_date) > 0 then 'overdue'
    else 'active'
  end as status
from public.installment_plans p
join public.bnpl_accounts b on b.id = p.bnpl_account_id
left join public.installment_payments ip on ip.plan_id = p.id
group by p.id, b.name;

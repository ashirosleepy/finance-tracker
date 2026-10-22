-- 0005_bnpl_bills.sql
-- Chuyển sang mô hình HÓA ĐƠN theo kỳ của Shopee trả sau:
--   * Mỗi tháng có 1 hóa đơn, chốt vào `statement_day` (vd 24), hạn trả `due_day` (vd 10) của THÁNG SAU.
--   * Hóa đơn gồm: các khoản mua trả một lần trong kỳ + các kỳ trả góp rơi vào hóa đơn đó.
--   * Thanh toán = trả cả hóa đơn 1 lần (1 giao dịch bnpl_payment).
-- Chạy sau 0004.

-- Mặc định theo Shopee: chốt ngày 24, trả trễ nhất ngày 10 tháng sau.
alter table public.bnpl_accounts
  alter column statement_day set default 24,
  alter column due_day set default 10;

-- Phần GỐC của một lần thanh toán (phần giảm hạn mức đã dùng). Phí/lãi không làm giảm hạn mức.
alter table public.transactions add column bnpl_principal_amount numeric;

-- Dữ liệu cũ: các giao dịch trả từng kỳ góp -> lấy phần gốc của kỳ đó.
update public.transactions t
   set bnpl_principal_amount = ip.principal_amount
  from public.installment_payments ip
 where t.installment_payment_id = ip.id and t.type = 'bnpl_payment';

-- Trạng thái đã thanh toán của từng hóa đơn (tạo khi thanh toán).
create table public.bnpl_bills (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  bnpl_account_id  uuid not null references public.bnpl_accounts(id) on delete cascade,
  bill_month       date not null,              -- ngày 1 của tháng chốt hóa đơn
  due_date         date,                       -- ghi đè hạn trả nếu Shopee lệch (vd 10 -> 11)
  paid_at          timestamptz,
  transaction_id   uuid references public.transactions(id) on delete set null,
  unique (bnpl_account_id, bill_month)
);

alter table public.bnpl_bills enable row level security;
create policy "own rows" on public.bnpl_bills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Xoá giao dịch thanh toán -> kỳ góp quay về "chưa trả" và hóa đơn quay về "chưa thanh toán".
create or replace function public.reset_installment_on_tx_delete()
returns trigger language plpgsql as $$
begin
  update public.installment_payments
     set paid_at = null, transaction_id = null
   where transaction_id = old.id;
  delete from public.bnpl_bills where transaction_id = old.id;
  return old;
end $$;

-- Hạn mức đã dùng = tổng mua trả sau - phần gốc của các lần thanh toán.
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
    - coalesce((select sum(coalesce(t.bnpl_principal_amount, t.amount)) from public.transactions t
                 where t.bnpl_account_id = b.id and t.type = 'bnpl_payment'
                   and t.affects_balance), 0),
    0) as used_balance
) u;

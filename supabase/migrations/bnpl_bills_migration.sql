-- Mô hình hóa đơn Shopee: chốt ngày 24, hạn 10 tháng sau, trả cả hóa đơn một lần.
-- Chạy một lần trong Supabase SQL editor. Nên sao lưu hoặc chạy thử trên bản sao trước.

-- 1) Bảng lưu các hóa đơn đã thanh toán (mỗi hạn mức, mỗi tháng chốt tối đa một dòng).
create table if not exists public.bnpl_bills (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bnpl_account_id uuid not null references public.bnpl_accounts(id) on delete cascade,
  bill_key       text not null check (bill_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- 'YYYY-MM' của tháng chốt
  paid_at        timestamptz not null default now(),
  paid_amount    numeric not null check (paid_amount > 0),
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (bnpl_account_id, bill_key)
);

alter table public.bnpl_bills enable row level security;
create policy "bnpl_bills_own" on public.bnpl_bills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) Hạn mức hiện có: ngày chốt 24, ngày đến hạn 10.
update public.bnpl_accounts set statement_day = 24, due_day = 10;

-- 3) Đưa hạn các kỳ trả góp hiện có về ngày 10:
--    ngày <= 10 → ngày 10 cùng tháng; ngày > 10 → ngày 10 tháng sau (không làm kỳ nào quá hạn giả).
update public.installment_payments
set due_date = (
  make_date(extract(year from due_date)::int, extract(month from due_date)::int, 10)
  + case when extract(day from due_date) > 10 then interval '1 month' else interval '0' end
)::date;

update public.installment_plans
set first_due_date = (
  make_date(extract(year from first_due_date)::int, extract(month from first_due_date)::int, 10)
  + case when extract(day from first_due_date) > 10 then interval '1 month' else interval '0' end
)::date;

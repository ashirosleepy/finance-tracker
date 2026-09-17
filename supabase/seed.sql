-- ============================================================================
-- Sample data for testing.
-- 1. Sign up once in the app (so a row exists in auth.users).
-- 2. Replace 'YOUR_EMAIL_HERE' below with the email you signed up with.
-- 3. Run this whole file in the Supabase SQL Editor.
-- ============================================================================

do $$
declare
  v_user_id uuid;
  v_vcb uuid;
  v_momo uuid;
  v_cash uuid;
  v_savings uuid;
  v_cat_food uuid;
  v_cat_transport uuid;
  v_cat_freelance uuid;
  v_cat_family uuid;
  v_card uuid;
  v_debt_lent uuid;
  v_debt_owed uuid;
begin
  select id into v_user_id from auth.users where email = 'YOUR_EMAIL_HERE' limit 1;
  if v_user_id is null then
    raise exception 'No user found with that email. Sign up in the app first, then edit this script.';
  end if;

  -- Accounts -----------------------------------------------------------
  insert into accounts (user_id, name, type, opening_balance, note)
    values (v_user_id, 'Vietcombank', 'bank', 10000000, 'Tài khoản chính')
    returning id into v_vcb;
  insert into accounts (user_id, name, type, opening_balance)
    values (v_user_id, 'MoMo', 'ewallet', 500000)
    returning id into v_momo;
  insert into accounts (user_id, name, type, opening_balance)
    values (v_user_id, 'Ví tiền mặt', 'cash', 300000)
    returning id into v_cash;
  insert into accounts (user_id, name, type, opening_balance, interest_rate, start_date)
    values (v_user_id, 'Tiết kiệm online', 'savings', 5000000, 5.5, current_date - 60)
    returning id into v_savings;

  -- Categories -----------------------------------------------------------
  insert into categories (user_id, name, kind, is_default) values
    (v_user_id, 'Ăn uống', 'expense', true),
    (v_user_id, 'Đi lại', 'expense', true),
    (v_user_id, 'Nhà ở', 'expense', true),
    (v_user_id, 'Điện nước', 'expense', true),
    (v_user_id, 'Internet', 'expense', true),
    (v_user_id, 'Mua sắm', 'expense', true),
    (v_user_id, 'Giải trí', 'expense', true),
    (v_user_id, 'Khác', 'expense', true),
    (v_user_id, 'Freelance', 'income', true),
    (v_user_id, 'Gia đình gửi', 'income', true),
    (v_user_id, 'Thu nhập khác', 'income', true);

  select id into v_cat_food from categories where user_id = v_user_id and name = 'Ăn uống';
  select id into v_cat_transport from categories where user_id = v_user_id and name = 'Đi lại';
  select id into v_cat_freelance from categories where user_id = v_user_id and name = 'Freelance';
  select id into v_cat_family from categories where user_id = v_user_id and name = 'Gia đình gửi';

  -- Credit card -----------------------------------------------------------
  insert into credit_cards (user_id, name, credit_limit, statement_day, due_day)
    values (v_user_id, 'Techcombank Visa', 20000000, 5, 20)
    returning id into v_card;

  -- 1) Irregular income (freelance, no fixed schedule) --------------------
  insert into transactions (user_id, type, amount, occurred_at, to_account_id, category_id, description)
  values
    (v_user_id, 'income', 3000000, now() - interval '20 days', v_vcb, v_cat_freelance, 'Thiết kế logo cho khách A'),
    (v_user_id, 'income', 1500000, now() - interval '8 days', v_momo, v_cat_freelance, 'Viết content freelance'),
    (v_user_id, 'income', 2000000, now() - interval '3 days', v_vcb, v_cat_family, 'Gia đình gửi');

  -- 2) Regular expenses -----------------------------------------------------
  insert into transactions (user_id, type, amount, occurred_at, from_account_id, category_id, description)
  values
    (v_user_id, 'expense', 150000, now() - interval '15 days', v_cash, v_cat_food, 'Ăn trưa cả tuần'),
    (v_user_id, 'expense', 80000, now() - interval '10 days', v_momo, v_cat_transport, 'Grab đi làm'),
    (v_user_id, 'expense', 220000, now() - interval '2 days', v_vcb, v_cat_food, 'Đi chợ');

  -- 3) Transfer between bank and e-wallet (must NOT count as expense) -------
  insert into transactions (user_id, type, amount, occurred_at, from_account_id, to_account_id, description)
  values (v_user_id, 'transfer', 500000, now() - interval '7 days', v_vcb, v_momo, 'Nạp tiền MoMo');

  -- 4) Personal debt: I lend money to a friend ------------------------------
  insert into debts (user_id, direction, person_name, principal_amount, start_date, due_date, note)
    values (v_user_id, 'owed_to_me', 'Anh B', 2000000, current_date - 10, current_date + 20, 'Cho mượn mua xe')
    returning id into v_debt_owed;
  insert into transactions (user_id, type, amount, occurred_at, from_account_id, debt_id, description)
    values (v_user_id, 'debt_lend', 2000000, now() - interval '10 days', v_vcb, v_debt_owed, 'Cho Anh B mượn tiền');
  -- partial repayment received
  insert into debt_payments (user_id, debt_id, amount, paid_at) values (v_user_id, v_debt_owed, 500000, now() - interval '2 days');
  insert into transactions (user_id, type, amount, occurred_at, to_account_id, debt_id, description)
    values (v_user_id, 'debt_collect', 500000, now() - interval '2 days', v_vcb, v_debt_owed, 'Anh B trả bớt nợ');

  -- 5) Personal debt: I borrow money -----------------------------------------
  insert into debts (user_id, direction, person_name, principal_amount, start_date, due_date, note)
    values (v_user_id, 'i_owe', 'Chị C', 1000000, current_date - 5, current_date + 25, 'Mượn đóng tiền nhà')
    returning id into v_debt_lent;
  insert into transactions (user_id, type, amount, occurred_at, to_account_id, debt_id, description)
    values (v_user_id, 'debt_borrow', 1000000, now() - interval '5 days', v_vcb, v_debt_lent, 'Mượn Chị C');

  -- 6) Credit card purchase + payment (must not double count as expense) ----
  insert into transactions (user_id, type, amount, occurred_at, category_id, credit_card_id, description)
    values (v_user_id, 'credit_card_charge', 2000000, now() - interval '6 days', v_cat_food, v_card, 'Mua đồ gia dụng bằng thẻ');
  insert into transactions (user_id, type, amount, occurred_at, from_account_id, credit_card_id, description)
    values (v_user_id, 'credit_card_payment', 1000000, now() - interval '1 days', v_vcb, v_card, 'Thanh toán một phần dư nợ thẻ');

  -- 7) Recurring monthly payment (rent) --------------------------------------
  insert into recurring_payments (user_id, name, amount, frequency, account_id, category_id, next_due_date)
  values (v_user_id, 'Tiền phòng', 4000000, 'monthly', v_vcb,
          (select id from categories where user_id = v_user_id and name = 'Nhà ở'),
          date_trunc('month', current_date) + interval '1 month' + interval '4 days');

  insert into recurring_payments (user_id, name, amount, frequency, account_id, category_id, next_due_date)
  values (v_user_id, 'Internet', 300000, 'monthly', v_vcb,
          (select id from categories where user_id = v_user_id and name = 'Internet'),
          date_trunc('month', current_date) + interval '1 month' + interval '9 days');

  -- 8) Savings: money moved into the savings account (a transfer, not an expense)
  insert into transactions (user_id, type, amount, occurred_at, from_account_id, to_account_id, description)
    values (v_user_id, 'transfer', 1000000, now() - interval '4 days', v_vcb, v_savings, 'Bỏ tiết kiệm tháng này');

  raise notice 'Seed data inserted for user %', v_user_id;
end $$;

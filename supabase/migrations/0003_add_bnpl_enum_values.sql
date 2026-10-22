-- 0003_add_bnpl_enum_values.sql
-- CHẠY FILE NÀY TRƯỚC, RIÊNG MỘT LẦN, rồi mới chạy 0004_add_bnpl_installments.sql.
-- (Postgres không cho dùng giá trị enum mới trong cùng lần chạy đã thêm nó.)
alter type transaction_type add value if not exists 'bnpl_charge';
alter type transaction_type add value if not exists 'bnpl_payment';

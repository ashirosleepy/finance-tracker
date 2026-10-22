# Hai file chưa được upload — cần chỉnh tay

## 1. src/lib/formatters.js

Thêm 2 key vào `TRANSACTION_TYPE_LABELS` và export thêm 2 object nhãn:

```js
export const TRANSACTION_TYPE_LABELS = {
  // ...các nhãn cũ...
  bnpl_charge: 'Mua bằng Shopee trả sau',
  bnpl_payment: 'Trả nợ Shopee trả sau',
}

export const INSTALLMENT_STATUS_LABELS = {
  paid: 'Đã thanh toán',
  overdue: 'Quá hạn',
  soon: 'Sắp đến hạn',
  upcoming: 'Chưa đến hạn',
}

export const PLAN_STATUS_LABELS = {
  active: 'Đang trả',
  overdue: 'Có kỳ quá hạn',
  completed: 'Đã tất toán',
}
```

## 2. src/pages/Transactions.jsx

a) Import thêm:

```js
import { getBnplBalances, createInstallmentPlan } from '../lib/queries'
```

b) Load `bnplAccounts` cùng chỗ đang load accounts/categories/creditCards/debts:

```js
const [bnplAccounts, setBnplAccounts] = useState([])
// trong hàm load():  setBnplAccounts(await getBnplBalances())
```

c) Truyền vào form: `<TransactionForm ... bnplAccounts={bnplAccounts} />`

d) Trong handler submit khi TẠO MỚI, tách `installment` ra khỏi payload:

```js
async function handleCreate(payload) {
  const { installment, ...tx } = payload
  if (installment) {
    await createInstallmentPlan({
      userId: tx.user_id,
      bnplAccountId: tx.bnpl_account_id,
      name: tx.description || 'Mua trả góp',
      totalAmount: tx.amount,
      months: installment.months,
      feeTotal: installment.feeTotal,
      firstDueDate: installment.firstDueDate,
      occurredAt: tx.occurred_at,
      categoryId: tx.category_id,
      note: tx.note,
    })
  } else {
    await createTransaction(tx)
  }
  await reload() // hàm reload hiện có của bạn (cả giao dịch lẫn bnplAccounts)
}
```

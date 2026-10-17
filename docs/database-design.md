# Database design

The intended persistent database is MongoDB with Mongoose. Schemas currently present:

- `User`: name, unique normalized email, password hash, avatar (defaults to `/avatar-default.png`), optional phone number and birth date, default currency, timestamps.
- `Account`: owner, name, account type, opening balance, currency, archive flag.
- `Category`: optional owner for system categories, type, icon/color, system/archive flags.
- `Transaction`: owner, type, title, amount, category, source/destination accounts, date, note.
- `Budget`: owner, expense category, limit, inclusive period.
- `Debt`: owner, person, borrowed/lent type, principal, recorded paid amount, dates, status.
- `DebtPayment`: owner, debt reference, amount, payment date, optional account, note.
- `Notification`: owner, warning type/content, read state, unique deduplication key.

The intended relationships are one user to many accounts, transactions, personal categories, budgets, debts, and notifications; a debt to many payments; and accounts/categories to many transactions. References must be checked for existence and ownership in the API.

## Money and balances

The prototype accepts whole-number VND amounts and calculates balances from opening balances plus ledger effects:

- income: positive to the source account;
- expense: negative to the source account;
- transfer: negative from the source and positive to the destination;
- borrowed-debt payment: negative from the selected account;
- lent-debt recovery: positive to the selected account.

Transfers are excluded from income, expenses, and budget usage. Debt principal is not treated as income or consumer spending.

## Persistence

API routes persist through Mongoose. Run the idempotent demo seed using `npm run seed --workspace server`. Balance data is derived from the account opening balance plus transaction and payment ledgers. Updating a debt payment uses a MongoDB session transaction so the payment record and debt paid amount stay consistent; MongoDB transactions require a replica set, which Atlas provides by default.

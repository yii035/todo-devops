# FinTrack use cases

The workflow diagram describes the authenticated finance-management flows. `include` represents required shared behavior; `extend` represents conditional behavior.

## Actors and primary cases

- **Guest:** register and log in.
- **Authenticated user:** manage profile/settings; view the dashboard; manage transactions, accounts, categories, budgets, debts/loans, notifications, and reports; export a report.
- **Scheduler:** evaluate budget and due-date warnings if a scheduled job is introduced.

## Shared behavior

- **Calculate financial summary:** sum eligible income and expenses for the requested period, and calculate current account balances.
- **Retrieve recent transactions / chart data:** return user-scoped ledger entries and aggregates.
- **Validate transaction:** enforce positive whole-VND amounts, account ownership, category/type compatibility, and transfer source/destination rules.
- **Apply balance change:** derive each account balance from its opening balance, transactions, and debt-payment ledger; transfers are neutral at the user-total level.
- **Calculate budget usage:** sum only expense transactions matching the budget category and inclusive period.
- **Calculate outstanding debt:** principal minus valid payments.

## Relations from the diagram

- View Dashboard includes summary, recent transactions, and chart data; budget/debt warnings appear when applicable.
- Manage Transactions includes validation and balance effects. Search and filtering are conditional extensions.
- Manage Budgets includes usage calculation and can extend to a warning when usage nears or exceeds its limit.
- Manage Debts and Loans includes outstanding-balance calculation and links to recording a payment; due warnings are conditional.
- View Reports includes summary/chart calculations and can extend to CSV export when requested.

## Implemented behavior and boundaries

The API implements these flows with per-user ownership checks and MongoDB persistence. Balance changes are derived from ledger data rather than persisted balance counters, so edits/deletions do not apply a second increment/decrement. Notification warnings are generated on read and deduplicated by event key. Scheduler-based delivery remains future work.

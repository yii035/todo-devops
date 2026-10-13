# API documentation

All routes are prefixed with `/api/v1`. Protected routes require `Authorization: Bearer <JWT>`. Successful JSON responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "message": "..." }`.

## Authentication and settings

| Method | Endpoint | Behavior |
|---|---|---|
| POST | `/auth/register` | Register and return a token |
| POST | `/auth/login` | Verify credentials and return a token |
| POST | `/auth/logout` | Acknowledge logout; the stateless client must remove its token |
| GET | `/auth/me` | Return the authenticated user without password data |
| PATCH | `/auth/change-password` | Verify current password and replace its hash |
| GET/PATCH | `/settings` | Read/update the authenticated user's name and default currency |

## Finance workflows

| Method | Endpoint | Behavior |
|---|---|---|
| GET | `/dashboard/summary` | Period summary, current balance, budget and due warnings (`period=month\|3months\|6months\|year`, or `startDate` + `endDate`) |
| GET | `/dashboard/charts` | Monthly income/expense and expense-by-category data (`months=1..12`) |
| GET | `/dashboard/recent-transactions` | Recent ledger entries (`limit=1..20`) |
| GET/POST | `/transactions` | List with filters/search/pagination or create income/expense/transfer |
| GET/PATCH/DELETE | `/transactions/:id` | Read, edit, or delete an owned transaction |
| POST | `/transactions/transfer` | Create a validated transfer between two distinct owned accounts |
| GET | `/transactions/export` | Export filtered transactions as CSV |
| GET/POST | `/accounts` | List balances or create an account |
| GET/PATCH | `/accounts/:id` | Read or update an account |
| PATCH | `/accounts/:id/archive` | Archive an account without deleting its history |
| GET | `/accounts/:id/transactions` | Read transaction history for an owned account |
| GET/POST | `/categories` | List/filter or create a personal category |
| PATCH | `/categories/:id` | Update an owned personal category |
| PATCH | `/categories/:id/archive` | Archive an unused personal category |
| GET/POST | `/budgets` | List usage or create a category-period budget |
| GET/PATCH/DELETE | `/budgets/:id` | Read, update, or delete an owned budget |
| GET | `/budgets/:id/usage` | Return spent, remaining, and usage percentage |
| GET/POST | `/debts` | List outstanding amounts or create a debt/loan |
| GET/PATCH | `/debts/:id` | Read or update an owned debt |
| GET/POST | `/debts/:id/payments` | List payments or record an owned debt payment |
| GET | `/reports/summary` | Filtered income/expense totals and account balances |
| GET | `/reports/income-expense` | Filtered monthly income/expense series |
| GET | `/reports/category-expenses` | Filtered expense totals by category |
| GET | `/reports/export` | Export filtered report entries as CSV |
| GET | `/notifications` | List warnings and return `meta.unreadCount` |
| PATCH | `/notifications/:id/read` | Mark one owned notification read |
| PATCH | `/notifications/read-all` | Mark all of the user's notifications read |

Transaction query filters include `type`, `accountId`, `categoryId`, `startDate`, `endDate`, and `search`; list requests also support `page`, `limit`, `sortBy`, and `order`. Report endpoints accept date, type, account, and category filters. Date-only bounds are interpreted in `Asia/Ho_Chi_Minh`; supplied timestamps retain their explicit offset.

Amounts are whole-number VND. API data is persisted in MongoDB; see [database design](./database-design.md).

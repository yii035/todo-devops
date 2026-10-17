# FinTrack

FinTrack is a Vietnamese personal-finance app prototype with a React/Vite client and an Express/TypeScript API.

## Run locally

Requirements: Node.js 20+, npm, and MongoDB Atlas or a MongoDB replica set (multi-document transactions require replica-set support).

```powershell
npm install
Copy-Item server\.env.example server\.env
# Set MONGODB_URI and JWT_SECRET in server\.env
npm run seed --workspace server
npm run dev
```

The Vite client runs at `http://localhost:5173`; the API runs on the `PORT` configured in `server\.env`. The client proxies `/api` requests to port 4000 by default. For this local workspace, `client\.env.local` points to the API port configured in `server\.env`.

To build both workspaces:

```powershell
npm run build
```

To run the API workflow tests against the configured MongoDB database:

```powershell
npm test --workspace server
```

The seed command is safe to re-run and creates the demo account `demo@fintrack.local` with password `password123`, multiple accounts, several months of transactions, budgets, one debt/payment, and notifications. Registration creates private account and category records for new users.

`server\.env` is local configuration and is ignored by Git. Never commit it or paste database credentials into source files or documentation. The API does not start when MongoDB is unreachable; it will not silently use volatile mock data.

### Google sign-in

Create an OAuth 2.0 Web application client in Google Cloud Console and add your app URL to **Authorized JavaScript origins** (for local development, `http://localhost:5173`). Set `GOOGLE_CLIENT_ID` in `server\.env`. Google Identity Services ID tokens are verified by the API, so this sign-in flow does not require a client secret or an authorized redirect URI.

For Docker Compose, set `GOOGLE_CLIENT_ID` in the root `.env` and authorize the app's public origin in Google Cloud Console.

## Run with Docker Compose

Requirements: Docker Engine with the Compose plugin.

```powershell
Copy-Item .env.example .env
# Set a unique, long JWT_SECRET in .env
docker compose up --build -d
```

Compose starts the FinTrack client/API, a MongoDB replica set for transaction support, and Prometheus. Open `http://localhost:4010` for FinTrack and `http://localhost:9090` for Prometheus. The API health check is available at `http://localhost:4010/api/health`; Prometheus scrapes API metrics at `/metrics`.

To stop the stack, run `docker compose down`. Add `-v` only when you also want to delete the persisted MongoDB and Prometheus data. Keep `.env` local and never commit it.

## Implemented workflows

- Registration, login, logout, current-user lookup, profile/currency settings, and password changes.
- Income, expense, and transfer validation; transaction search, date/type/account/category filters, sorting, pagination, edits, deletion, and CSV export.
- Account balances calculated from opening balances, transactions, transfers, and debt payments.
- Personal/system category ownership and archive safeguards.
- Budget usage and threshold warnings based only on eligible expenses.
- Debt outstanding balances, payment history, account effects, and due warnings.
- Dashboard summaries, monthly chart data, recent activity, and reports.
- Notification listing and read/unread actions.

See [API documentation](./docs/api-documentation.md), [use cases](./docs/use-cases.md), and [database design](./docs/database-design.md) for current behavior and known boundaries.

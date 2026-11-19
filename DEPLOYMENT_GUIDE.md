# Railway Deployment Guide

Charge Hub Admin runs on **Railway** as three services in one project, published on GoDaddy subdomains of `magnertia.in`:

| Service | Source | Builds from | Port | Public domain |
| :--- | :--- | :--- | :--- | :--- |
| `charge-hub-frontend` (Next.js operator dashboard) | repo root `/` | `Dockerfile` | 3000 | `operator.magnertia.in` |
| `charge-hub-backend` (Express API, Socket.io, OCPP 1.6J) | `/backend` | `backend/Dockerfile` | `$PORT` | `operator-api.magnertia.in` |
| `Postgres` (Railway PostgreSQL) | Railway template | – | 5432 (private) | none |

- Health checks: frontend `GET /health`; backend `GET /api/health` (returns 503 until the database is connected and migrated).
- Database migrations in `backend/drizzle/` run automatically when the backend starts. No manual SQL is needed.
- The same backend serves the **mobile app** (customers) and this **operator dashboard** (station owners and admins).
- OCPP chargers connect to `wss://operator-api.magnertia.in/ocpp/<stationNumber>` (subprotocol `ocpp1.6`).

---

## 1. Railway project (infrastructure as code)

The Railway project is **`charge-hub-operator`** (workspace "Magnertia Private Limited's Projects", region Southeast Asia).
Its services, repo, branch, root directories, Dockerfiles and health checks are defined in
[`.railway/railway.ts`](.railway/railway.ts), which replaces the old `railway.json` files (Config as Code was retired on 2026-12-01).
Variables are **not** managed by that file. Set them in the dashboard or with `railway variables`.

```sh
npm install                      # installs the `railway` SDK (dev dependency)
railway link                     # choose charge-hub-operator / production
railway config plan              # preview changes (safe)
railway config apply             # apply them
```

On Windows Git Bash, if the SDK complains about the CLI version, run the commands from PowerShell, or prefix them
with `_=<path to railway.exe>`.

**After merging the PR:** in `.railway/railway.ts` change `BRANCH` to `"main"`, then run `railway config apply`.

## 2. Environment variables

Use each service's **Variables → Raw Editor**. The full annotated lists are in
[`backend/.env.example`](backend/.env.example) and [`.env.example`](.env.example).

### Backend (`charge-hub-backend`)

| Variable | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable; private network) |
| `JWT_SECRET` | a new long random string; generate in Railway with `${{secret(64)}}` |
| `ADMIN_EMAILS` | the platform admin email(s), comma-separated |
| `CORS_ORIGIN` | `https://operator.magnertia.in` (add the Railway frontend URL during cutover) |
| `GST_PERCENT` | `18` |
| `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET` | Cloudinary (station images) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (same as frontend) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay |
| `FIREBASE_SERVICE_ACCOUNT_JSON`, `RESEND_API_KEY`, `EMAIL_FROM`, `MSG91_*` | optional notifications |
| `OCPP_SIMULATOR` | `true` while demo stations exist; `false` once only real chargers remain |
| `PAYMENTS_DEMO_MODE`, `OTP_DEBUG` | **`false`** in production (the server logs a warning if they are on) |

### Frontend (`charge-hub-frontend`)

| Variable | Value |
| :--- | :--- |
| `PORT` | `3000` |
| `NEXT_PUBLIC_API_URL` | `https://operator-api.magnertia.in` |
| `BACKEND_API_URL` | `http://${{charge-hub-backend.RAILWAY_PRIVATE_DOMAIN}}:${{charge-hub-backend.PORT}}` (or the public API URL) |
| `NEXTAUTH_URL` | `https://operator.magnertia.in` |
| `NEXTAUTH_SECRET` | `${{secret(64)}}` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional |

Notes:
- `NEXT_PUBLIC_*` values are compiled into the browser bundle at **build** time; **redeploy** the frontend after changing them.
- **First deploy (before DNS):** generate Railway domains (**Settings → Networking → Generate Domain**), use them for
  `NEXT_PUBLIC_API_URL` / `NEXTAUTH_URL`, and add the frontend's Railway URL to `CORS_ORIGIN`
  (comma-separated, e.g. `https://operator.magnertia.in,https://charge-hub-frontend-production.up.railway.app`).

## 3. First admin

Admins are created in either of two ways:
- Put the email in `ADMIN_EMAILS`. That account becomes admin at every start, once it exists (after a Google sign-in or the migration).
- Or run once from your computer (needs the [Railway CLI](https://docs.railway.com/guides/cli) and `npm install` in `backend/`):
  ```sh
  cd backend
  railway link            # choose the project and the charge-hub-backend service
  railway run --service charge-hub-backend -- sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL node scripts/create-admin.js --email you@magnertia.in --name "Your Name"'
  ```
  It prints a one-time 6-digit PIN. Change it under **Settings** after signing in.
  (`DATABASE_PUBLIC_URL` comes from the Postgres service. Add it to the backend as `${{Postgres.DATABASE_PUBLIC_URL}}` if `railway run` does not see it.)

Admins then create **station owner** accounts under **Users → Add owner** and assign stations to them in the station form.
Owners see only their own stations, sessions, payments and customers.

## 4. One-time data migration from MongoDB Atlas

Copies users, stations, sessions/transactions, payments, faults, alerts, notifications, device tokens, audit logs and
the last 30 days of telemetry. Mongo ObjectIds are kept as the new IDs, so the mobile app's stored IDs stay valid.
User PINs (bcrypt) carry over unchanged.

```sh
cd backend && npm install
# Dry run first (reads everything, writes nothing)
MONGO_URI="mongodb+srv://..." DATABASE_URL="<Postgres DATABASE_PUBLIC_URL>" ADMIN_EMAILS="you@magnertia.in" \
  node scripts/migrate-from-mongo.js --dry-run
# Real run
MONGO_URI="mongodb+srv://..." DATABASE_URL="<Postgres DATABASE_PUBLIC_URL>" ADMIN_EMAILS="you@magnertia.in" \
  node scripts/migrate-from-mongo.js
```

Options: `--wipe` (empty Postgres first), `--real-stations` (do not mark stations as simulated; by default migrated
stations are demo/simulated), `--telemetry-days=N`.

After the migration:
- Users who own stations become **owners**, `ADMIN_EMAILS` become **admins**, everyone else a **customer**.
- Stations get GST 18%. Owners are kept; stations whose owner no longer exists go to a blocked "Unassigned Owner" for you to reassign.
- Sessions that were still open are closed with reason `migrated_open_session`.
- Then delete the Atlas cluster (or at least rotate its password). Nothing uses MongoDB any more.

## 5. Custom domains on GoDaddy

For each app service: **Settings → Networking → Custom Domain**, enter `operator.magnertia.in` (frontend, port 3000)
or `operator-api.magnertia.in` (backend). Railway shows the DNS records to create.

In GoDaddy, go to **My Products → magnertia.in → DNS → Manage DNS → Add New Record**:

| Type | Name | Value |
| :--- | :--- | :--- |
| CNAME | `operator` | the `*.up.railway.app` target shown for the frontend |
| CNAME | `operator-api` | the target shown for the backend |
| TXT | as shown by Railway (e.g. `_railway-verify.operator`) | as shown by Railway |

Railway issues HTTPS certificates once DNS resolves (minutes to a few hours). Check with `nslookup operator.magnertia.in`.

## 6. Third-party dashboards

- **Google Cloud Console → Credentials → OAuth client:**
  - Authorized JavaScript origin: `https://operator.magnertia.in`
  - Redirect URI: `https://operator.magnertia.in/api/auth/callback/google`
- **Razorpay → Settings → Webhooks:**
  - URL: `https://operator-api.magnertia.in/api/payments/webhook`
  - Events: `payment.captured`, `payment.failed`
  - Put the webhook secret in `RAZORPAY_WEBHOOK_SECRET`.
- **Chargers (OCPP 1.6J):**
  - Central System URL: `wss://operator-api.magnertia.in/ocpp/<stationNumber>`. The station number is shown in the dashboard.
  - Only registered stations can connect.
  - If you set a charger password on the station, configure the same password as HTTP Basic Auth on the charger.

## 7. How charging and billing work

1. The customer chooses kWh in the app. The backend returns a quote: energy × price for the current IST time window + convenience fee (₹0 or ₹2–5) + GST on both (18%).
2. After the Razorpay payment, the backend starts the charger remotely (idTag `user:<id>`). Prices are locked at payment time.
3. Charging stops automatically when the prepaid amount is used up (at 99%).
4. The final bill is capped at the prepaid amount, and the unused balance is refunded through Razorpay.
5. A refund is shown as **Refunded** only when Razorpay confirms it. Failed refunds show **Refund failed** with a **Retry refund** button under Payments.
6. If a paid order never starts charging within 15 minutes, it is refunded in full automatically.

## 8. Cutover checklist

1. All three services deploy green on Railway URLs. `/health` and `/api/health` return `ok`.
2. Create the first admin (step 3). Run the migration (step 4). Sign in, then check stations, users and payments.
3. Add custom domains and GoDaddy records, then wait for certificates.
4. Switch `NEXT_PUBLIC_API_URL`, `NEXTAUTH_URL` and `CORS_ORIGIN` to the `magnertia.in` URLs, then redeploy.
5. Update Google OAuth, the Razorpay webhook, the chargers and the mobile app's API URL.
6. Set `PAYMENTS_DEMO_MODE=false` and `OTP_DEBUG=false`. Set `OCPP_SIMULATOR=false` when there are no demo stations.
7. Shut down the Nimbuz environments and the MongoDB Atlas cluster.

## Local development

You need Node 20+ and a local PostgreSQL (or any Postgres URL).

```sh
npm install && (cd backend && npm install)
cp .env.example .env.local          # point NEXT_PUBLIC_API_URL / BACKEND_API_URL at http://localhost:5000
cp backend/.env.example backend/.env # set DATABASE_URL, JWT_SECRET, ADMIN_EMAILS; PAYMENTS_DEMO_MODE/OTP_DEBUG=true for testing
npm run dev                          # backend (5000) + Next.js (3000)
node backend/scripts/create-admin.js --email you@example.com --name "You"
```

After changing `backend/db/schema.js`, generate a migration with `cd backend && npx drizzle-kit generate --name <change>`.

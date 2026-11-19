# EV Charge Operator Dashboard

This repo is the operator portal for the EV Charge network. It shares one backend with the customer mobile app.

**Who uses it**
- **Admins** manage everything: stations, owners, pricing and GST, customers, and refunds.
- **Station owners** see only their own stations, live sessions, payments, faults and customers.

**What it includes**
- **Frontend:** Next.js 14 (App Router), signed in with a PIN or Google (NextAuth).
- **Backend:** Express 5 with PostgreSQL (Drizzle ORM), Socket.io for live updates, and an OCPP 1.6J central system for the chargers.
- **Payments:** Razorpay prepaid charging with 18% GST. Charging stops automatically when the prepaid amount runs out, and the unused balance is refunded.

Production runs on Railway at `operator.magnertia.in` (dashboard) and `operator-api.magnertia.in` (API).
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

## Requirements

- Node.js 20+
- PostgreSQL 14+ (local install, Docker `postgres:16`, or any hosted Postgres URL)

## Run locally

```sh
git clone https://github.com/Srimunn/charge-hub-admin.git
cd charge-hub-admin
npm install && (cd backend && npm install)

cp backend/.env.example backend/.env
#   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/charge_hub
#   JWT_SECRET=<any long random string>
#   PAYMENTS_DEMO_MODE=true and OTP_DEBUG=true for local testing only
cp .env.example .env.local
#   NEXT_PUBLIC_API_URL=http://localhost:5000  BACKEND_API_URL=http://localhost:5000
#   NEXTAUTH_URL=http://localhost:3000  NEXTAUTH_SECRET=<any long random string>

npm run dev        # starts the backend (5000) and Next.js (3000); DB migrations run automatically
node backend/scripts/create-admin.js --email you@example.com --name "You"   # prints a one-time PIN
```

Sign in at http://localhost:3000 with that email and PIN.

## Try the charging flow without hardware

1. **Stations → Add station.** As an admin, switch on **Demo station (simulated charger)**. A built-in simulator connects to it over OCPP.
2. **Live Sessions → Start test session.** Choose the station to send a remote start as an operator.
3. On the session card, use **Simulate fault** (over-temperature, over-voltage, E-stop and others). The session stops and the station shows **Fault** everywhere in real time.
4. Go to **Faults & Alerts → Resolve** to bring the station back online.

Customer charging (pay → charge → automatic stop → refund) runs from the mobile app. With `PAYMENTS_DEMO_MODE=true` you
can exercise it through the API with `pay_mock_*` payment IDs.

## Project layout

| Path | What |
| :--- | :--- |
| `app/`, `components/`, `services/api.ts` | Next.js dashboard |
| `backend/server.js` | Express app, Socket.io, maintenance jobs |
| `backend/db/schema.js`, `backend/drizzle/` | Database schema and SQL migrations |
| `backend/services/ocppCentralSystem.js` | OCPP 1.6J central system (`/ocpp/<stationNumber>`) |
| `backend/services/chargingService.js`, `pricing.js` | Billing, GST, prepaid limit, refunds |
| `backend/scripts/` | `create-admin.js`, `migrate-from-mongo.js` (one-time Atlas → Postgres) |

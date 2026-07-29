# Mighty Clean — Inventory Management App

A full-stack inventory management system: React frontend + Node/Express API +
PostgreSQL database. Built from your inventory screenshot and data-flow diagram.

## What's included

| Diagram process | Where it lives |
|---|---|
| 1.0 Login | `backend/src/routes/auth.routes.js`, `frontend/src/pages/Login.jsx` |
| 2.0 Display Dashboard | `frontend/src/pages/Dashboard.jsx` |
| 3.0 Stock Entry / 5.0 Manage Inventory | `frontend/src/pages/Inventory.jsx` |
| 4.0 Generate QR | `GET /api/inventory/:id/qrcode` |
| 6.0 Scan Item QR / 7.0 Record Sales | `frontend/src/pages/Sales.jsx` |
| 8.0 Process Returns | `frontend/src/pages/Returns.jsx` |
| 9.0 Display Graphs and Analytics | Chart on the Dashboard |
| 10.0/11.0 Generate Reports | `frontend/src/pages/Reports.jsx` (printable) |

Roles: **admin**, **inventory_staff**, **sales_staff** — each sees only the
nav items and actions they're allowed to use (matching "Manage" vs "View" in
your diagram).

## 1. Prerequisites

Install **Node.js 18+**: https://nodejs.org (LTS version). Check with:
```bash
node -v
```

You'll also need a PostgreSQL database. For local development, either:
- Install Postgres locally (https://www.postgresql.org/download/), or
- Use a free Render Postgres instance and point your local `.env` at it.

## 2. Run the backend (API + database)

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set DATABASE_URL to your Postgres connection string
npm run dev
```
This starts the API on `http://localhost:4000`. On first run it creates all
tables automatically and seeds:

- Demo accounts: `admin` / `admin123`, `inventory` / `inventory123`, `sales` / `sales123`
- The 4 sample products from your screenshot (Fabcon Blue Bliss, etc.)

## 3. Run the frontend

Open a **second terminal**:
```bash
cd frontend
npm install
npm run dev
```
Then open the URL it prints (usually `http://localhost:5173`).

In local dev, the frontend proxies `/api` calls to the backend automatically
(see `frontend/vite.config.js`), so both servers need to be running at once.

## 4. Try it out

1. Log in as `admin` / `admin123`.
2. **Inventory** — add/edit/delete products, view/download a QR code per item.
3. **Sales** (admin or sales role) — click "Start camera scan" to scan a
   printed QR code with your webcam/phone camera, or type a product code
   manually (try `1001`), then record the sale.
4. **Returns** — put stock back by product code.
5. **Reports** — generate and print inventory/sales reports.
6. **Employees** (admin only) — create accounts for inventory/sales staff.
7. **Dashboard** — overview stats and a 7-day sales chart.

## Notes for a beginner picking this back up

- The backend is Express + `pg` (node-postgres) — no ORM, just SQL you can
  read directly in `backend/src/routes/*.js`.
- The frontend is React + Vite with `react-router-dom` for pages and
  `recharts` for the chart.
- Auth uses a JWT stored in `localStorage`; `frontend/src/api.js` attaches it
  to every request automatically.
- To reset all data, connect to your Postgres database and drop the tables
  (`users`, `products`, `customers`, `transactions`) — they'll be recreated
  and reseeded automatically next time the backend starts.

## 5. Deploying to Render

This repo includes a `render.yaml` blueprint that provisions everything in
one shot: a Postgres database, the backend as a Web Service, and the
frontend as a Static Site.

### Option A — one-click blueprint deploy
1. Push this repo to GitHub (or GitLab).
2. In the Render dashboard, click **New → Blueprint** and point it at your repo.
3. Render reads `render.yaml` and creates all three resources automatically,
   wiring `DATABASE_URL` from the database into the backend, and generating
   a random `JWT_SECRET`.
4. Once the backend has deployed, copy its actual URL from the Render
   dashboard (it may not exactly match the guess in `render.yaml`). Update
   the frontend service's `VITE_API_URL` env var to
   `https://<your-actual-backend-url>.onrender.com/api`, then trigger a
   manual redeploy of the frontend so the build picks up the new value.

### Option B — manual setup
1. **Database**: New → PostgreSQL. Once created, copy its "Internal
   Database URL."
2. **Backend**: New → Web Service, root directory `backend`, build command
   `npm install`, start command `npm start`. Add env vars:
   - `DATABASE_URL` = the internal connection string from step 1
   - `JWT_SECRET` = any long random string
   - `NODE_ENV` = `production`
3. **Frontend**: New → Static Site, root directory `frontend`, build command
   `npm install && npm run build`, publish directory `dist`. Add env var:
   - `VITE_API_URL` = `https://<your-backend-service>.onrender.com/api`
4. Because this is a client-side-routed React app, add a rewrite rule on the
   static site so deep links (e.g. `/inventory`) don't 404: source `/*`,
   destination `/index.html` (already included in `render.yaml`).

### Why Postgres instead of the original SQLite file
Render's web services have an ephemeral filesystem — a SQLite file would be
wiped on every redeploy or restart. Postgres persists independently of the
app, so this was rewritten from `better-sqlite3` to `pg` specifically for
production use. Locally, `backend/.env.example` shows how to point at either
a local Postgres install or a Render-hosted one.

## Where to go next

- Add pagination to the inventory table once you have lots of products.
- Add per-employee sales totals to the Reports page.
- Consider connection pooling limits if you're on Render's free Postgres
  tier — the default `pg` Pool settings are fine for this app's scale.

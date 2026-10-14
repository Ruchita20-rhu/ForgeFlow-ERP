# ForgeFlow ERP — PERN Technical Case Study

A compact ERP workflow for industrial sales: **Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch**.

## Stack
- PostgreSQL relational database
- Node.js + Express REST API
- React + Vite frontend
- JWT authentication, bcrypt password hashing, backend role-based access control
- `pg` for SQL and explicit transactions; Node's built-in test runner + Supertest

## Prerequisites
- Node.js 20+
- PostgreSQL 14+
- npm

## Setup
1. Create a PostgreSQL database and user, for example:
   ```sql
   CREATE USER forgeflow WITH PASSWORD 'forgeflow_dev';
   CREATE DATABASE forgeflow OWNER forgeflow;
   ```
2. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL` and `JWT_SECRET`.
3. Copy `client/.env.example` to `client/.env`.
4. Install dependencies:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
5. Create schema and sample data:
   ```bash
   cd server
   npm run db:setup
   ```
6. Start API and frontend in separate terminals:
   ```bash
   # terminal 1
   cd server && npm run dev
   # terminal 2
   cd client && npm run dev
   ```
   Frontend: http://localhost:5173 — API: http://localhost:4000/api

## Demo credentials
- Admin: `admin@forgeflow.local` / `Admin123!`
- Sales: `sales@forgeflow.local` / `Sales123!`

Change demo credentials and JWT secret before any real deployment.

## Database / migrations
- `server/src/db/schema.sql` contains normalized relational tables, constraints, foreign keys, indexes, and status checks.
- `server/src/db/seed.js` inserts users, 8 industrial products, and opening inventory.
- `npm run db:setup` applies schema then seeds.
- `server/docs/erd.mmd` is a Mermaid ER diagram.

## Tests
```bash
cd server
npm test
```
The automated suite covers quotation calculations, draft/rejected conversion rules, duplicate conversion policy, stock availability validation, invalid quantities, and role authorization. The reservation endpoint uses PostgreSQL row locks to serialize competing requests; add a database-backed concurrency test before treating this as production-ready.

## API docs
See `server/docs/API.md` for endpoints, roles, request examples, and business rules.

## Main business rules
- Monetary values are calculated server-side using decimal-safe arithmetic (integer cents internally for calculations and numeric columns in PostgreSQL).
- Confirmation locks inventory rows with `SELECT ... FOR UPDATE` inside a transaction, validates all requested quantities, and reserves all lines atomically.
- A quotation can convert to only one sales order (unique `quotation_id` plus transaction).
- Dispatch reduces both physical and reserved stock, in a transaction, and only for confirmed orders.
- Available quantity is `physical_quantity - reserved_quantity`; schema constraints prevent negative stock and reservation over physical stock.
- APIs return consistent JSON errors and validate request input.

## Submission notes
This is a runnable starter implementation designed around the case-study requirements. Read the code and practice explaining the schema, transaction/locking strategy, authentication, and role checks before a live verification round.

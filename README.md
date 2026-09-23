# OneDesk

A lead-to-cash system for Brightpath Consulting: a company and a contact
become a deal, a won deal becomes a project, and logged hours roll up
against what was sold.

## Stack

Two separate npm packages — there is **no root `package.json`**.

**`server/package.json`**
- Runtime: Express `^5.2.1`, Prisma / `@prisma/client` `^6.19.3`, `bcryptjs`, `cors`, `dotenv`, `nodemailer`
- Dev: `nodemon` `^3.1.14`
- Scripts: `dev` (nodemon `src/index.js`), `start` (`node src/index.js`), `test` (`node --test`), `seed` (`node prisma/seed.js` — **wipes all tables**)

**`client/package.json`**
- Runtime: `react` / `react-dom` `^19.2.8` only (no router package — hash routes in `App.jsx`)
- Dev: Vite `^8.3.0`, `@vitejs/plugin-react`, ESLint 10
- Scripts: `dev`, `build`, `preview`, `lint`

Auth is email/password (bcrypt) plus hourly rate at signup; see [Auth model](#auth-model).
Postgres is **not** an npm package: Prisma talks to PostgreSQL. Hosted
data lives on [Neon](https://console.neon.tech/app/projects/twilight-sunset-97887745/branches/br-falling-mode-aztkx39q/tables?database=neondb)
(`neondb`). `docker-compose.yml` is only for a local Postgres 16 if you
do not want to use Neon.

## Prerequisites
- Node.js 20+
- A Postgres URL (Neon, or Docker Desktop + `docker compose up -d db`)

## Setup (under 10 minutes)

The API reads `DATABASE_URL` from `server/.env`. Point it at Neon
(Connection string from the Neon console, database `neondb`, usually
`?sslmode=require`) or at local Docker.

```bash
git clone https://github.com/kalanig23/onedesk.git
cd onedesk

# 1. Postgres — pick one
# Neon (what this project uses in prod): copy the connection string into
# server/.env as DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
#
# Or local Docker:
# echo POSTGRES_PASSWORD=onedesk > .env
# docker compose up -d db
# DATABASE_URL=postgresql://onedesk:onedesk@localhost:5432/onedesk?schema=public

# 2. Backend
cd server
cp .env.example .env          # then set DATABASE_URL
npm install
npx prisma migrate dev
npm run dev                   # http://localhost:4000

# 3. Frontend (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173 and **register**. There is no demo seed.

- If no admin exists yet, Register offers **Admin** (`GET /api/auth/bootstrap`).
- After that, people pick **sales**, **manager** or **member** and enter
  their own **hourly rate (₹)**. That rate is stored on `User.hourlyRate`
  and frozen onto each time entry as `rateAtEntry`.
- An admin can later change anyone's rate from the People page.

`npm run seed` in `server/` **wipes every table**. It does not insert
Priya/Ravi or sample deals. Production API: `npm start` (no nodemon).
Frontend production bundle: `cd client && npm run build` (needs
`VITE_API_URL` at build time). Local Vite proxies `/api` to
`http://127.0.0.1:4000`.

Optional SMTP: set `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` in
`server/.env` if `nodemailer` should actually send. Otherwise each send is
stored as `OutboundEmail` with `via: "outbox"`.

## Tests

```bash
cd server
npm test
```

52 tests across 10 files (`npm test` → `node --test` in `server/`). They cover budget math, deal stage rules, the
deal→project conversion (double-conversion guard + optimistic lock), time
validation (including assignee-only logging), manager vs member task
rules, forecast/quiet-deal math, proposal emails, and the HTTP API (auth,
admin rate updates, deals, projects, time) against a real database.

## What I built

### Sales pipeline
- Accounts and contacts. Creating an account can include the first
  contact so they show up in Deals → Spoke to.
- Deals: `new → qualified → proposal_sent → won | lost`, with
  `DealStageChange` history. Sales (Priya in the story) moves stages;
  the contact only receives mail.
- Creating a deal auto-creates one proposal line from the deal's days and
  value (`dailyRate = round(value/days)`). Extra work items are optional.
- **Forecast** (current calendar quarter, e.g. Q3 2026): stage-weighted
  pipeline of deals whose `expectedCloseDate` falls in that quarter, plus
  deals quiet for 120 days.
- Optimistic locking (`Deal.version`): two concurrent edits → 409 refresh.

### Outbound email
- **Email proposal** on the deal page goes to the spoke-to contact and
  moves the deal to `proposal_sent`.
- Account page can log “We spoke” (and optionally email a follow-up).
  Those mails are `OutboundEmail` rows (`via: smtp | outbox`).

### Delivery
- Won converts to a `Project` in one transaction and **copies** sold
  days/amount so later deal edits cannot change what was sold.
- **Manager** (and admin): add people, create/assign/delete tasks, close
  the project. Sees every project.
- **Member**: only projects they are on; all tasks visible for progress;
  can change status only on their own tasks; **Log time** lists only
  assigned tasks. Hours are rejected unless `task.assigneeId === user`.
- Budget vs actual (icon + text, not colour alone), first overrun date,
  draft invoice by person.

### Admin
- Sees sales and delivery screens plus **People**: role, deals, projects,
  recent time, and an editable hourly rate (`PATCH /api/admin/people/:id`).

### Access model
Enforced on the API (`salesOnly` / `deliveryOnly` / `adminOnly` /
`canManageDelivery` in `authz.js`), not only in the nav.

| Role | Screens |
|---|---|
| sales | Forecast, Deals, Accounts |
| manager / member | Projects, Log time |
| admin | all of the above + People |

## Auth model

Passwords are bcrypt-hashed. Login returns the user; the client stores
`id` in `localStorage` and sends `x-user-id`. There is no signed cookie or
JWT — enough to demo roles, not enough to ship. See DESIGN.md A3 Q4.

## Failure cases I handled end to end

1. **Converting an already-converted deal** — unique `Project.dealId` plus
   a stage-rule check.
2. **Logging time to a closed project** — create, edit, and delete.
3. **Absurd hours / over 24h in a day** — app validation, a DB CHECK, and
   a running daily total (including edits).
4. **Two people editing the same deal** — optimistic `version` → 409.
5. **Member assigning work or logging someone else's task** — 403; only
   the assignee can log hours.

These map to money and trust: a duplicated project doubles a budget, hours
on a closed project corrupt a reported number, a stolen task would bill
the wrong person, and a lost concurrent edit would mean two salespeople
disagreeing about the deal.

## Known limitations / what I'd do next

- Time entries can be edited/deleted with no audit trail (deals keep
  stage history). DESIGN.md A3 Q3.
- Budget sums time entries in Node. Fine at current scale; at millions of
  rows use SQL `SUM`/`GROUP BY` (A3 Q5).
- Serializable time logging is not covered by an automated concurrency
  test (deal optimistic lock is).
- Fake session after a real password (A3 Q4).
- 1 day = 8 hours is my assumption for the days view.

## AI use

I used an AI assistant to help scaffold the project (Express setup, Prisma
schema, React structure) and to debug. Business rules (deal-to-project
hinge, validation, what counts as a failure case, manager vs member) were
my decisions, and I can walk through any file.

## Time spent

[fill in honestly once everything is done, e.g. "~11 hours over 5 days"]

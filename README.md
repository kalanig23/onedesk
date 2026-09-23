# OneDesk

A lead-to-cash system for Brightpath Consulting: a lead becomes a deal, a won
deal becomes a project, logged hours roll up against what was sold.

## Stack
- Backend: Node.js + Express 5
- Database: PostgreSQL (via Docker)
- ORM: Prisma
- Frontend: React 19 (Vite)
- Auth: email/password (bcrypt), see [Auth model](#auth-model) below
- Tests: Node's built-in test runner (`node --test`)

## Prerequisites
- Node.js 20+
- Docker Desktop

## Setup (under 10 minutes)

```bash
git clone https://github.com/kalanig23/onedesk.git
cd onedesk

# 1. Start Postgres
cp .env.example .env          # edit POSTGRES_PASSWORD if you like, default works
docker compose up -d db

# 2. Backend
cd server
cp .env.example .env          # DATABASE_URL uses the same password as above
npm install
npx prisma migrate dev
npm run dev                   # http://localhost:4000

# 3. Frontend (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173 and register. The first account can be **Admin**;
after that, an admin already exists so everyone else picks sales, manager or
member and enters their own hourly rate (₹/hour). Nothing is seeded —
accounts, deals and projects are created in the app. `npm run seed` in
`server/` doesn't fill in demo data; it wipes every table so you can start
from a clean slate.

Optional: if you want outbound emails (see below) to actually leave the
server instead of being written to the database as an "outbox" row, set
`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` in `server/.env`.

## Tests

```bash
cd server
npm test
```

~57 tests across 10 files. Covers the budget calculation, deal stage rules,
the deal→project conversion (including the double-conversion guard and the
optimistic-locking conflict), time entry validation, the forecast/quiet-deal
math, proposal emails, and the full API (auth, admin, deals, projects,
time entries) against a real database.

## What I built

### Sales pipeline (Tier 1 + 2)
- Accounts and contacts, with a "last spoken to" log per contact
- Deals with a five-stage pipeline (`new → qualified → proposal_sent → won /
  lost`) and a full stage-change history
- A proposal builder on each deal: work items priced as days × daily rate,
  rolling up to the deal's expected value/days
- **This quarter**: a stage-weighted forecast of what's likely to close,
  plus a list of deals that have gone quiet for four months
- Optimistic locking on deals (a `version` column) — if two people edit the
  same deal at once, the second save is rejected with a "please refresh"
  error instead of silently overwriting

### Outbound email (Tier 2/3)
- Sending a proposal, or logging a "spoke to" call, can email the contact
  a plain-text message built from the deal/contact data
  (`services/mail.js`)
- Every email is written to an `OutboundEmail` table either way. If
  `SMTP_HOST` isn't set, it's saved with `via: "outbox"` instead of actually
  sent — so the feature is fully demoable and testable without a mail
  server (`services/outbound.js`)

### Delivery (Tier 1)
- Marking a deal Won converts it into a project in one transaction, copying
  the sold budget so later deal edits don't change what was already sold
- Tasks, project membership, and time entries (billable/non-billable)
- Time entries can be edited or deleted by the person who logged them
  (subject to the same 24h/day and closed-project checks as creating one)
- Budget vs actual: sold days/amount vs burned, with an over-budget signal
  shown with an icon and text, not colour alone, plus the date burn first
  crossed the budget
- A per-project draft invoice, grouping billable hours and amount by person

### Admin
- An admin can see every screen (sales and delivery) plus a **People**
  page: everyone's role, hourly rate, owned deals, managed/assigned
  projects, and their 8 most recent time entries — and can edit anyone's
  hourly rate

### Access model
Sales (role `sales`) sees Accounts, Deals and Forecast. Delivery (`manager`
/ `member`) sees Projects and Log time — the timesheet and budget tools
Ravi's team uses after a deal is Won. `admin` sees everything above plus
the People page. This is enforced server-side per route
(`salesOnly`/`deliveryOnly`/`adminOnly` in `authz.js`), not just hidden in
the nav.

## Auth model

Registration and login are real: passwords are hashed with bcrypt, and
`/api/auth/login` checks them before returning the user. What's *not* real
yet is the session: the client just remembers the returned user's id in
`localStorage` and resends it as an `x-user-id` header on every request —
there's no signed token or cookie. That's enough to build and test the
role-based features above, but it means anyone who can edit `localStorage`
in devtools can impersonate any user id. See DESIGN.md A3 Q4 for what I'd
do to fix this before shipping it.

## Failure cases I handled end to end

1. **Converting an already-converted deal** — blocked by both a unique
   constraint on `Project.dealId` and a stage-rule check, with a readable
   error in the UI.
2. **Logging time to a closed project** — blocked in the API with a message
   explaining why, for creating, editing, and deleting an entry.
3. **Absurd hours / over 24h in a day** — a single entry is capped at 24h by
   both application validation and a database CHECK constraint; the running
   daily total across entries is also checked, including on edits.
4. **Two people editing the same deal at once** — an optimistic `version`
   check on the deal rejects the second write with a "please refresh" error
   instead of silently discarding one person's change.

I chose these because they map directly to money and trust: a duplicated
project would double a client's budget, a closed project receiving new
hours would corrupt a number Brightpath already reported, bad hours would
poison the "we never want to be surprised again" number, and a lost
concurrent edit would mean sales and their manager disagreeing about what a
deal actually says.

## Known limitations / what I'd do next

- Time entries can be edited and deleted, but there's no audit trail of
  what an entry used to say — unlike deals, which keep a full stage-change
  history. See DESIGN.md A3 Q3 for how I'd extend it.
- Budget calculation sums all time entries in memory. Fine at seed-data
  scale; at 2 million rows this needs a SQL-side SUM/GROUP BY (see A3 Q5).
- Concurrent time-logging uses a Serializable transaction but isn't covered
  by an automated concurrency test (deal edits' optimistic lock does have
  test coverage).
- Auth has real passwords but a fake session (see [Auth model](#auth-model)
  above and A3 Q4).
- 1 day = 8 hours is my own assumption for the days-based budget view.

## AI use

I used an AI assistant to help scaffold the project (Express setup, Prisma
schema boilerplate, React component structure) and to debug errors along
the way. All business logic decisions (the deal-to-project hinge, the
validation rules, what counts as a failure case) were made by me, and I can
walk through and modify any file.

## Time spent

[fill in honestly once everything is done, e.g. "~11 hours over 5 days"]
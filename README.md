# OneDesk

A lead-to-cash system for Brightpath Consulting: a lead becomes a deal, a won
deal becomes a project, logged hours roll up against what was sold.

## Stack
- Backend: Node.js + Express
- Database: PostgreSQL (via Docker)
- ORM: Prisma
- Frontend: React (Vite)
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

Open http://localhost:5173 and register. The first account can be **Admin**. Later people pick sales, manager or member and enter their own hourly rate (₹/hour). Nothing is seeded — accounts, deals and projects are created in the app.

## Tests

```bash
cd server
npm test
```

Covers the budget calculation, deal stage rules, the deal→project conversion
(including the double-conversion guard), and the full API with a real database.

## What I built (Tier 1)

- Accounts, contacts, deals with a stage pipeline and stage history
- Marking a deal Won converts it into a project in one transaction, copying
  the sold budget so later deal edits don't change what was already sold
- Tasks, project membership, and time entries (billable/non-billable)
- Budget vs actual: sold days/amount vs burned, with an over-budget signal
  shown with an icon and text, not colour alone

## Tier 2: Pipeline forecast

Sales (role `sales`) sees Accounts, Deals and **This quarter**: a weighted
forecast of what is likely to close, who was last spoken to, proposal line
items (days × daily rate), and deals that went quiet for four months.
Delivery (`manager` / `member`) sees Projects and Log time only — the
timesheet and budget tools Ravi’s team uses after a deal is Won.


## Failure cases I handled end to end

1. **Converting an already-converted deal** — blocked by both a unique
   constraint on `Project.dealId` and a stage-rule check, with a readable
   error in the UI.
2. **Logging time to a closed project** — blocked in the API with a message
   explaining why.
3. **Absurd hours / over 24h in a day** — a single entry is capped at 24h by
   both application validation and a database CHECK constraint; the running
   daily total across entries is also checked.

I chose these three because they map directly to money and trust: a
duplicated project would double a client's budget, a closed project
receiving new hours would corrupt a number Brightpath already reported, and
bad hours would poison the "we never want to be surprised again" number.

## Known limitations / what I'd do next

- Time entry edits and disputes are not built — the schema only stores the
  current value, not a history. See DESIGN.md A3 Q3 for how I'd extend it.
- Budget calculation sums all time entries in memory. Fine at seed-data
  scale; at 2 million rows this needs a SQL-side SUM/GROUP BY (see A3 Q5).
- Concurrent time-logging uses a Serializable transaction but isn't covered
  by an automated concurrency test.
- Login and registration exist. Nav is split by role: sales sees the
  pipeline, delivery sees projects and time.
- 1 day = 8 hours is my own assumption for the days-based budget view.

## AI use

I used an AI assistant to help scaffold the project (Express setup, Prisma
schema boilerplate, React component structure) and to debug errors along
the way. All business logic decisions (the deal-to-project hinge, the
validation rules, what counts as a failure case) were made by me, and I can
walk through and modify any file.

## Time spent

[fill in honestly once everything is done, e.g. "~11 hours over 5 days"]
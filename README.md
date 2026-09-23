# OneDesk

A lead-to-cash system for Brightpath Consulting: a company and a contact
become a deal, a won deal becomes a project, and logged hours roll up
against what was sold.

## Stack
- Backend: Node.js + Express 5
- Database: PostgreSQL (via Docker)
- ORM: Prisma
- Frontend: React 19 (Vite, hash routes)
- Auth: email/password (bcrypt) + hourly rate at signup; see [Auth model](#auth-model)
- Tests: Node's built-in test runner (`node --test`)

## Prerequisites
- Node.js 20+
- Docker Desktop

## Setup (under 10 minutes)

Docker Compose reads `POSTGRES_PASSWORD` from a **root** `.env`. The API
reads `DATABASE_URL` from `server/.env`.

```bash
git clone https://github.com/kalanig23/onedesk.git
cd onedesk

# 1. Postgres
echo POSTGRES_PASSWORD=onedesk > .env
docker compose up -d db

# 2. Backend
cd server
cp .env.example .env
# Set DATABASE_URL to the same user/password/db, e.g.
# postgresql://onedesk:onedesk@localhost:5432/onedesk?schema=public
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
Priya/Ravi or sample deals.

Optional SMTP: set `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` in
`server/.env` if proposal emails should leave the machine. Otherwise each
send is stored as `OutboundEmail` with `via: "outbox"`.

Production frontend (e.g. Vercel) needs `VITE_API_URL` pointing at a
hosted API. Local Vite proxies `/api` to `http://127.0.0.1:4000`.

## Tests

```bash
cd server
npm test
```

52 tests across 10 files. They cover budget math, deal stage rules, the
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

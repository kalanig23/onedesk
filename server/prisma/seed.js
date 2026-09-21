const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// n working days (Mon-Fri) pehle ki date
function weekdaysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return d;
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  // 1. Purana data saaf karo, taaki seed dobara chalane par duplicate na bane
  // (order important hai: pehle bacche, phir parent)
  await prisma.timeEntry.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.dealStageChange.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // 2. Team: 4 log, alag-alag hourly rate
  const priya = await prisma.user.create({
    data: { name: "Priya Sharma", email: "priya@brightpath.test", role: "sales", hourlyRate: 2500 },
  });
  const ravi = await prisma.user.create({
    data: { name: "Ravi Menon", email: "ravi@brightpath.test", role: "manager", hourlyRate: 2200 },
  });
  const anjali = await prisma.user.create({
    data: { name: "Anjali Rao", email: "anjali@brightpath.test", role: "member", hourlyRate: 2000 },
  });
  const karan = await prisma.user.create({
    data: { name: "Karan Shah", email: "karan@brightpath.test", role: "member", hourlyRate: 1500 },
  });

  // 3. 5 accounts
  const accountNames = [
    ["Acme Retail", "Retail"],
    ["Northwind Foods", "Food"],
    ["Bluepeak Logistics", "Logistics"],
    ["Sunrise Hospitals", "Healthcare"],
    ["Kite Education", "Education"],
  ];
  const accounts = [];
  for (const [name, industry] of accountNames) {
    accounts.push(await prisma.account.create({ data: { name, industry } }));
  }

  // 4. 8 contacts (ai batata hai kis company ka)
  const contacts = [
    [0, "Rohit Verma", "rohit@acme.test"],
    [0, "Sneha Kapoor", "sneha@acme.test"],
    [1, "Amit Joshi", "amit@northwind.test"],
    [1, "Neha Iyer", "neha@northwind.test"],
    [2, "Vikram Singh", "vikram@bluepeak.test"],
    [3, "Dr. Meera Nair", "meera@sunrise.test"],
    [4, "Arjun Das", "arjun@kite.test"],
    [4, "Pooja Bhatt", "pooja@kite.test"],
  ];
  for (const [ai, name, email] of contacts) {
    await prisma.contact.create({ data: { accountId: accounts[ai].id, name, email } });
  }

  // 5. 10 deals: 3 won, 2 lost, baaki 5 pipeline mein
  // path = deal kin stages se guzri (history isi se banegi)
  const dealDefs = [
    { key: "acmeWeb", ai: 0, title: "Website redesign", value: 480000, days: 40, close: "2026-08-15",
      path: ["new", "qualified", "proposal_sent", "won"] },
    { key: "northwindApp", ai: 1, title: "Ordering app", value: 400000, days: 30, close: "2026-08-30",
      path: ["new", "qualified", "proposal_sent", "won"] },
    { key: "bluepeakDash", ai: 2, title: "Operations dashboard", value: 250000, days: 20, close: "2026-09-01",
      path: ["new", "qualified", "proposal_sent", "won"] },
    { ai: 3, title: "Patient portal", value: 900000, days: 60, close: "2026-09-10",
      path: ["new", "qualified", "lost"], lostReason: "Client ka budget cut ho gaya" },
    { ai: 4, title: "LMS revamp", value: 650000, days: 45, close: "2026-09-05",
      path: ["new", "proposal_sent", "lost"], lostReason: "Client ne in-house team chuni" },
    { ai: 0, title: "Mobile app", value: 900000, days: 60, close: "2026-11-10",
      path: ["new", "qualified", "proposal_sent"] },
    { ai: 1, title: "Loyalty portal", value: 550000, days: 35, close: "2026-11-20",
      path: ["new", "qualified", "proposal_sent"] },
    { ai: 3, title: "Website refresh", value: 300000, days: 20, close: "2026-12-05",
      path: ["new", "qualified"] },
    { ai: 4, title: "Course marketplace", value: 700000, days: 45, close: "2026-11-30",
      path: ["new", "qualified"] },
    { ai: 2, title: "Fleet tracking", value: 1200000, days: 80, close: "2027-01-15",
      path: ["new"] },
  ];

  const deals = {};
  for (const def of dealDefs) {
    const finalStage = def.path[def.path.length - 1];
    const deal = await prisma.deal.create({
      data: {
        accountId: accounts[def.ai].id,
        title: def.title,
        stage: finalStage,
        expectedValue: def.value,
        expectedDays: def.days,
        expectedCloseDate: new Date(def.close),
        lostReason: def.lostReason || null,
        ownerId: priya.id,
      },
    });
    // Stage history: har badlav ek row
    for (let i = 1; i < def.path.length; i++) {
      await prisma.dealStageChange.create({
        data: {
          dealId: deal.id,
          fromStage: def.path[i - 1],
          toStage: def.path[i],
          changedById: priya.id,
          changedAt: daysAgo((def.path.length - i) * 12),
        },
      });
    }
    if (def.key) deals[def.key] = deal;
  }

  // 6. 3 projects (Won deals se): ek comfortably under, ek line ke paas, ek over budget
  // Budget: sold days aur amount deal se COPY hote hain
  const projectDefs = [
    { dealKey: "acmeWeb", name: "Acme website redesign", members: [anjali, karan, ravi], entries: 48 },
    { dealKey: "northwindApp", name: "Northwind ordering app", members: [ravi, anjali], entries: 56 },
    { dealKey: "bluepeakDash", name: "Bluepeak ops dashboard", members: [anjali, karan], entries: 48 },
  ];
  const taskTitles = ["Design", "Frontend build", "Backend build", "Testing"];
  const hoursCycle = [3, 4, 5, 4]; // average 4 ghante

  for (const pd of projectDefs) {
    const deal = deals[pd.dealKey];
    const project = await prisma.project.create({
      data: {
        dealId: deal.id,
        accountId: deal.accountId,
        name: pd.name,
        managerId: ravi.id,
        budgetDays: deal.expectedDays,
        budgetAmount: deal.expectedValue,
        members: { create: pd.members.map((u) => ({ userId: u.id })) },
      },
    });

    const tasks = [];
    for (let t = 0; t < taskTitles.length; t++) {
      tasks.push(
        await prisma.task.create({
          data: {
            projectId: project.id,
            title: taskTitles[t],
            assigneeId: pd.members[t % pd.members.length].id,
            status: t === 0 ? "done" : "in_progress",
          },
        })
      );
    }

    // Time entries: pichle ~6 hafte mein failaye hue
    const entries = [];
    for (let i = 0; i < pd.entries; i++) {
      const user = pd.members[i % pd.members.length];
      entries.push({
        taskId: tasks[i % tasks.length].id,
        userId: user.id,
        date: weekdaysAgo(30 - Math.floor((i * 30) / pd.entries)),
        hours: hoursCycle[i % 4],
        billable: i % 5 !== 4, // har 5vi entry non-billable
        note: i % 3 === 0 ? "Client feedback ke hisaab se kaam" : null,
        rateAtEntry: user.hourlyRate, // us din ka rate freeze
      });
    }
    await prisma.timeEntry.createMany({ data: entries });

    // Summary print karo, taaki dikhe budget ke saath kya hua
    const totalHours = entries.reduce((s, e) => s + e.hours, 0);
    const billableAmount = entries
      .filter((e) => e.billable)
      .reduce((s, e) => s + e.hours * e.rateAtEntry, 0);
    const daysPct = Math.round((totalHours / 8 / project.budgetDays) * 100);
    const amountPct = Math.round((billableAmount / project.budgetAmount) * 100);
    console.log(
      `${project.name}: ${entries.length} entries, ${totalHours}h = ${totalHours / 8} din ` +
        `(budget ${project.budgetDays} din, ${daysPct}%), ` +
        `billable Rs ${billableAmount} (budget Rs ${project.budgetAmount}, ${amountPct}%)`
    );
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
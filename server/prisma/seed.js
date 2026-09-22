const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.outboundEmail.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.dealStageChange.deleteMany();
  await prisma.proposalItem.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  console.log("Database is empty. Register in the app — nothing is seeded.");
}

main()
  .catch((e) => {
    console.error("Clear failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

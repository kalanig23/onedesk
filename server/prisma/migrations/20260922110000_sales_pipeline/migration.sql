-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "lastSpokenAt" TIMESTAMP(3),
ADD COLUMN "lastSpokenNote" TEXT,
ADD COLUMN "lastSpokenById" INTEGER;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "contactId" INTEGER,
ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ProposalItem" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "estimatedDays" DOUBLE PRECISION NOT NULL,
    "dailyRate" INTEGER NOT NULL,

    CONSTRAINT "ProposalItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_lastSpokenById_fkey" FOREIGN KEY ("lastSpokenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

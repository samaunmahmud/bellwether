-- CreateEnum
CREATE TYPE "RegisterEventKind" AS ENUM ('BIRTH', 'DEATH', 'MOVE_ON', 'MOVE_OFF', 'WEIGHING', 'FEC', 'BODY_CONDITION', 'TAG_REPLACEMENT', 'HEAD_COUNT');

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "cphNumber" TEXT,
ADD COLUMN     "flockMark" TEXT;

-- AlterTable
ALTER TABLE "PetLogEntry" ADD COLUMN     "weightKg" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "RegisterEvent" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "farmId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "kind" "RegisterEventKind" NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER,
    "bornDead" INTEGER,
    "value" DOUBLE PRECISION,
    "otherParty" TEXT,
    "reference" TEXT,
    "cause" TEXT,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "RegisterEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineItem" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "productName" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantity" TEXT,
    "expiryDate" DATE,
    "supplier" TEXT,
    "purchasedOn" DATE,
    "meatWithdrawalDays" INTEGER,
    "milkWithdrawalDays" INTEGER,
    "note" TEXT,
    "finishedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegisterEvent_farmId_date_idx" ON "RegisterEvent"("farmId", "date");

-- CreateIndex
CREATE INDEX "MedicineItem_farmId_idx" ON "MedicineItem"("farmId");

-- AddForeignKey
ALTER TABLE "RegisterEvent" ADD CONSTRAINT "RegisterEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterEvent" ADD CONSTRAINT "RegisterEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LivestockGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineItem" ADD CONSTRAINT "MedicineItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Treatment" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "farmId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "productName" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantityUsed" TEXT,
    "animalsTreated" INTEGER NOT NULL,
    "administeredBy" TEXT NOT NULL,
    "reason" TEXT,
    "meatWithdrawalDays" INTEGER NOT NULL,
    "milkWithdrawalDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "farmId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Treatment_groupId_date_idx" ON "Treatment"("groupId", "date");

-- CreateIndex
CREATE INDEX "Treatment_farmId_date_idx" ON "Treatment"("farmId", "date");

-- CreateIndex
CREATE INDEX "Observation_groupId_date_idx" ON "Observation"("groupId", "date");

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LivestockGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LivestockGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

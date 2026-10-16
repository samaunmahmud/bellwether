-- CreateEnum
CREATE TYPE "Species" AS ENUM ('CATTLE', 'SHEEP');

-- CreateEnum
CREATE TYPE "LivestockClass" AS ENUM ('EWES', 'LAMBS', 'RAMS', 'DAIRY_COWS', 'BEEF_CATTLE', 'CALVES');

-- CreateEnum
CREATE TYPE "CattleType" AS ENUM ('DAIRY', 'BEEF');

-- CreateTable
CREATE TABLE "Farm" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Field" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "postcode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockGroup" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "livestockClass" "LivestockClass" NOT NULL,
    "headCount" INTEGER NOT NULL,
    "currentFieldId" UUID,
    "housed" BOOLEAN NOT NULL DEFAULT false,
    "lastShearingDate" DATE,
    "lambingStart" DATE,
    "lambingEnd" DATE,
    "lambsAtGrassThisSpring" BOOLEAN NOT NULL DEFAULT false,
    "cattleType" "CattleType",
    "calvingStart" DATE,
    "calvingEnd" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LivestockGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMovement" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "farmId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "fromFieldId" UUID,
    "toFieldId" UUID NOT NULL,
    "movedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Field_farmId_idx" ON "Field"("farmId");

-- CreateIndex
CREATE INDEX "LivestockGroup_farmId_idx" ON "LivestockGroup"("farmId");

-- CreateIndex
CREATE INDEX "GroupMovement_groupId_movedOn_idx" ON "GroupMovement"("groupId", "movedOn");

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockGroup" ADD CONSTRAINT "LivestockGroup_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockGroup" ADD CONSTRAINT "LivestockGroup_currentFieldId_fkey" FOREIGN KEY ("currentFieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMovement" ADD CONSTRAINT "GroupMovement_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMovement" ADD CONSTRAINT "GroupMovement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LivestockGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMovement" ADD CONSTRAINT "GroupMovement_fromFieldId_fkey" FOREIGN KEY ("fromFieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMovement" ADD CONSTRAINT "GroupMovement_toFieldId_fkey" FOREIGN KEY ("toFieldId") REFERENCES "Field"("id") ON DELETE CASCADE ON UPDATE CASCADE;

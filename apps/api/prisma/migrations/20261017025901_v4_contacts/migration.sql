-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('VET', 'FEED', 'SUPPLIER', 'OTHER');

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL,
    "farmId" UUID,
    "ownerId" UUID,
    "kind" "ContactKind" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "emergencyPhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_farmId_idx" ON "Contact"("farmId");

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

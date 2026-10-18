-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'PHOTO';

-- CreateTable
CREATE TABLE "Camera" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fieldId" UUID,
    "groupId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Camera_farmId_idx" ON "Camera"("farmId");

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LivestockGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

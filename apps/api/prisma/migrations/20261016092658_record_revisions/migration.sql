-- AlterTable
ALTER TABLE "Observation" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Treatment" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RecordRevision" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "farmId" UUID NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "editedById" UUID,
    "editedBy" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL,
    "changes" JSONB NOT NULL,

    CONSTRAINT "RecordRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecordRevision_recordId_idx" ON "RecordRevision"("recordId");

-- AddForeignKey
ALTER TABLE "RecordRevision" ADD CONSTRAINT "RecordRevision_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordRevision" ADD CONSTRAINT "RecordRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

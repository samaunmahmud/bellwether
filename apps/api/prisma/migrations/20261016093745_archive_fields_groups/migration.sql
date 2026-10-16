-- AlterTable
ALTER TABLE "Field" ADD COLUMN     "archivedOn" DATE;

-- AlterTable
ALTER TABLE "LivestockGroup" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedOn" DATE;

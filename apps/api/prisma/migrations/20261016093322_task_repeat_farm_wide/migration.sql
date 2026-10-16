-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "nextTaskId" UUID,
ADD COLUMN     "repeatEveryDays" INTEGER,
ALTER COLUMN "groupId" DROP NOT NULL;

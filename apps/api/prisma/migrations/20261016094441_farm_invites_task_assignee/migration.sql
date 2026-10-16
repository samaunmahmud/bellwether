-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assigneeId" UUID;

-- CreateTable
CREATE TABLE "FarmInvite" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "FarmRole" NOT NULL,
    "invitedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmInvite_email_idx" ON "FarmInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FarmInvite_farmId_email_key" ON "FarmInvite"("farmId", "email");

-- AddForeignKey
ALTER TABLE "FarmInvite" ADD CONSTRAINT "FarmInvite_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmInvite" ADD CONSTRAINT "FarmInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

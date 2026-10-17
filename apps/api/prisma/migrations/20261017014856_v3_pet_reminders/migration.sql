-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PetReminderEmail" (
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetReminderEmail_pkey" PRIMARY KEY ("userId","date")
);

-- AddForeignKey
ALTER TABLE "PetReminderEmail" ADD CONSTRAINT "PetReminderEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

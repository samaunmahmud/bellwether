-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "farmId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "note" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingRun" (
    "id" UUID NOT NULL,
    "farmId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingPreference" (
    "farmId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sendAt" TEXT NOT NULL DEFAULT '06:00',
    "alwaysSend" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BriefingPreference_pkey" PRIMARY KEY ("farmId","userId")
);

-- CreateTable
CREATE TABLE "BriefingEmail" (
    "farmId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefingEmail_pkey" PRIMARY KEY ("farmId","userId","date")
);

-- CreateIndex
CREATE INDEX "Task_farmId_dueDate_idx" ON "Task"("farmId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingRun_farmId_date_key" ON "BriefingRun"("farmId", "date");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LivestockGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingRun" ADD CONSTRAINT "BriefingRun_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingPreference" ADD CONSTRAINT "BriefingPreference_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingPreference" ADD CONSTRAINT "BriefingPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingEmail" ADD CONSTRAINT "BriefingEmail_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingEmail" ADD CONSTRAINT "BriefingEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

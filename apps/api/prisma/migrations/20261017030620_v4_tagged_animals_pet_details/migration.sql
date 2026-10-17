-- CreateEnum
CREATE TYPE "AnimalSex" AS ENUM ('FEMALE', 'MALE', 'CASTRATED');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('ON_FARM', 'SOLD', 'DIED');

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "breed" TEXT,
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "microchip" TEXT,
ADD COLUMN     "sex" TEXT;

-- CreateTable
CREATE TABLE "TaggedAnimal" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "farmId" UUID NOT NULL,
    "groupId" UUID,
    "tag" TEXT NOT NULL,
    "tagKey" TEXT NOT NULL,
    "name" TEXT,
    "species" "Species" NOT NULL,
    "sex" "AnimalSex" NOT NULL,
    "breed" TEXT,
    "dateOfBirth" DATE,
    "status" "AnimalStatus" NOT NULL DEFAULT 'ON_FARM',
    "statusDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaggedAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaggedAnimal_farmId_tagKey_key" ON "TaggedAnimal"("farmId", "tagKey");

-- AddForeignKey
ALTER TABLE "TaggedAnimal" ADD CONSTRAINT "TaggedAnimal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaggedAnimal" ADD CONSTRAINT "TaggedAnimal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LivestockGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

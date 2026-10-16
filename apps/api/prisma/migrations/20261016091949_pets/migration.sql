-- CreateTable
CREATE TABLE "Pet" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'pet',
    "postcode" TEXT,
    "highExposureHabitat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PetLogEntry" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "petId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "nextDueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PetLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pet_ownerId_idx" ON "Pet"("ownerId");

-- CreateIndex
CREATE INDEX "PetLogEntry_petId_date_idx" ON "PetLogEntry"("petId", "date");

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetLogEntry" ADD CONSTRAINT "PetLogEntry_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

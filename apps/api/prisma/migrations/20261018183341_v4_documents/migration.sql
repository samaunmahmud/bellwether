-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('HEALTH', 'CERTIFICATE', 'MOVEMENT', 'INSURANCE', 'RECEIPT', 'OTHER');

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "farmId" UUID,
    "petId" UUID,
    "groupId" UUID,
    "taggedAnimalId" UUID,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "documentDate" DATE,
    "expiresOn" DATE,
    "notes" TEXT,
    "uploadedById" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFile" (
    "documentId" UUID NOT NULL,
    "content" BYTEA NOT NULL,

    CONSTRAINT "DocumentFile_pkey" PRIMARY KEY ("documentId")
);

-- CreateIndex
CREATE INDEX "Document_farmId_idx" ON "Document"("farmId");

-- CreateIndex
CREATE INDEX "Document_petId_idx" ON "Document"("petId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LivestockGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_taggedAnimalId_fkey" FOREIGN KEY ("taggedAnimalId") REFERENCES "TaggedAnimal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

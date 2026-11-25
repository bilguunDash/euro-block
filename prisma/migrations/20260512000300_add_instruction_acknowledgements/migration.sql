CREATE TABLE IF NOT EXISTS "instruction_documents" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "stationCode" TEXT,
  "roleTarget" TEXT NOT NULL DEFAULT 'operator',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "uploadedByUid" TEXT NOT NULL,
  "uploadedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "instruction_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "instruction_acknowledgements" (
  "id" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "operatorUid" TEXT NOT NULL,
  "operatorName" TEXT,
  "stationCode" TEXT,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "instruction_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "instruction_documents_stationCode_isActive_idx"
ON "instruction_documents"("stationCode", "isActive");

CREATE INDEX IF NOT EXISTS "instruction_documents_roleTarget_isActive_idx"
ON "instruction_documents"("roleTarget", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "instruction_acknowledgements_documentId_operatorUid_key"
ON "instruction_acknowledgements"("documentId", "operatorUid");

CREATE INDEX IF NOT EXISTS "instruction_acknowledgements_operatorUid_idx"
ON "instruction_acknowledgements"("operatorUid");

CREATE INDEX IF NOT EXISTS "instruction_acknowledgements_documentId_idx"
ON "instruction_acknowledgements"("documentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'instruction_acknowledgements_documentId_fkey'
  ) THEN
    ALTER TABLE "instruction_acknowledgements"
    ADD CONSTRAINT "instruction_acknowledgements_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "instruction_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE "shift_images" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'inspection',
    "rowKey" TEXT,
    "rowLabel" TEXT,
    "caption" TEXT,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUid" TEXT NOT NULL,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shift_images_storagePath_key" ON "shift_images"("storagePath");
CREATE INDEX "shift_images_shiftId_idx" ON "shift_images"("shiftId");
CREATE INDEX "shift_images_shiftId_rowKey_idx" ON "shift_images"("shiftId", "rowKey");

ALTER TABLE "shift_images"
ADD CONSTRAINT "shift_images_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "shifts"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

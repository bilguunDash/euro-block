CREATE TABLE IF NOT EXISTS "destination" (
  "id" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "productionLine" INTEGER NOT NULL,

  CONSTRAINT "destination_pkey" PRIMARY KEY ("id")
);

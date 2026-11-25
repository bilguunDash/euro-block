CREATE TABLE IF NOT EXISTS "material" (
  "id" UUID NOT NULL,
  "gmf" DOUBLE PRECISION NOT NULL,
  "density" DOUBLE PRECISION NOT NULL,
  "savingTime" TIMESTAMP(3) NOT NULL,
  "name" TEXT NOT NULL,
  "batchprint" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "totalcount" INTEGER NOT NULL,
  "unit" TEXT NOT NULL,
  "userName" TEXT NOT NULL,

  CONSTRAINT "material_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "mixer" (
  "id" UUID NOT NULL,
  "positionNumber" INTEGER NOT NULL,

  CONSTRAINT "mixer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_order" (
  "id" UUID NOT NULL,
  "extText2" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "extSmall1" INTEGER NOT NULL,
  "batchSize" DOUBLE PRECISION NOT NULL,
  "readyTime" TIMESTAMP(3) NOT NULL,
  "orderTime" TIMESTAMP(3) NOT NULL,
  "code" TEXT NOT NULL,
  "extText1" TEXT NOT NULL,
  "numberOfBatches" INTEGER NOT NULL,
  "numberOfBatchesActual" INTEGER NOT NULL,
  "extText3" TEXT NOT NULL,
  "extSmall2" INTEGER NOT NULL,

  CONSTRAINT "product_order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "recipe" (
  "id" UUID NOT NULL,
  "inuse" INTEGER NOT NULL,
  "savedBy" TEXT NOT NULL,
  "totalTarget" DOUBLE PRECISION NOT NULL,
  "productVersion" INTEGER NOT NULL,
  "choppersInUse" INTEGER NOT NULL,
  "dischTime" INTEGER NOT NULL,
  "destination" INTEGER NOT NULL,
  "savedTime" TIMESTAMP(3) NOT NULL,
  "customeVersion" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "productionLine" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "mxTime2" INTEGER NOT NULL,
  "totalWaterRpc" DOUBLE PRECISION NOT NULL,
  "totalWaterKg" DOUBLE PRECISION NOT NULL,
  "comment" TEXT NOT NULL,
  "temperature" DOUBLE PRECISION NOT NULL,
  "mxTime3" INTEGER NOT NULL,
  "mxNbr" INTEGER NOT NULL,
  "mxTime1" INTEGER NOT NULL,
  "productNbr" INTEGER NOT NULL,

  CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

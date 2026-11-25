CREATE TABLE IF NOT EXISTS "recipe_component" (
  "id" UUID NOT NULL,
  "preact" DOUBLE PRECISION NOT NULL,
  "para2" INTEGER NOT NULL,
  "lastPartTarget" DOUBLE PRECISION NOT NULL,
  "para5" DOUBLE PRECISION NOT NULL,
  "tolerancePos" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "firstCutActual" DOUBLE PRECISION NOT NULL,
  "prefineFeed" DOUBLE PRECISION NOT NULL,
  "feedTimePreFine" DOUBLE PRECISION NOT NULL,
  "startTimeF" TIMESTAMP(3) NOT NULL,
  "startTimeC" TIMESTAMP(3) NOT NULL,
  "para1Field" INTEGER NOT NULL,
  "actualValue" DOUBLE PRECISION NOT NULL,
  "sequence" INTEGER NOT NULL,
  "massflowFirstCut" DOUBLE PRECISION NOT NULL,
  "para6" DOUBLE PRECISION NOT NULL,
  "ioLine" INTEGER NOT NULL,
  "moisture" DOUBLE PRECISION NOT NULL,
  "code" TEXT NOT NULL,
  "feedTimeTotal" DOUBLE PRECISION NOT NULL,
  "joggs" INTEGER NOT NULL,
  "coarseFeed" DOUBLE PRECISION NOT NULL,
  "readyTime" TIMESTAMP(3) NOT NULL,
  "siloLevel" DOUBLE PRECISION NOT NULL,
  "para1" INTEGER NOT NULL,
  "para4" INTEGER NOT NULL,
  "para3" INTEGER NOT NULL,
  "partitionQnt" INTEGER NOT NULL,
  "status" INTEGER NOT NULL,
  "setpointCalculated" DOUBLE PRECISION NOT NULL,
  "dosingRateCoarse" DOUBLE PRECISION NOT NULL,
  "toleranceNeg" DOUBLE PRECISION NOT NULL,
  "dosingRateFine" DOUBLE PRECISION NOT NULL,
  "fineFeed" DOUBLE PRECISION NOT NULL,
  "lastPartActual" DOUBLE PRECISION NOT NULL,
  "recipeRow" INTEGER NOT NULL,
  "feedTimeCoarse" DOUBLE PRECISION NOT NULL,
  "setpointRecipe" DOUBLE PRECISION NOT NULL,
  "componentType" INTEGER NOT NULL,
  "name" TEXT NOT NULL,

  CONSTRAINT "recipe_component_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "scale" (
  "id" UUID NOT NULL,
  "unit" TEXT NOT NULL,
  "maxLimit" INTEGER NOT NULL,
  "positionNumber" INTEGER NOT NULL,
  "format" TEXT NOT NULL,
  "scaleStep" INTEGER NOT NULL,
  "decimals" INTEGER NOT NULL,
  "name" TEXT NOT NULL,

  CONSTRAINT "scale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "silo" (
  "id" UUID NOT NULL,
  "volume" DOUBLE PRECISION NOT NULL,
  "scaleDosingLine" INTEGER NOT NULL,
  "userName" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "positionNumber" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "accuracy" DOUBLE PRECISION NOT NULL,
  "inventoryLevel" DOUBLE PRECISION NOT NULL,
  "name" TEXT NOT NULL,
  "spareSilo" INTEGER NOT NULL,

  CONSTRAINT "silo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transport" (
  "id" UUID NOT NULL,
  "positionNumber" INTEGER NOT NULL,

  CONSTRAINT "transport_pkey" PRIMARY KEY ("id")
);

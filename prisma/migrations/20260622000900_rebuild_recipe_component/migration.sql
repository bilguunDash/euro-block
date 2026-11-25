DROP TABLE IF EXISTS "recipe_component";

CREATE TABLE "recipe_component" (
  "id"           UUID            NOT NULL DEFAULT gen_random_uuid(),
  "recipeId"     INTEGER,
  "rowNbr"       INTEGER,
  "materialId"   INTEGER,
  "scale"        INTEGER,
  "silo"         INTEGER,
  "setpointPrc"  DOUBLE PRECISION,
  "setpoint"     DOUBLE PRECISION,
  "tolerancePos" DOUBLE PRECISION,
  "toleranceNeg" DOUBLE PRECISION,
  "preact"       DOUBLE PRECISION,
  "extParam1"    DOUBLE PRECISION,
  "extParam2"    DOUBLE PRECISION,
  "unit"         TEXT,
  "code"         TEXT,
  "name"         TEXT,
  "totalcount"   INTEGER,
  "batchprint"   INTEGER,
  "vlk"          DOUBLE PRECISION,
  "sv"           DOUBLE PRECISION,
  CONSTRAINT "recipe_component_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recipe_component_recipeId_rowNbr_key" UNIQUE ("recipeId", "rowNbr")
);

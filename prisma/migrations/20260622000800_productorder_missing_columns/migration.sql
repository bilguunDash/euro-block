ALTER TABLE "product_order" ADD COLUMN IF NOT EXISTS "recipeId"            INTEGER;
ALTER TABLE "product_order" ADD COLUMN IF NOT EXISTS "productionLine"      INTEGER;
ALTER TABLE "product_order" ADD COLUMN IF NOT EXISTS "originalDestination" INTEGER;

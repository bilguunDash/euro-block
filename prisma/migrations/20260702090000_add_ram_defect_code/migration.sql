-- РАМ операторын урьдчилан сонгох алдааны код (заавал биш)
ALTER TABLE "sort_work_records" ADD COLUMN IF NOT EXISTS "ramDefectCode" TEXT NOT NULL DEFAULT '';

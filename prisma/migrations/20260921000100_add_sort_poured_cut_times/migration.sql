-- Цутгасан/зүссэн цаг. `headerPoured`/`headerCut` нь зөвхөн ээлж (Өдрийн/Шөнийн)
-- хадгалдаг тул Excel экспортын «Цутгасан цаг»/«Зүссэн цаг» багана үргэлж хоосон
-- гардаг байв. Хуучин бүртгэлд утга байхгүй тул NULL зөвшөөрнө.
ALTER TABLE "sort_work_records" ADD COLUMN IF NOT EXISTS "pouredAt" TIMESTAMP(3);
ALTER TABLE "sort_work_records" ADD COLUMN IF NOT EXISTS "cutAt" TIMESTAMP(3);

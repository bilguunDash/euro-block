-- Ээлжийн баг (crew): '1' | '2' | '3' | NULL
-- Хяналтын бүтэц (control_assignments) -ийг орлох шинэ бүтцийн үндэс.
-- docs/shift-crew-architecture.md
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "shiftGroup" TEXT;

-- Багаар шүүх нь хамгийн түгээмэл query.
CREATE INDEX IF NOT EXISTS "users_shiftGroup_idx" ON "users" ("shiftGroup");

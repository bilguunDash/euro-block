-- Ээлж дуусгагчийн сонгосон «батлах админ».
-- ЧИГЛҮҮЛЭЛТ бөгөөс түгжээ БИШ: мэдэгдэл энэ хүн рүү очиж, баталгаажуулалтын
-- дараалалд харагдана. Гэхдээ өөр admin / chief_engineer мөн батлах эрхтэй хэвээр
-- (сонгосон хүн чөлөөтэй/ажил дээр байхгүй үед ээлж гацахаас сэргийлнэ).
ALTER TABLE "shifts"
ADD COLUMN IF NOT EXISTS "approvalAdminUid" TEXT,
ADD COLUMN IF NOT EXISTS "approvalAdminName" TEXT;

-- Тухайн админд чиглэсэн ээлжүүдийг шүүх нь дараалал харуулах үндсэн query.
CREATE INDEX IF NOT EXISTS "shifts_approvalAdminUid_idx" ON "shifts" ("approvalAdminUid");

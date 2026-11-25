-- Сорт бүртгэлийн модульд рам ба сортын үүргийг нэг акаунт дээр хослуулах
-- боломж олгоно. Хуучин бүх мөрд false — одоогийн зан төлөв өөрчлөгдөхгүй.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sortDualRole" BOOLEAN NOT NULL DEFAULT false;

-- `hse_documents` нь `instruction_documents`-д бүрэн орлуулагдсан.
-- Prod дээр 0 мөртэй (уншиж баталсан), баримт бүртгэх UI нь бүхэлдээ
-- «Заавар, ХАБ баримт» (instruction_documents) руу шилжсэн.
DROP TABLE IF EXISTS "hse_documents";

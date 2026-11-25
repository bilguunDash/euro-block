# ShiftSwapRequest snapshot хийж, FK ашиглахгүй байх

`ShiftSwapRequest` нь `requesterScheduleId`/`targetScheduleId`-г Prisma relation биш, зүгээр
string болгон хадгалдаг бөгөөд үүсгэх мөчийн нэр/огноо/станцыг snapshot хийж хуулж авдаг.
Шийдвэр гаргах үед (accept/reject) холбогдох `OperatorSchedule` мөрийг ID-аар дахин уншиж,
одоогийн байдлыг шинээр шалгадаг.

Шалтгаан: Admin-ийн хуваарийн удирдлагын хэрэгсэл (`ScheduleManagementSection`) сар бүрийн
`OperatorSchedule` мөрүүдийг bulk устгаж, дахин үүсгэдэг workflow-той. Хатуу FK ашигласан бол
энэ bulk үйлдэл нь хүлээгдэж буй/түүхэн `ShiftSwapRequest`-үүдийг эвдэх (cascade delete) эсвэл
FK constraint-аар блоклогдох эрсдэлтэй. Snapshot-style хийснээр admin-ийн bulk regenerate
workflow тасалдахгүй, мөн хүсэлтийн түүх (audit) хадгалагдана.

**Status**: accepted

**Consequence**: Snapshot дэх нэр/огноо нь "үүсгэсэн үеийн" төлөв тул, хэрэв дараа нь admin
тухайн хуваарийн мөрийг өөрчилбөл (жишээ нь өөр операторт дахин оноовол), pending хүсэлт дэх
snapshot мэдээлэл хуучирсан байж болно. Гэхдээ шийдвэр гаргах мөчид `accept`/`reject` нь ID-аар
амьд өгөгдлийг дахин шалгадаг тул алдаатай гүйлгээ хийгдэхгүй — зөвхөн харагдац (display) л
хуучирч болзошгүй.

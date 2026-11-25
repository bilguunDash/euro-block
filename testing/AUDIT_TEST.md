## Audit log test

Dashboard → Audit tab дээр харагдах логийн эх сурвалж нь `audit_logs` хүснэгт.

### Шалгах үйлдлүүд (Pass criteria)

Доорх үйлдлүүдийг хийсний дараа Audit tab дээр мөр нэмэгдсэн байх:

- **shift_created**: Operator `/shift/new` дээрээс ээлж эхлүүлэх
- **shift_patch**: `/shift/[id]` дээр:
  - operator `Ээлж дуусгах` (operatorShiftCompleted + checkOut)
  - operator `Хүлээлцэх хүсэлт илгээх`
  - next operator/master/chief `Хүлээн авсан`
- **shift_log_created**:
  - equipment_checks / hse_checklist / handovers гэх мэт modal log нэмэх
- **operator_schedule_created**:
  - dispatcher/admin `POST /api/operator-schedules`
- **system_settings_updated**:
  - admin `PATCH /api/settings`
- **hse_document_created**:
  - admin/hse_engineer `POST /api/hse-documents`

Хэрэв Audit tab дээр харагдахгүй байвал:\n+- `/api/dashboard` role эрхтэй эсэхээ шалга (admin/manager/auditor/dispatcher/chief_engineer)\n+- тухайн үйлдэл server-side audit бичиж байгаа эсэхийг кодоор шалга\n+

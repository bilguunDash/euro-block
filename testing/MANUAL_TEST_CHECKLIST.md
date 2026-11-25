## Manual test checklist (PRD-aligned)

Base URL: `http://localhost:3000`

### A) Operator — shift start, mandatory, complete

- **A1**: Login as `operator` (stationCode set).
- **A2**: Go to `/shift/new` and start a shift (choose station, shiftType).
  - **Expected**: redirect to `/shift/<id>`, status `Хадгалсан`, `checkIn` present.
- **A3**: Click **Ээлж дуусгах** without filling anything.
  - **Expected**: blocked with `Дутуу бүртгэл: ...` including at least HSE + equipment + handover.
- **A4**: Fill minimum required logs:
  - HSE checklist (modal)
  - Equipment check (modal)
  - Handover log (modal)
  - Station-specific:
    - `ҮЯ-130`: Mix log
    - `ҮЯ-110/140/150`: Production log
    - `ҮЯ-180`: Autoclave log
    - `ҮЯ-190`: Quality log
- **A5**: Click **Ээлж дуусгах**.
  - **Expected**: `operatorShiftCompleted=true`, `checkOut` set.

### B) Handover request + accept

- **B1**: While in shift detail, click **Хүлээлцэх хүсэлт илгээх**.
  - **Expected**: `handoverAwaitingAcceptance=true`, `handoverRequestedAt` set.
  - **Expected**: notifications created for `dispatcher` and (if selected) next operator.
- **B2**: Login as next operator OR `master` OR `chief_engineer`, open the shift page and click **Хүлээн авсан**.
  - **Expected**: `handoverAwaitingAcceptance=false`, acceptedBy fields set.

### C) Periodic logs — only `ҮЯ-400`

- **C1**: Start shift at station `ҮЯ-400`.
- **C2**: Confirm periodic overdue banner/notification logic exists only for `ҮЯ-400` (not other stations).
- **C3**: (Admin) set `periodic_interval_hours` to small value via `PATCH /api/settings`, then verify overdue triggers quickly.

### D) Schedule

- **D1**: Login as `dispatcher` (or `admin`), go to Dashboard → Admin tab.
- **D2**: Create schedule (master schedule) and delete it.
  - **Expected**: POST/DELETE succeed; operator gets notification `shift_assigned` (existing behavior).
- **D3**: Create operator schedule via `POST /api/operator-schedules`.
  - **Expected**: Operator sees the assignment; shift detail page shows “Дараагийн оператор (хуваарь)” dropdown.

### E) KPI + CSV export

- **E1**: Login as `manager`/`auditor`/`dispatcher`/`admin`, open KPI tab.
- **E2**: Click **CSV татах**.
  - **Expected**: file download from `/api/reports/kpi?format=csv`.

### F) HSE documents

- **F1**: Login as `hse_engineer` or `admin`.
- **F2**: `POST /api/hse-documents` (title + fileUrl).
- **F3**: Dashboard → Documents tab shows the new document and opens its URL.

### G) Audit logs

- **G1**: After actions above, login as role that can view Audit tab (admin/manager/auditor/dispatcher/chief_engineer).
- **G2**: Verify logs exist for: shift_created, shift_patch, shift_log_created, schedules changes, settings update, hse doc create.


## PRD testing helpers

### Approval cancellation and deletion

```powershell
npm run test:approvals
```

Runs 30 unit tests using the actual maintenance, shift, log and form approval
handlers, plus approval-list click handlers, with isolated storage fixtures.
No server or database is required. TypeScript is compiled in memory.

Coverage includes:

- The original owner UID receives a return notification and can read/edit the
  preserved form, including duplicate names and a changed station assignment.
- Another operator cannot edit, submit or request handover for that record.
- Operator and master owners can correct, resubmit and repeat the appropriate
  master/operator/admin approval stages. A returned record cannot skip handover
  using direct master/admin approval, and a cancelled form cannot inherit old
  approval flags. All four configured master form types are checked.
- Both actions in all six lists: confirmations, repeated clicks, 401/403,
  404/409, pending/approved states, cache refresh and stale form versions.
- Deletion removes all versions of a selected master form; deleting a shift
  removes its HSE records too. Unrelated records and separate schedules remain.
- Audit/notification errors roll back cancellation and deletion.

To verify actual database cascades and SQL pending predicates:

```powershell
npm run test:approvals:db
```

Requires the configured `localhost:5432/euroblock_local` PostgreSQL server,
permission to create a database, Node 24, and a matching `pg_dump` on PATH or
the workspace's portable PostgreSQL 18 installation. Creates a random empty
`euroblock_approval_test_*` database, copies **only the local database schema**
read-only, inserts fictional test records, runs five integration scenarios,
then drops only that fixture database. Application data and passwords are not
copied, and the application database is not modified.

These scenarios verify persisted owner correction/reapproval, the real SQL
predicate for resubmitted forms, all eight direct cascades plus the nested
autoclave cascade and HSE cleanup, form-version deletion scope, and PostgreSQL
rollback. The test runner reports six passes including the enclosing test.
The older migration history cannot initialize a fresh empty database because
`20260512000200_add_device_permissions` references `users` before that table is
created; this suite deliberately tests the currently deployed local schema.

Limits: auth sessions, device checks, handover timing and schedule lookup are
controlled test boundaries. These are not browser end-to-end tests. Database
rows are checked; physical upload files and external blob objects are not
deleted by this maintenance service or verified by this suite. Audit metadata
is intentionally retained after deletion.

Manually verify with an admin in **Давхар баталгаажуулалт**:

- Both **Цуцлах** and **Устгах** appear for pending, approved and unstarted rows
  in both operator and master tabs. Dismissing confirmation changes nothing.
- Cancelling a shift or master form preserves filled data and reopens the shift
  for editing. The owner can correct and resubmit, then repeat approval.
- Deleting a master form removes all versions of that form and reopens the
  owning shift. Other forms remain. Deleting an operator shift removes the
  whole shift and its child records; its schedule remains separately managed.
- On an unstarted row, cancellation/removal applies to that assignment only.
  The original schedule metadata is recorded in audit. An assignment that has
  started since the list was fetched returns 409 and refreshes the list.
- Lists, counts, later history pages and audit refresh after a successful action.
  On narrow screens the tables scroll horizontally to keep actions usable.

### Station / registration labels in the approval lists

```powershell
npm run test:approvals:labels
```

Runs 25 unit tests (15 for `lib/approval-record-label.ts`, 10 for the real
`ApprovalsSection` component with its hooks stubbed). No server or database is
required; TypeScript is compiled in memory.

Every row of **Давхар баталгаажуулалт** shows what it is a record of, under the
station code badge in the **Дамжлага** column:

- Operator rows and unstarted schedules: the station name, e.g. `ҮЯ-130` /
  *Зуурах цамхагийн оператор*. The station catalog (`stations` prop) wins; a
  name sent by the server (`stationName`) is used only for codes missing from
  the catalog. An unknown station without a name shows the code alone.
- Master form rows (the **Мастер** tab, pending and approved): the registration
  title from `MASTER_STATION_FORMS`, without the `ҮЯ-xxx:` prefix, e.g. `ҮЯ-310` /
  *Засварын мастерын ээлж хүлээлцэх бүртгэл*. Schedules and the shifts of a
  master station (listed in the **Мастер** tab, see below) are not forms and keep
  the station name.

The component tests open every list (operator/master × pending/approved/
unstarted; master approved has a shifts table and a forms table) by clicking the
tabs, and check the column layout, the badge, the label and the row actions. Every approvable master form type
(`ADMIN_APPROVAL_LOG_TYPES`) must have a station and a registration title, so
adding a form type without a form config fails the suite.

### Which tab a record belongs to (operator vs master)

```powershell
npm run test:approvals:scope
```

Runs 36 unit tests (17 in `approval-history.test.ts`, of which 8 cover the
station kind, and 19 in `approval-station-scope.test.mjs`). No server or
database is required; the route tests run the real `GET /api/shifts` handler
against a fake Prisma client.

**Давхар баталгаажуулалт** splits records by *station kind*
(`approvalStationKind` in `lib/approval-history-query.ts`, which uses
`isMasterStationCode`):

- **Оператор** tab: shifts of operator stations only.
- **Мастер** tab: shifts of master stations (`ҮЯ-099/181/310/400/410`) **and**
  master handover forms. A master station shift keeps the same final approval
  (**Эцсийн баталгаажуулах**) as an operator shift; a form keeps
  **Буцаах / Баталгаажуулах**. Both are in one table when pending; when approved
  they are two tables (shifts, then forms) because they are separate paginated
  server lists.
- The station dropdown lists **every** station in two groups, the open tab's
  kind first (**Операторын дамжлага** / **Мастерын дамжлага**). Picking a
  station of the other kind opens that tab with the filter kept; for example,
  ҮЯ-410 picked on **Оператор** opens **Мастер** filtered to ҮЯ-410. Before
  this, ҮЯ-410 could not be found from the Оператор tab and ҮЯ-320 (an operator
  station) was mistaken for the ЦА master's records. Switching tabs by hand
  still clears the station. **Хийгдэж эхлээгүй** schedules are placed by station
  kind too (a row keeps its schedule type, so cancel/delete still reaches the
  right table).
- The tab badges and the admin Home card (**Админ баталгаажуулах · Оператор X ·
  Мастер Y**) use the same `pendingApprovalCounts`, so they always agree and the
  total never changes.

API: `GET /api/shifts?queryType=admin_approved&stationKind=operator|master`
restricts the history (page, count and name search) to that kind; without it
every station is returned (the Home «approved» count). `admin_pending` is
deliberately **not** filtered — the client splits it. An unknown `stationKind`
returns 400.

Manually verify as an admin: a master station shift (for example ҮЯ-099 with a
master as the shift owner) appears under **Мастер**, never under **Оператор**, in
pending, approved and unstarted; **Эцсийн баталгаажуулах** on it moves it to the
**Мастер → Баталгаажсан → Ээлжийн эцсийн баталгаа** table; the Home card equals
the sum of the two pending badges.

### Rejecting pending user registrations

```powershell
npm run test:users:reject
```

Runs 32 unit tests (13 for `POST /api/users/reject` and `lib/user-registration.ts`;
19 for the **Хэрэглэгчийн удирдлага** UI, the `handleRejectUser` handler of
`useDashboardAdmin`, the `DashboardContent` → `AdminTab` wiring and the audit
label). No server or database is required; TypeScript is compiled in memory and
Prisma is replaced by a fake with real transaction rollback.

In **Хэрэглэгчийн удирдлага → Баталгаажуулах хүлээгдэж буй** every row has
**Татгалзах** next to **Зөвшөөрөх**. Rejecting deletes the pending account (there
is no separate "rejected" state, so the person may register again) and writes a
`user_registration_rejected` audit entry in the same transaction. Rules covered:

- Admin only (same as approving); `chief_engineer` and every other role get 403.
- Only accounts that are still pending can be rejected. An approved account,
  including an admin, returns 409. The delete is a compare-and-delete
  (`isApproved: false`), so an account that another admin approved between the
  read and the delete is kept. An unknown or already handled id returns 404.
- A failing audit write rolls the deletion back; internal errors are not leaked.
- The UI asks for confirmation first, sends one request per click, reloads the
  list after success or a 404/409, and shows the server message on failure. The
  client does not write its own audit entry (the server does).

Manually verify as an admin: register a test account, open **Хэрэглэгчийн
удирдлага**, press **Татгалзах**, confirm, and check that the row disappears and
**Аудит лог** shows *Бүртгэлийн хүсэлт татгалзсан*. Approve the account from a
second browser session first to see the 409 message and the list refresh.

### ҮЯ-180 autoclave operation rows

```powershell
npm run test:y180
```

Runs 9 unit tests; no server or database is required.

The hourly 6-autoclave grid of the **ҮЯ-180 Автоклавын операторын бүртгэл** form
has been replaced by **Автоклавын ажилбарын бүртгэл**. One row is one operation,
with the same columns as the MS Forms export «Автоклавын операторын бүртгэл»:

- Бүтээгдэхүүний хэмжээ: 100–375
- Автоклав №1–6
- Оруулсан / гаргасан
- Эхлүүлсэн цаг
- Онгойлгосон цаг
- Ажиллагаа (default *хэвийн*)
- Нөлөөлсөн бусад зүйл (default *байхгүй*)
- Нэмэлт ажил
- Бүртгэл хөтөлсөн (default: the shift operator)

Payloads are `formVersion: 2` with `operationRows`. The tests cover:

- A new form opens with one row. **Мөр нэмэх** adds a row and the trash icon removes one.
- Rows that hold only the defaults are not saved.
- The photo picker lists the operation rows. It uses the same image section as before, so older photos still appear.
- An old hourly record (`formVersion 1`) keeps its `timeRows`. The editor leaves them unchanged and shows a notice, and the read-only view still shows the hourly table.
- An empty `timeRows` no longer renders a blank 12-row grid.
- In the Excel export every operation row is its own line under the column names above. Old hourly records still export one line per hour.

To verify manually, start an ҮЯ-180 shift, add 2–3 rows, save, and reopen the form. In the read-only view, check that a *хэвийн* or *байхгүй* value that was changed is shown in red.

### Duplicate shift start and the handover master warning

```powershell
npm run test:shift-start
```

Runs 9 unit tests; no server or database is required.

The problem these fix: operators without a schedule (e.g. ҮЯ-180) could start the same shift twice. The schedule-based check only ran when the operator had a schedule for that day. They then filled the autoclave form in one record and sent the other, empty record to the master.

- `POST /api/shifts` returns **409** with `existingShiftId` when the operator already has a non-cancelled shift for the same date, shift type and station.
  - This applies with or without a schedule.
  - Cancelled shifts, other dates, shift types and stations do not block.
  - Admins creating a shift for an operator are unchanged.
- **Шинэ ээлж эхлүүлэх** opens the existing record (warning toast) instead of failing.
- In the handover panel a warning appears in two cases:
  - **Баталгаажуулах мастер** differs from the form's *Хянасан: ээлжийн мастер*.
  - The confirm master is empty while the form names a master.

  The record is sent to the panel's master, not the form's.

Duplicates created before this fix are not merged automatically. Clean them up by hand (send the record that holds the forms, delete the empty duplicate).

### Dark mode

```powershell
npm run test:theme
```

Runs 7 unit tests; no server or database is required.

- **Харанхуй горим / Гэгээлэг горим** button in the sidebar footer (`components/ThemeToggle.tsx`).
  - It toggles `class="dark"` on `<html>` and saves the choice per browser in `localStorage` (`euroblock-theme`). The default stays light.
  - A head script in `app/layout.tsx` applies the saved choice before React loads, so there is no white flash.
- Pages get no per-component `dark:` classes. `app/globals.css` redefines the Tailwind colour variables under `.dark`, since every Tailwind 4 utility reads its colour from `var(--color-…)`:
  - `white` becomes the card colour and the gray scale is inverted.
  - Coloured `-50/100/200` tints become dark tints, and `-800/900/950` text becomes light.
  - `text-*-600/700` get lighter overrides, because those shades are also used as button backgrounds.
  - Special cases: `text-white` stays white, and `bg-gray-900 text-white` buttons turn into light buttons with dark text.
- The tests cover:
  - toggling and saving, including a blocked `localStorage`
  - the head script
  - WCAG contrast of the main text/background pairs, read from `globals.css`
  - a real Tailwind compile, confirming that utilities use the variables.

To verify manually, toggle the sidebar button and check the dashboard, the approval lists, a shift page with its forms, and the sort registration. The choice applies to every page, including those without the sidebar.

### Shift finished but the handover request was never sent

```powershell
npm run test:handover-unsent
```

Runs 11 unit tests; no server or database is required.

- **Background:** «Ээлж дуусгах» only marks the shift finished. It sends nothing to the master, and the shift disappears from the «Идэвхтэй» card. Only «Хүлээлцэх хүсэлт илгээх» sends the request.
  - ҮЯ-180 operators mistook one button for the other. Their filled-in records never reached the master.
  - To send, they started a new, empty shift. The empty duplicate was approved and the real record stayed unsent (2026-11-06 … 11-10).
  - On PC-2 (2026-11-12) 45 such shifts existed at 12 stations in 60 days; 11 were masters' own master-station shifts.
- **Rule** (`lib/handover-unsent.ts`, `unsentHandoverKind`): the request is with nobody, so the owner must send it.
  - `unsent`: the shift is open (`Хадгалсан`/`Ноорог`) and finished (`operatorShiftCompleted` or `checkOut`), the request was never sent (`handoverRequestedAt` empty, stage `none`), and it is not approved.
  - `returned`: the stage is `returned` and the shift was not sent again. This holds whether a master returned it or an admin reopened it, and also when «Ээлж дуусгах» was pressed again instead of resending.
- **Shift page:**
  - After «Ээлж дуусгах» the toast is a warning that the request is not sent yet.
  - A red banner above the buttons stays until the request is sent. On a master-station shift it says «дараагийн мастерт»; on a returned shift it asks to fix and resend.
- **Red list** (`components/dashboard/UnsentHandoverShifts.tsx`): such shifts from the last 30 days, newest first, at most 5.
  - It is shown on the operator's «Нүүр» («Өнөөдрийн ээлж» card) and «Миний ээлж» tabs, and on the master's «Нүүр» for the master's own shifts.
  - Each row links back to the shift. A returned row is tagged «Буцаагдсан — засаад дахин илгээнэ үү» with the reason.
  - A row is marked as a likely duplicate when another record for the same date, shift and station already went forward.
- The tests use the real ҮЯ-180 rows. They cover both kinds, the 30-day window, duplicate flags, the wording per station kind, the rendered list, and the wiring on all three screens.

### Automatic handover acceptance when the next operator starts a shift

```powershell
npm run test:handover-auto-accept
npm run test:handover-auto-accept:db
```

The first runs 10 unit tests and needs no server or database. The second runs 1 test against the local PostgreSQL (`euroblock_local`) inside a single transaction that is always rolled back; it is skipped when the database is not running.

- **Background:** after the master approves, a shift waits in `waiting_next_operator` until the next operator presses «Хүлээн авах». A shift whose handover is not finished never reaches the admin approval list.
  - On PC-2 (2026-11-12) 105 shifts were stuck there in 60 days. The master had approved all of them.
  - In 59 of them the next operator had recorded a shift of their own at that station, so they were at work and simply never pressed the button. Notifications and the dashboard reminder already existed.
- **Rule** (`lib/handover-auto-accept.ts`): when an operator starts their own shift, every earlier shift at that station that was handed over to them and still waits for them is accepted.
  - Only `waiting_next_operator` shifts with `nextOperatorUid` = that operator, the same station, and an earlier slot (date, then Өдрийн before Шөнийн). Old backlog counts as earlier.
  - The update is the same as the manual accept in `PATCH /api/shifts/[id]`: stage `accepted`, and the master approval is locked in, so the shift appears in the admin list.
  - `handoverAcceptedByName` gets the suffix « (автоматаар)», so signature fields do not look like a deliberate acceptance. A `ShiftHandoverApproval` row and a `shift_handover_auto_accepted` audit entry record it.
  - «Хүлээн авах» and «Буцаах» still work. A shift returned before the next operator starts is not accepted.
- **Where:** `POST /api/shifts`, after the new shift is created and only when an operator starts a shift for themselves. A failure is logged and never blocks the start.
  - The response carries `autoAcceptedHandovers`; the start page shows «Ээлж хүлээн авлаа».
  - The previous operator and the shift master get the usual «Ээлж хүлээлцэх баталгаажсан» notification.
- The tests cover the rule's truth table, the update data and its parity with the manual branch, a decision made meanwhile (not overwritten), the route (operator, admin on behalf, failure), and the real schema including the admin-list predicate.

### Excel report: one form per shift

```powershell
npm run test:kpi-form-versions
```

Runs 6 unit tests; no server or database is required.

- **Background:** every save of a station form adds a new `production_logs` row (a version). The shift page shows only the latest version, but the «Тайлан / KPI» Excel exported every version as its own «Бүртгэл №».
  - So a shift appeared as many times as its form was saved. In the reported case, one ҮЯ-180 shift showed up as records 45–49 with the same notes.
  - On the local September snapshot, 806 exported forms shrink to 692. Every form sheet now has exactly one record per shift.
- **Rule** (`lib/kpi-log-export.ts`, `latestFormVersions`): for the form types in `SINGLE_FORM_LOG_TYPES`, only the newest version per shift is exported (highest `sortOrder`, then newest `createdAt`).
  - That list is exactly the types the shift page reads as «latest only». A test checks the two lists match.
  - Logs that repeat within a shift (mix, quality, periodic, production, autoclave logs) are all kept.
  - Nothing is deleted from the database; old versions stay as history.
- The form sheet note says «Ээлж бүрээс маягтын хамгийн сүүлд хадгалсан хувилбар орсон», and the overview count uses the filtered list.

### 1) Unauthenticated smoke test

Run while the dev server is up (`npm run dev`):

```bash
npm run test:smoke:unauth
```

Expected: all checks are `401` (or `403` where applicable).

### 2) Manual test protocol template

Use:

- `testing/PRD_TEST_PROTOCOL_TEMPLATE.md`

### 3) Deploy package and migration checks (Windows)

```powershell
.\node_modules\.bin\tsx.cmd --test testing/deploy-migration.test.ts
```

Checks Prisma CLI/runtime/engine packaging and verifies that missing files,
missing database configuration, and failed migrations stop deployment before
firewall or service setup. Uses temporary fixture packages and a mocked service
boundary; it does not change a database, firewall, or Windows service.

### 4) Approved history query and pagination checks

```powershell
.\node_modules\.bin\tsx.cmd --test testing/approval-history.test.ts
```

Checks inclusive date ranges, station/form mapping, crew and name filters,
pagination bounds, and literal SQL parameter handling. Rendering checks ensure
server pages retain all returned rows and report the filtered total, while
existing local pagination still works. No database is required.

For API/browser verification, use an admin and compare each endpoint's `total`
with all pages combined, including old approved records. Both APIs accept
`since`, `until`, `station`, `crew`, `query`, `page`, and `pageSize`:

- `/api/shifts?queryType=admin_approved`
- `/api/y310-approvals?state=approved`

The default page size is 20 (maximum 100). Responses include `page`, `pageSize`,
and `totalPages`; the approved badge and table use the same filtered response.
Verify that changing or clearing a filter resets to page 1, the final page is
reachable, and an empty filtered result shows a zero badge.

### 5) Manual user selection and duplicate-name checks

```powershell
node testing/picked-user.test.mjs
```

Tests exact ID selection, duplicate-name rejection, legacy unique names/emails,
inactive and wrong-role accounts, and signature name display. Runs the actual
PATCH and Y099 log handlers with isolated storage/notification fixtures:
ambiguous selections must return 400 before any write or notification, and
successful requests must save and notify the exact selected ID. No DB or server
is required; TypeScript is compiled in memory.

For browser verification, select the account with the intended email when names
repeat. A handover request must contain `nextOperatorUid`, `confirmMasterUid`,
`nextMasterUid` or `approvalAdminUid`; Y099 saves `receivedByUid`. Saved signatures
and reports continue to display names. Intercept mutation requests when testing
against a real local dump.

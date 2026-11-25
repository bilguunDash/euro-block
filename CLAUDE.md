# CLAUDE.md

Euroblock AAC (хийцэлсэн бетон блок) үйлдвэрийн **ээлжийн бүртгэлийн систем**.
Операторууд ээлж бүрт дамжлагынхаа маягтыг бөглөж, мастер/админ баталгаажуулдаг.
UI бүхэлдээ монгол хэл дээр.

## Stack

- **Next.js 15** (App Router, `output: 'standalone'`), **React 19**, **TypeScript**
- **Prisma 7** + **PostgreSQL** (`@prisma/adapter-pg`)
- **NextAuth 4** — Credentials (bcryptjs). JWT session, role/stationCode-г token-д хадгална
- **Tailwind 4**, **SWR** (data fetch), **Vercel Blob** (файл хадгалалт, optional)

## Commands

```bash
npm run dev      # дев сервер (localhost:3000)
npm run build    # prisma generate + next build (standalone гаргана)
npm run lint     # eslint (build-д алгасдаг — next.config.ts: ignoreDuringBuilds)
npx prisma migrate dev      # локал миграц
npx prisma migrate deploy   # production миграц
```

TypeScript алдаа build-ийг зогсооно (`ignoreBuildErrors: false`), ESLint зогсоохгүй.

## Архитектур

```
app/
  api/**/route.ts     # REST endpoint-ууд (Next route handlers)
  shift/new/page.tsx  # ээлж эхлүүлэх
  shift/[id]/page.tsx # ээлжийн дэлгэрэнгүй + дамжлагын маягт (хамгийн том файл)
  dashboard/page.tsx  # үндсэн dashboard
lib/                  # домэйн логик — бүх бизнес дүрэм энд
  y*.ts               # станц бүрийн маягтын тодорхойлолт (y110, y120, ...)
  shift-api-permissions.ts  # RBAC — PATCH/GET эрхийн шалгалт
  shift-db.ts         # form payload ⇄ Prisma хооронд хөрвүүлэх + станцын нэр/key
  master-stations.ts  # мастер станцууд + маягтын тохиргоо
  *-handover.ts, operator-schedule-resolver.ts  # дамжлага хүлээлцэх логик
components/
  shift/forms/*       # станцын маягтын форм
  shift/*ReadOnly.tsx # баталгаажсан маягтын зөвхөн харах хувилбар
  dashboard/tabs/*    # dashboard-ийн таб бүр (role-оор ялгаатай)
```

## Үндсэн домэйн ойлголтууд

### Role-ууд (8)
`operator`, `master`, `admin`, `dispatcher`, `hse_engineer`, `sort_operator`, `chief_engineer`, `auditor`
- Каталог (утга + монгол нэршил): `lib/roles.ts` (`ALLOWED_ROLES`, `ROLE_OPTIONS`, `isAllowedRole`, `normalizeRole`, `roleLabel`)
- `sort_operator` = зөвхөн сорт бүртгэлийн role, `lib/sort-api-permissions.ts` танина
  (станцгүй, рам ба сорт хоёр хагасыг хоёуланг хийнэ; устгах эрхгүй)
- `auditor` = зөвхөн харах (MANAGEMENT_READ_ONLY)
- `admin` ба `chief_engineer` = эцсийн баталгаажуулалт хийх эрхтэй
- Эрхийн жагсаалт: `lib/shift-api-permissions.ts` (PRIVILEGED_SHIFT_READ, *_PATCH_KEYS)

### Станцууд
`ҮЯ-XXX` код. Нэр/код: `STATION_NAME_BY_CODE`, маягтын key: `FORM_KEY_BY_STATION` (`lib/shift-db.ts`).
**Мастер станцууд** (`lib/master-stations.ts`): `ҮЯ-099`, `ҮЯ-181`, `ҮЯ-310`, `ҮЯ-400`, `ҮЯ-410`.
Мастер станц бүр checklist маягттай байх шаардлагагүй (`MASTER_STATION_FORMS` нь `Partial`).
`ҮЯ-181` (Дулааны мастер, ДУХ-05) — `lib/y181-heat-master-form.ts` бүрэн checklist маягттай:
Ус хангамж/бохир ус, Технологийн зуух, Автоклав, Халаалтын зуух 4 хэсэг, тийм/үгүй мөр бүрээр.

**Станцын каталог 4 газарт ДАВХАРДАЖ хадгалагддаг** — шинэ станц нэмэхэд БҮГДИЙГ шинэчил:
`lib/shift-db.ts` (STATION_NAME_BY_CODE), `app/api/stations/route.ts` (DEFAULT_CONTROL_STATIONS),
`app/shift/new/page.tsx` (STATIONS — эхлэх станцын жагсаалт),
`components/dashboard/Dashboard.tsx` (STATIONS — dashboard-ийн `stations` prop, хамгийн олон
дропдаунд ашиглагддаг эх сурвалж). Эдгээрийн аль нэгийг мартвал шинэ станц dropdown-д
харагдахгүй эсвэл эхлэх боломжгүй болно.

### Ээлжийн баг (crew) — хэн хэнийг хариуцах
Хуучин "Хяналтын бүтэц" (`control_assignments` хүн × хүн матриц) **устсан** (2026-07-29).
Одоо гурван зүйлээр тодорхойлогдоно:

1. `users.shiftGroup` — `'1'` / `'2'` / `'3'` / `null`. Ээлжийн баг.
2. `users.stationCode` — хүн бүрийн станц. **Мастерт ч заавал** (мастер станц байх ёстой).
3. `lib/crew-master.ts` — хариуцлагын логик. **Станцын харьяалал БАЙХГҮЙ.**

**Хариуцах мастер олох** (`resolveCrewMasterForShift`): багийн аль ч мастер аль ч операторыг
хариуцаж болно. Сонголт: ① тухайн slot-д хуваарьтай багийн мастерууд → ② `ҮЯ-099` тэргүүлнэ
→ ③ нэрээр. Багт мастер байхгүй бол `null`.

**Мастерын харах эрх** (`crewOperatorUids`): өөрийн багийн операторуудын ээлж + өөрийн
мастер станцын ээлжүүд. Мастер багт харьяалагдаагүй бол хүрээ хязгаарлахгүй.

**Анхаар:** мастерын хуваарь үүсгэхэд операторын хуваарь автоматаар үүсэхээ **больсон**.
Операторыг `POST /api/schedules/bulk-crew` (багаар) эсвэл `/api/operator-schedules` (нэгээр) оноодог.

Дэлгэрэнгүй: `docs/shift-crew-architecture.md`

### Дамжлага хүлээлцэх (handover) — хамгийн нарийн логик
Ээлжийн төгсгөлд ажлыг дараагийн ээлжид албан ёсоор шилжүүлэх процесс.
`handoverStage` талбараар шат дамждаг:
1. `waiting_current_master` — одоогийн мастер баталгаажуулахыг хүлээж байна
2. `waiting_next_master` — дараагийн мастер хүлээж авахыг хүлээж байна
3. `waiting_next_operator` — дараагийн оператор хүлээж авахыг хүлээж байна
4. `accepted` / `returned` — дууссан / буцаагдсан

Бүх шилжилт `app/api/shifts/[id]/route.ts` PATCH дотор. Баталгаажуулсан тэмдэглэл
`ShiftHandoverApproval` мод-д бичигдэнэ. Дамжлага бүрэн дуусаагүй бол `masterApproved`,
`adminApproved` set хийхийг блоклоно.

**Анхаар:** PATCH нь shift-ийг ачаалахдаа зөвхөн `productionLogs` include хийдэг —
`shiftMasterStationCode` зэрэг GET-ийн computed талбарууд PATCH дотор байхгүй.
Master station code хэрэгтэй бол `findAssignedMasterForShift` / `resolveMasterStationCode`
ашиглаж DB-ээс дахин шийднэ.

## ERP sync (автомат хэрэглэгч үүсгэх)

`app/api/erp-sync/route.ts` — erp.mak.mn (Odoo)-оос ажилчдыг татаж user үүсгэнэ.
- Server дээр Windows Task Scheduler өдөр бүр 05:00-д `scripts/erp-sync-cron.ps1` ажиллуулна
- `ERP_SYNC_SECRET` Bearer token-оор эсвэл admin session-оор дуудна
- `resolveRole(job_name)` — `job_name` доторх түлхүүр үгээр role оноодог.
  Дараалал чухал: `хабэа`/`хаэа` → `hse_engineer`, `ерөнхий инженер` → `chief_engineer`-ийг
  `инженер` → `admin`-аас **өмнө** шалгана (эс тэгвээс "Ерөнхий инженер" `admin` болно)
- Шинэ хэрэглэгчийн default нууц үг: `ERP_SYNC_DEFAULT_PASSWORD` (required; no built-in default)
- Имэйл байвал давхцлыг имэйлээр, эс бол нэрээр шалгаж алгасна

## Deploy (Windows Server / "PC-2")

Локал build → zip → server дээр `C:\euroblock\` руу задлана.

```powershell
.\deploy-build.ps1                          # PC-1 (дев) дээр zip бэлдэнэ
# euroblock-deploy.zip-г server руу хуулж C:\euroblock\ задал
.\deploy-server.ps1                         # server дээр Administrator-аар (NSSM service)
.\scripts\setup-task-scheduler.ps1          # ERP sync cron бүртгэх
```

- **NSSM**-ээр Windows Service (`EuroblockApp`) болгож ажиллуулна
- Node дотоод порт **3010**, **IIS** reverse proxy 3001→3010
- `.env.local` нь `C:\euroblock\.env.local` (жишээ: `.env.production.example`)
- **NSSM env var:** `AppEnvironmentExtra` нь REG_MULTI_SZ — бүх var-г нэг дор
  registry-д бичнэ (`nssm set`-ийг давтан дуудвал дарж бичигдэнэ)

## Орчны хувьсагч (.env.local)

`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DATABASE_URL`, `DIRECT_URL`,
`GOOGLE_CLIENT_ID/SECRET`, `ERP_BASE_URL`, `ERP_LOGIN`, `ERP_PASSWORD`,
`ERP_SYNC_SECRET`, `ERP_SYNC_DEFAULT_PASSWORD`, `BLOB_READ_WRITE_TOKEN` (optional).

## Анхаарах зүйлс

- **Платформ:** server PowerShell **5.1** — `?.`, `??`, `&&`/`||` pipeline байхгүй.
  if/else, тодорхой null шалгалт ашигла
- **HTTP LAN context:** `crypto.randomUUID` нь localhost бус http-д ажиллахгүй —
  `app/layout.tsx`-д polyfill байгаа
- Шинэ станцын маягт нэмэхэд: `lib/y*.ts` тодорхойлолт + `components/shift/forms/` +
  `*ReadOnly.tsx` + `shift-db.ts`-ийн `STATION_NAME_BY_CODE`/`FORM_KEY_BY_STATION` бүгдийг шинэчил
- API дотор бизнес дүрмийг шууд бичихгүй — `lib/` доторх helper-уудыг дууд
- Эрх олгохдоо `lib/shift-api-permissions.ts`-ийн allowlist-ийг шинэчил (silent fail-ээс сэргийл)

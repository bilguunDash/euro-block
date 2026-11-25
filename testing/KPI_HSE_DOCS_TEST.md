## KPI + CSV export test

1. Login as `manager` / `auditor` / `dispatcher` / `admin`.
2. Dashboard → KPI tab.
3. Click **CSV татах**.

Expected:
- downloads `kpi-shifts-<since>.csv`
- contains headers: shiftDate, shiftType, stationCode, operatorName, status, operatorShiftCompleted, masterApproved, id

API:
- `GET /api/reports/kpi?format=csv&since=YYYY-MM-DD`

## HSE documents test

### Create (admin or hse_engineer)

`POST /api/hse-documents`

```json
{
  "title": "PPE SOP",
  "fileUrl": "https://example.com/ppe.pdf",
  "sortOrder": 1
}
```

Expected:
- `ok: true`

### View (any authenticated)

- Dashboard → Documents tab shows the item.
- Clicking `Унших` opens the URL.


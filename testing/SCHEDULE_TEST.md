## Schedule test (dispatcher/admin)

### A) Master schedule (`/api/schedules`)

1. Login as `dispatcher` or `admin`.
2. Dashboard → Admin tab.
3. Create assignment (existing UI).

Expected:
- row appears in schedule list
- assigned user gets notification `shift_assigned`

Delete:
- click trash icon
- row disappears

### B) Operator schedule (`/api/operator-schedules`)

Create via API (dispatcher/admin):

`POST /api/operator-schedules`

```json
{
  "shiftDate": "2026-04-14",
  "shiftType": "Өдрийн",
  "stationCode": "ҮЯ-110",
  "operatorUid": "<USER_ID>",
  "operatorName": "<optional>"
}
```

Expected:
- Operator dashboard shows the slot under “Миний ээлж”
- On shift detail (of the previous shift for same slot), “Дараагийн оператор (хуваарь)” dropdown lists the operator.


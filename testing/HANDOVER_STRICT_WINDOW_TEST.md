## Handover strict window test (Corrected: 08:10–19:40 / 20:10–07:40)

### 1) Turn strict mode ON

Login as `admin`, then call:

`PATCH /api/settings`

Body:

```json
{
  "settings": {
    "shift_handover_window_strict": "true"
  }
}
```

### 2) Negative test (outside window)

As an `operator` (shift owner), attempt:

`PATCH /api/shifts/<id>`

Body:

```json
{
  "handoverAwaitingAcceptance": true,
  "handoverRequestedAt": "<now_iso>"
}
```

Expected:
- HTTP `403`
- message contains: `Ээлж хүлээлцэх цагийн цонх`

### 3) Positive test (inside window)

Repeat the same request inside:
- Day: 08:10–19:40
- Night: 20:10–07:40

Expected:
- HTTP `200`
- shift `handoverAwaitingAcceptance=true`

### 4) Turn strict mode OFF (restore)

`PATCH /api/settings`

```json
{
  "settings": {
    "shift_handover_window_strict": "false"
  }
}
```


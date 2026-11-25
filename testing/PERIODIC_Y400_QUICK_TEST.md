## ҮЯ-400 periodic quick test (interval хурдан болгох)

### 1) interval-ийг багасгах (admin)

`PATCH /api/settings`

```json
{
  "settings": {
    "periodic_interval_hours": "0.01"
  }
}
```

0.01 цаг ≈ 36 секунд.

### 2) ҮЯ-400 дээр shift эхлүүлэх (operator/master)

- `/shift/new` → station `ҮЯ-400` → ээлж эхлүүл.
- `Periodic` log нэмэхгүйгээр 1–2 минут хүлээ.

Expected:
- Shift detail дээр `Тогтмол бүртгэл хоцорсон` banner гарна
- Notification хүснэгтэд `kind=periodic_late` мөр үүснэ (тухайн хэрэглэгчид)

### 3) Бусад станц дээр periodic сануулга гарахгүй

- `ҮЯ-110` гэх мэт станц дээр shift эхлүүлээд 1–2 минут хүлээ.

Expected:
- periodic late banner **гарахгүй**

### 4) interval-ийг буцаах (admin)

`PATCH /api/settings`

```json
{
  "settings": {
    "periodic_interval_hours": "2"
  }
}
```


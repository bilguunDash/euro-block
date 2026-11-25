# Диаграмууд

Цэвэр mermaid эх файлууд (`.mmd`) — шууд render хийхэд ашиглана:

```powershell
npx -y @mermaid-js/mermaid-cli -i docs/diagrams/<файл>.mmd -o out.svg
```

> `.md` баримтыг бүхэлд нь mermaid renderer руу өгвөл `No diagram type detected` алдаа гарна.
> Markdown нь fenced блок доторх диаграмыг VSCode preview / GitHub дээр өөрөө render хийдэг.

## Шинэ архитектур — Ээлжийн баг (санал)

Баримт: [../shift-crew-architecture.md](../shift-crew-architecture.md)

| Файл | Юу харуулах |
|---|---|
| **[shift-crew-architecture.mmd](shift-crew-architecture.mmd)** | ⭐ **ГОЛ** — суурь тохиргоо → багийн бүрэлдэхүүн → хуваарь оноох → ээлж ажиллах → мастерын харах эрх, бүгд нэг зурагт |
| [shift-crew-erd.mmd](shift-crew-erd.mmd) | Шинэ өгөгдлийн загвар (`users.shiftGroup` нэмэгдэж, `control_assignments` устана) |
| [shift-crew-before-after.mmd](shift-crew-before-after.mmd) | Өмнө/дараа харьцуулалт — товч, танилцуулгад |
| ~~[shift-crew-flow.mmd](shift-crew-flow.mmd)~~ | ⚠️ **Хуучирсан** — `shift-crew-architecture.mmd` үүнийг бүрэн орлуулсан |

## Одоогийн систем — Хяналтын бүтэц ↔ Ээлжийн хуваарь

Баримт: [../control-structure-schedule-erd.md](../control-structure-schedule-erd.md)

| Файл | Юу харуулах |
|---|---|
| **[control-structure-schedule-erd.mmd](control-structure-schedule-erd.mmd)** | ⭐ **ГОЛ** — одоогийн бүтэн ERD |
| [control-structure-schedule-lifecycle.mmd](control-structure-schedule-lifecycle.mmd) | Одоогийн амьдралын мөчлөг |
| [control-structure-schedule-mutations.mmd](control-structure-schedule-mutations.mmd) | Хуваарь засах/устгахад юу болох |

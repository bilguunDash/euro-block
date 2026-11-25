type ShiftIssue = {
  id?: unknown;
  shiftId?: unknown;
  shift?: { id?: unknown } | null;
} | null | undefined;

/** Нүүрийн анхааруулах нийт дүн: нэг ээлж хэдэн жагсаалтад орсон ч нэг удаа. */
export function countDistinctAttentionByCategory(groups: ReadonlyArray<ReadonlyArray<ShiftIssue>>): number[] {
  const shiftIds = new Set<string>();
  return groups.map((rows) => {
    let count = 0;
    for (const row of rows) {
      if (!row) continue;
      // Мастерын маягтын id нь log id; дутуу бүртгэлийн shift нь nested.
      const id = String(row.shift?.id ?? row.shiftId ?? row.id ?? '').trim();
      if (id) {
        if (shiftIds.has(id)) continue;
        shiftIds.add(id);
      }
      count++;
    }
    return count;
  });
}

export function countDistinctAttentionShifts(groups: ReadonlyArray<ReadonlyArray<ShiftIssue>>): number {
  return countDistinctAttentionByCategory(groups).reduce((total, count) => total + count, 0);
}

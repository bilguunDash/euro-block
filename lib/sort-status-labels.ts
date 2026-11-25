/** Port of STATUS_TEXT_MN from the old system's server/main.py. */
export const SORT_STATUS_LABELS: Record<string, string> = {
  draft: 'ноорог',
  waiting_sort: 'хүлээгдэж байна',
  completed: 'дууссан',
  deleted: 'устгасан',
};

export function sortStatusLabel(status: string | null | undefined): string {
  return SORT_STATUS_LABELS[String(status || '')] || String(status || '');
}

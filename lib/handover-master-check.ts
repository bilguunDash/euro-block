/**
 * Хүлээлгэн өгөх цонх: маягтад бичсэн «Хянасан: ээлжийн мастер» болон бүртгэл бодитоор
 * илгээгдэх «Баталгаажуулах мастер»-ыг тулгана.
 *
 * Маягтын мастер (`sigShiftMaster`) нь зөвхөн гарын үсэг — бүртгэлийг хэнд илгээхийг цонхны
 * сонголт шийддэг. Оператор маягтад нэг мастер бичээд цонхонд өөр мастер үлдээвэл бүртгэл
 * маягтад бичсэн мастерт очдоггүй байв.
 */

function normalizeName(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Ээлжийн маягтуудын `sigShiftMaster` — эхний бөглөгдсөн нэр (байхгүй бол ''). */
export function shiftFormMasterName(forms: ReadonlyArray<unknown>): string {
  for (const form of forms) {
    if (!form || typeof form !== 'object') continue;
    const name = String((form as Record<string, unknown>).sigShiftMaster ?? '').trim();
    if (name) return name;
  }
  return '';
}

/**
 * Зөрүүтэй бол анхааруулгын текст, үгүй бол ''.
 * `confirm.uid` хоосон = мастер сонгоогүй (бүртгэл багийн мастерт автоматаар очно).
 * `confirm.uid` байгаа ч нэр нь тодорхойгүй бол тулгах боломжгүй тул анхааруулахгүй.
 */
export function confirmMasterWarning(
  formMasterName: string,
  confirm: { uid?: string | null; name?: string | null }
): string {
  const formName = String(formMasterName ?? '').trim();
  if (!normalizeName(formName)) return '';
  if (!String(confirm.uid ?? '').trim()) {
    return `Маягтад «${formName}» гэж бичсэн. Бүртгэлийг энэ мастерт илгээх бол доороос түүнийг сонгоно уу.`;
  }
  const confirmName = String(confirm.name ?? '').trim();
  if (!normalizeName(confirmName) || normalizeName(confirmName) === normalizeName(formName)) return '';
  return `Маягтад «${formName}» гэж бичсэн ч бүртгэл «${confirmName}» руу илгээгдэнэ. Зөв мастерыг сонгоно уу.`;
}

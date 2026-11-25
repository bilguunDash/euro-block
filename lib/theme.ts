/**
 * Гэгээлэг / харанхуй горим. Сонголт тухайн төхөөрөмжийн хөтөчид (localStorage) хадгалагдана.
 * Анхдагч нь гэгээлэг. Харанхуй горимын өнгөнүүд `app/globals.css`-ийн `.dark` хэсэгт байна.
 */
export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'euroblock-theme';

export function parseTheme(value: unknown): ThemeMode {
  return value === 'dark' ? 'dark' : 'light';
}

/**
 * `<head>` дотор React ачаалагдахаас өмнө ажиллана — харанхуй горимтой хэрэглэгчид хуудас
 * нээгдэхдээ цагаанаар гялсхийхгүй. localStorage хаалттай (private горим г.м.) бол анхдагч хэвээр.
 */
export const THEME_INIT_SCRIPT =
  `try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}`;

type ClassListTarget = { classList: { toggle(token: string, force?: boolean): unknown } };
type ThemeStorage = { setItem(key: string, value: string): void } | null | undefined;

/** `<html>`-д `dark` классыг тавьж/авч, сонголтыг хадгална (хадгалах боломжгүй бол чимээгүй алгасна). */
export function applyTheme(mode: ThemeMode, root: ClassListTarget, storage?: ThemeStorage): void {
  root.classList.toggle('dark', mode === 'dark');
  try {
    storage?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // localStorage хаалттай — горим энэ хуудсанд л үйлчилнэ.
  }
}

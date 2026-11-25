// Харанхуй горим: <html class="dark"> сэлгэх, сонголт хадгалах, хуудас ачаалахаас өмнө тавих, мөн
// globals.css-ийн харанхуй өнгөнүүд уншигдахуйц (WCAG contrast) эсэх, Tailwind utility-ууд өнгөө
// хувьсагчаас уншдаг (энэ аргын үндэс) эсэхийг шалгана.
//
//   node --import tsx --test --test-isolation=none testing/theme.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeToggle } from '../components/ThemeToggle';
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY, applyTheme, parseTheme } from '../lib/theme';
import { load, nodes, textOf } from './helpers/approvals-section.mjs';

(globalThis as any).React = React;
const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

function fakeClassList(initial: string[] = []) {
  const set = new Set(initial);
  return {
    set,
    add: (token: string) => { set.add(token); },
    contains: (token: string) => set.has(token),
    toggle: (token: string, force?: boolean) => {
      const on = force ?? !set.has(token);
      if (on) set.add(token); else set.delete(token);
      return on;
    },
  };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v; } };
}

// ─────────────────────────────────────────────── lib/theme ───────────────────────────────────────────────

test('parseTheme: only «dark» is dark; anything else is the light default', () => {
  assert.equal(parseTheme('dark'), 'dark');
  for (const value of ['light', '', null, undefined, 'DARK', 1]) assert.equal(parseTheme(value), 'light');
});

test('applyTheme sets/removes the html class and remembers the choice; a blocked storage is ignored', () => {
  const classList = fakeClassList();
  const storage = fakeStorage();
  applyTheme('dark', { classList }, storage);
  assert.ok(classList.contains('dark'));
  assert.equal(storage.data[THEME_STORAGE_KEY], 'dark');
  applyTheme('light', { classList }, storage);
  assert.ok(!classList.contains('dark'));
  assert.equal(storage.data[THEME_STORAGE_KEY], 'light');
  assert.doesNotThrow(() => applyTheme('dark', { classList }, { setItem() { throw new Error('blocked'); } }));
  assert.ok(classList.contains('dark'));
});

test('the head script applies a saved dark choice before React loads, and never throws', () => {
  const run = (localStorage: unknown) => {
    const classList = fakeClassList();
    vm.runInNewContext(THEME_INIT_SCRIPT, { localStorage, document: { documentElement: { classList } } });
    return classList.contains('dark');
  };
  assert.equal(run(fakeStorage({ [THEME_STORAGE_KEY]: 'dark' })), true);
  assert.equal(run(fakeStorage({ [THEME_STORAGE_KEY]: 'light' })), false);
  assert.equal(run(fakeStorage()), false, 'no saved choice → light (unchanged default)');
  assert.equal(run({ getItem() { throw new Error('private mode'); } }), false);
  assert.ok(read('app/layout.tsx').includes('__html: THEME_INIT_SCRIPT'), 'the root layout injects the script');
});

// ─────────────────────────────────────────────── ThemeToggle ───────────────────────────────────────────────

test('toggle renders as «Харанхуй горим» on the server and sits in the sidebar', () => {
  const html = renderToStaticMarkup(React.createElement(ThemeToggle));
  assert.ok(html.includes('Харанхуй горим'));
  assert.ok(html.includes('aria-pressed="false"'));
  const sidebar = read('components/dashboard/Sidebar.tsx');
  assert.ok(sidebar.includes("import { ThemeToggle } from '@/components/ThemeToggle'") && sidebar.includes('<ThemeToggle'));
});

test('clicking the toggle switches <html class="dark">, saves it, and flips the label', () => {
  // Хөтөч дээр `useSyncExternalStore` render бүрт client snapshot-ыг (<html> класс) уншина.
  const mockReact = {
    ...React,
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
  };
  const req = createRequire(import.meta.url);
  const { ThemeToggle: Toggle } = load('components/ThemeToggle.tsx', {
    react: mockReact,
    'lucide-react': { Moon: () => null, Sun: () => null },
    '@/lib/theme': load('lib/theme.ts'),
    'react/jsx-runtime': req('react/jsx-runtime'),
  }) as { ThemeToggle: (props: Record<string, unknown>) => unknown };

  const classList = fakeClassList(['dark']); // a saved dark choice already applied by the head script
  const storage = fakeStorage();
  const g = globalThis as any;
  const saved = { document: g.document, window: g.window };
  g.document = { documentElement: { classList } };
  g.window = { localStorage: storage };
  try {
    const render = () => nodes(Toggle({}));
    let button = render().find((node: any) => node.type === 'button');
    assert.equal(textOf(button).trim(), 'Гэгээлэг горим', 'starts in the saved dark mode');
    assert.equal(button.props['aria-pressed'], true);

    button.props.onClick();
    button = render().find((node: any) => node.type === 'button');
    assert.ok(!classList.contains('dark'));
    assert.equal(storage.data[THEME_STORAGE_KEY], 'light');
    assert.equal(textOf(button).trim(), 'Харанхуй горим');

    button.props.onClick();
    assert.ok(classList.contains('dark'));
    assert.equal(storage.data[THEME_STORAGE_KEY], 'dark');
  } finally {
    g.document = saved.document;
    g.window = saved.window;
  }
});

// ─────────────────────────────────────────────── globals.css ───────────────────────────────────────────────

const css = read('app/globals.css');
const darkBlock = css.slice(css.indexOf('.dark {'), css.indexOf('}', css.indexOf('.dark {')));
const darkVar = (name: string) => {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(darkBlock);
  assert.ok(match, `--color-${name} is not set for dark mode`);
  return match[1];
};
const textOverride = (cls: string) => {
  const match = new RegExp(`\\.dark \\.${cls} \\{ color: (#[0-9a-f]{6}); \\}`, 'i').exec(css);
  assert.ok(match, `.dark .${cls} override missing`);
  return match[1];
};

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('dark palette is readable: body text ≥ 7:1, secondary ≥ 4.5:1, muted ≥ 3:1, badges ≥ 4.5:1', () => {
  const surface = darkVar('white');
  const page = darkVar('gray-50');
  const pairs: Array<[string, string, string, number]> = [
    ['text-gray-900 on card', darkVar('gray-900'), surface, 7],
    ['text-gray-700 on page', darkVar('gray-700'), page, 7],
    ['text-gray-500 on card', darkVar('gray-500'), surface, 4.5],
    ['text-gray-400 (muted) on card', darkVar('gray-400'), surface, 3],
    ['inverted dark button text', '#0f141d', darkVar('gray-900'), 7],
    ['inverted dark button text (hover)', '#0f141d', darkVar('gray-800'), 7],
    ['amber badge', darkVar('amber-800'), darkVar('amber-50'), 4.5],
    ['amber-700 text on amber tint', textOverride('text-amber-700'), darkVar('amber-50'), 4.5],
    ['red-700 text on red tint', textOverride('text-red-700'), darkVar('red-50'), 4.5],
    ['emerald-700 text on emerald tint', textOverride('text-emerald-700'), darkVar('emerald-50'), 4.5],
    ['orange-700 text on orange tint', textOverride('text-orange-700'), darkVar('orange-50'), 4.5],
    ['blue-700 text on blue tint', textOverride('text-blue-700'), darkVar('blue-50'), 4.5],
    ['orange-600 link on card', textOverride('text-orange-600'), surface, 4.5],
    ['red-600 text on card', textOverride('text-red-600'), surface, 4.5],
  ];
  for (const [label, fg, bg, min] of pairs) {
    const ratio = contrast(fg, bg);
    assert.ok(ratio >= min, `${label}: ${ratio.toFixed(2)}:1 < ${min}:1 (${fg} on ${bg})`);
  }
  assert.ok(contrast(darkVar('gray-200'), surface) >= 1.2, 'borders stay visible on cards');
});

test('Tailwind utilities read colours from variables, so the .dark block re-themes every page', async () => {
  const req = createRequire(path.join(root, 'package.json'));
  const postcss = req('postcss');
  const tailwind = req('@tailwindcss/postcss');
  const file = path.join(root, 'app', 'globals.css');
  const out = (await postcss([tailwind({ base: root })]).process(css, { from: file })).css.replace(/\s+/g, ' ');
  const ruleOf = (selector: string) => {
    const i = out.indexOf(`${selector} {`);
    assert.ok(i >= 0, `${selector} not generated`);
    return out.slice(i, out.indexOf('}', i) + 1);
  };
  assert.match(ruleOf('.bg-white'), /var\(--color-white\)/);
  assert.match(ruleOf('.bg-gray-50'), /var\(--color-gray-50\)/);
  assert.match(ruleOf('.text-gray-900'), /var\(--color-gray-900\)/);
  assert.match(ruleOf('.bg-amber-50'), /var\(--color-amber-50\)/);
  assert.match(ruleOf('.text-white'), /var\(--color-white\)/, 'text-white needs the #fff override');
  assert.ok(out.includes('.dark .text-white { color: #fff; }'));
  assert.ok(/@layer utilities \{/.test(out), 'utilities are layered, so the unlayered .dark rules win');
});

export const CATEGORY_OPTIONS = [
  '\u67f1',
  '\u5e8a',
  '\u58c1',
  '\u958b\u53e3',
  '\u8a2d\u5099'
] as const;

export const UNIT_OPTIONS = ['m', '\u33a1', '\u500b'] as const;

export type Category = (typeof CATEGORY_OPTIONS)[number];
export type Unit = (typeof UNIT_OPTIONS)[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  '\u67f1': '#0ea5e9',
  '\u5e8a': '#22c55e',
  '\u58c1': '#f59e0b',
  '\u958b\u53e3': '#8b5cf6',
  '\u8a2d\u5099': '#14b8a6'
};

// データストア：data.json を読み込み、各モジュールで共有する。
// export された配列は ES Module のライブバインディングなので、loadData() 後の
// 代入が他モジュールにも反映される（init は読み込み後に呼ぶこと）。

export const CATCOLORS = {
  '基本': '#2f7d6e', 'たんぱく質': '#c8623c', '脂質': '#d8a23a',
  '炭水化物': '#6a8caf', '無機質': '#7a5ea8', 'ビタミン': '#3f9b86',
};

export let COLS = [];      // 栄養素カラム定義 [{key,label,unit,cat}]
export let FOODS = [];     // 食品 [{g,n,no,v:{key:value}}]
export let GROUPS = [];    // 食品群名の配列
export let colByKey = {};  // key -> column
export let CATS = [];      // カテゴリ名の配列（出現順）

export async function loadData() {
  const url = new URL('../data.json', import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`data.json の読み込みに失敗しました (${res.status})`);
  const d = await res.json();
  COLS = d.columns;
  FOODS = d.foods;
  GROUPS = d.groups;
  colByKey = Object.fromEntries(COLS.map(c => [c.key, c]));
  CATS = [...new Set(COLS.map(c => c.cat))];
  return d;
}

// 汎用ユーティリティ（数値整形・統計）

// 数値を見やすく整形（大きい値は整数、小さい値は小数）
export const fmt = n =>
  n == null ? '—'
  : (Math.abs(n) >= 100 ? n.toFixed(0)
    : Math.abs(n) >= 10 ? n.toFixed(1)
    : n.toFixed(2)).replace(/\.0+$/, '');

// 軸の最大値をきりのよい値に丸める
export function niceMax(v) {
  if (!v || v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / e;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * e;
}

// 表示用の食品名：() ・（）の中身を括弧ごと除去（検索は元の名称のまま行う）
export const dispName = n =>
  n.replace(/[（(][^（）()]*[）)]/g, '').replace(/\s+/g, ' ').trim() || n;

// 分位点（線形補間）
export function quantile(sorted, q) {
  const p = (sorted.length - 1) * q, b = Math.floor(p), r = p - b;
  return sorted[b + 1] !== undefined ? sorted[b] + r * (sorted[b + 1] - sorted[b]) : sorted[b];
}

// 箱ひげ統計量（min/q1/median/q3/max, mean, std, cv）
export function boxStats(vals) {
  const s = [...vals].sort((a, b) => a - b), n = s.length;
  const q1 = quantile(s, .25), med = quantile(s, .5), q3 = quantile(s, .75), iqr = q3 - q1;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return { n, min: s[0], max: s[n - 1], q1, med, q3, iqr, mean, std, cv: mean ? std / mean : 0, sorted: s };
}

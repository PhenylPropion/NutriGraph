// タブ④ 食品×栄養素マトリクス：各セルに棒グラフ＋群全体の統計量を重ねる。
// 棒の色はその食品が群の中でどの統計段階を超えているかを表す。
import { COLS, FOODS, GROUPS } from '../store.js';
import { fmt, dispName, boxStats } from '../utils.js';
import { buildNutPicker } from '../nutrientPicker.js';

const mxNuts = ['ENERC_KCAL', 'PROT', 'FAT', 'CHOCDF', 'FIB', 'CA', 'FE', 'VITC', 'NACL_EQ'];

// 統計量マーカーの色
const STATC = { q1: '#3b82c4', q3: '#8a5fb0', mean: '#5b6670', med: '#e0762e' };
// 棒の色＝その食品が「どの統計量を超えているか」で5段階
const TIERS = [
  { label: '< Q1（少ない）', color: '#c2ccd2' },
  { label: '≥ Q1', color: '#8fc0b1' },
  { label: '≥ 中央値', color: '#3f9b86' },
  { label: '≥ Q3（多い）', color: '#2f7d6e' },
  { label: 'スケール超（突出）', color: '#d64541' },
];
function tierOf(v, st) {
  if (v > st.max) return 4;   // 上位5%除外スケールを超える＝突出
  if (v >= st.q3) return 3;
  if (v >= st.med) return 2;
  if (v >= st.q1) return 1;
  return 0;
}

export function initMatrix() {
  const g = document.getElementById('mx-group');
  g.innerHTML = GROUPS.map(x => `<option>${x}</option>`).join('');
  g.value = '野菜類';
  buildNutPicker(document.getElementById('mx-nuts'), mxNuts, () => { fillSortCol(); draw(); });
  g.onchange = draw;
  document.getElementById('mx-topn').oninput = draw;
  document.getElementById('mx-all').onchange = function () { document.getElementById('mx-topn').disabled = this.checked; draw(); };
  document.getElementById('mx-sortcol').onchange = draw;
  document.querySelectorAll('#mx-sort button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#mx-sort button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); draw();
  });
  fillSortCol(); draw();
}

function fillSortCol() {
  const sc = document.getElementById('mx-sortcol'); const cur = sc.value;
  const cols = COLS.filter(c => mxNuts.includes(c.key));
  sc.innerHTML = '<option value="__name">食品名（成分表順）</option>' + cols.map(c => `<option value="${c.key}">${c.label}</option>`).join('');
  if ([...sc.options].some(o => o.value === cur)) sc.value = cur;
}

// 1セル：棒（色＝統計段階）＋ 群全体の Q1・Q3・平均(縦線)＋中央値(点)
function cellBox(v, st) {
  if (v == null) return '<td><div class="cb empty">—</div></td>';
  const W = 112, H = 20, pad = 5, y = 10;
  const dmax = st.max || 1;
  const X = x => pad + (Math.min(x, dmax) / dmax) * (W - 2 * pad);
  const tier = tierOf(v, st), tc = TIERS[tier].color, over = tier === 4;
  let s = '';
  if (over) {
    s += `<rect x="${X(0)}" y="${y - 6}" width="${(W - 2) - X(0)}" height="12" rx="2" fill="${tc}" fill-opacity="0.9"/>`;
    s += `<polyline points="${W - 16},${y - 6} ${W - 11},${y - 3} ${W - 16},${y} ${W - 11},${y + 3} ${W - 16},${y + 6}" fill="none" stroke="#fff" stroke-width="1.4"/>`;
    s += `<path d="M${W - 10},${y - 4} L${W - 6},${y} L${W - 10},${y + 4}" fill="none" stroke="#fff" stroke-width="1.6"/>`;
    s += `<path d="M${W - 6},${y - 4} L${W - 2},${y} L${W - 6},${y + 4}" fill="none" stroke="#fff" stroke-width="1.6"/>`;
  } else {
    s += `<rect x="${X(0)}" y="${y - 5}" width="${Math.max(0.5, X(v) - X(0))}" height="10" rx="2" fill="${tc}" fill-opacity="${tier >= 2 ? 0.9 : 0.7}"/>`;
  }
  s += `<line x1="${X(st.q1)}" y1="${y - 7}" x2="${X(st.q1)}" y2="${y + 7}" stroke="${STATC.q1}" stroke-width="1.3"/>`;
  s += `<line x1="${X(st.q3)}" y1="${y - 7}" x2="${X(st.q3)}" y2="${y + 7}" stroke="${STATC.q3}" stroke-width="1.3"/>`;
  s += `<line x1="${X(st.mean)}" y1="${y - 7}" x2="${X(st.mean)}" y2="${y + 7}" stroke="${STATC.mean}" stroke-width="1" stroke-dasharray="2,1.5"/>`;
  s += `<circle cx="${X(st.med)}" cy="${y}" r="2.8" fill="${STATC.med}" stroke="#fff" stroke-width="0.9"/>`;
  const svg = `<svg class="cbsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${s}</svg>`;
  return `<td><div class="cb">${svg}<span class="cbval${over ? ' over' : ''}">${fmt(v)}</span></div></td>`;
}

function draw() {
  const grp = document.getElementById('mx-group').value;
  const showAll = document.getElementById('mx-all').checked;
  const topn = parseInt(document.getElementById('mx-topn').value) || 0;
  const dir = document.querySelector('#mx-sort button.on').dataset.v;
  const sortKey = document.getElementById('mx-sortcol').value;
  const cols = COLS.filter(c => mxNuts.includes(c.key));
  const head = document.getElementById('mx-head'), body = document.getElementById('mx-body');
  if (!cols.length) { head.innerHTML = ''; body.innerHTML = '<tr><td class="fcol">栄養素を1つ以上選んでください。</td></tr>'; return; }
  const inGroup = FOODS.filter(f => f.g === grp);
  // 列ごとに統計を算出。極端値を避けるため上位・下位5%を除外した中央90%で計算
  const stat = {};
  cols.forEach(c => {
    let vals = inGroup.map(f => f.v[c.key]).filter(v => v != null).sort((a, b) => a - b);
    const t = Math.floor(vals.length * 0.05);
    if (t > 0) vals = vals.slice(t, vals.length - t);
    stat[c.key] = vals.length ? boxStats(vals) : null;
  });
  // 行（食品）の並べ替え
  let rows = [...inGroup];
  if (sortKey !== '__name') rows.sort((a, b) => {
    const av = a.v[sortKey], bv = b.v[sortKey];
    if (av == null) return 1; if (bv == null) return -1;
    return dir === 'desc' ? bv - av : av - bv;
  });
  if (!showAll && topn > 0) rows = rows.slice(0, topn);
  head.innerHTML = '<tr><th class="fcol">食品名（' + rows.length + '件）</th>' +
    cols.map(c => { const st = stat[c.key]; return `<th>${c.label}<br><span class="u">${c.unit}・${st ? '中央' + fmt(st.med) + '/最大' + fmt(st.max) : '—'}</span></th>`; }).join('') + '</tr>';
  body.innerHTML = rows.map(f => {
    const cells = cols.map(c => { const st = stat[c.key]; if (!st) return '<td><div class="cb empty">—</div></td>'; return cellBox(f.v[c.key], st); }).join('');
    return `<tr><td class="fcol" title="${f.n}">${dispName(f.n)}</td>${cells}</tr>`;
  }).join('');
}

// タブ② 食品プロファイル比較：複数食品を選び、選んだ栄養素を相対比較
import { COLS, FOODS } from '../store.js';
import { fmt, dispName } from '../utils.js';
import { buildNutPicker } from '../nutrientPicker.js';

let chart;
const picked = [];
const pNuts = ['ENERC_KCAL', 'PROT', 'FAT', 'CHOCDF', 'FIB', 'NACL_EQ'];

export function initProfile() {
  buildNutPicker(document.getElementById('p-nuts'), pNuts, draw);
  const s = document.getElementById('p-search'), res = document.getElementById('p-results');
  s.oninput = () => {
    const q = s.value.trim();
    if (!q) { res.style.display = 'none'; return; }
    const m = FOODS.filter(f => f.n.includes(q)).slice(0, 40);
    res.innerHTML = m.map(f => `<div data-no="${f.no}">${dispName(f.n)}　<span style="color:#9aa">【${f.g}】</span></div>`).join('') || '<div style="color:#9aa">該当なし</div>';
    res.style.display = 'block';
    res.querySelectorAll('div[data-no]').forEach(d => d.onclick = () => {
      const f = FOODS.find(x => x.no === d.dataset.no);
      if (f && !picked.some(p => p.no === f.no)) { picked.push(f); renderChips(); draw(); }
      res.style.display = 'none'; s.value = '';
    });
  };
  ['白米', '牛乳', '鶏卵'].forEach(q => { const f = FOODS.find(x => x.n.includes(q)); if (f) picked.push(f); });
  renderChips(); draw();
}

function renderChips() {
  document.getElementById('p-chips').innerHTML = picked.map(f =>
    `<span class="chip">${dispName(f.n)}<button data-no="${f.no}">×</button></span>`).join('');
  document.querySelectorAll('#p-chips button').forEach(b => b.onclick = () => {
    const i = picked.findIndex(p => p.no === b.dataset.no); if (i >= 0) picked.splice(i, 1); renderChips(); draw();
  });
}

function draw() {
  const cv = document.getElementById('p-chart');
  if (chart) chart.destroy();
  if (!picked.length || !pNuts.length) { cv.parentElement.style.height = '80px'; return; }
  const nuts = COLS.filter(c => pNuts.includes(c.key));
  // 正規化は「いま選択中の食品の中での最大値」を100%とする
  const maxByNut = {}; nuts.forEach(c => { maxByNut[c.key] = Math.max(...picked.map(f => f.v[c.key] || 0), 0) || 1; });
  const palette = ['#2f7d6e', '#c8623c', '#6a8caf', '#d8a23a', '#7a5ea8', '#3f9b86', '#d2687f', '#5a9bd4'];
  const datasets = picked.map((f, i) => ({
    label: dispName(f.n),
    data: nuts.map(c => f.v[c.key] != null ? (f.v[c.key] / maxByNut[c.key] * 100) : 0),
    raw: nuts.map(c => f.v[c.key]),
    backgroundColor: palette[i % palette.length], borderRadius: 3,
  }));
  cv.parentElement.style.height = Math.max(300, nuts.length * Math.max(38, picked.length * 16)) + 'px';
  chart = new Chart(cv, {
    type: 'bar',
    data: { labels: nuts.map(c => c.label), datasets },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        tooltip: { callbacks: { label: i => { const c = nuts[i.dataIndex]; return `${i.dataset.label}: ${fmt(i.dataset.raw[i.dataIndex])} ${c.unit}（選択中の最大比${i.raw.toFixed(0)}%）`; } } },
      },
      scales: { x: { title: { display: true, text: '選択した食品の中の最大値=100%とした相対値' }, max: 100, grid: { color: '#eef2f4' } }, y: { ticks: { font: { size: 11 }, autoSkip: false } } },
    },
  });
}

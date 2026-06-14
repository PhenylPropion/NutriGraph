// タブ① 栄養素ランキング：1栄養素で全食品（または群）を多い/少ない順に比較
import { COLS, FOODS, GROUPS, colByKey, CATCOLORS } from '../store.js';
import { fmt, dispName } from '../utils.js';

let chart;

export function initRanking() {
  const sel = document.getElementById('r-nut');
  let cat = '';
  COLS.forEach(c => {
    if (c.cat !== cat) { cat = c.cat; const og = document.createElement('optgroup'); og.label = cat; og.id = 'og-' + cat; sel.appendChild(og); }
    const o = document.createElement('option'); o.value = c.key; o.textContent = c.label + '（' + c.unit + '）';
    document.getElementById('og-' + cat).appendChild(o);
  });
  sel.value = 'ENERC_KCAL';
  const g = document.getElementById('r-group');
  g.innerHTML = '<option value="">すべての食品群</option>' + GROUPS.map(x => `<option>${x}</option>`).join('');
  sel.onchange = g.onchange = draw;
  document.getElementById('r-topn').oninput = draw;
  document.getElementById('r-all').onchange = function () { document.getElementById('r-topn').disabled = this.checked; draw(); };
  document.getElementById('r-search').oninput = draw;
  document.querySelectorAll('#r-sort button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#r-sort button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); draw();
  });
  draw();
}

function draw() {
  const key = document.getElementById('r-nut').value;
  const grp = document.getElementById('r-group').value;
  const showAll = document.getElementById('r-all').checked;
  const topn = parseInt(document.getElementById('r-topn').value) || 0;
  const dir = document.querySelector('#r-sort button.on').dataset.v;
  const q = document.getElementById('r-search').value.trim();
  const col = colByKey[key];
  let rows = FOODS.filter(f => f.v[key] != null);
  if (grp) rows = rows.filter(f => f.g === grp);
  if (q) rows = rows.filter(f => f.n.includes(q));
  rows.sort((a, b) => dir === 'desc' ? b.v[key] - a.v[key] : a.v[key] - b.v[key]);
  if (!showAll && topn > 0) rows = rows.slice(0, topn);
  const labels = rows.map(f => { const d = dispName(f.n); return d.length > 22 ? d.slice(0, 22) + '…' : d; });
  const vals = rows.map(f => f.v[key]);
  const colors = rows.map(() => CATCOLORS[col.cat] || '#2f7d6e');
  const cv = document.getElementById('r-chart');
  cv.parentElement.style.height = Math.max(260, rows.length * 22 + 60) + 'px';
  if (chart) chart.destroy();
  chart = new Chart(cv, {
    type: 'bar',
    data: { labels, datasets: [{ label: col.label + '（' + col.unit + '）', data: vals, backgroundColor: colors, borderRadius: 3 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          title: i => dispName(rows[i[0].dataIndex].n),
          label: i => `${col.label}: ${fmt(i.raw)} ${col.unit}　【${rows[i.dataIndex].g}】`,
        } },
      },
      scales: { x: { title: { display: true, text: col.unit }, grid: { color: '#eef2f4' } }, y: { ticks: { font: { size: 11 }, autoSkip: false } } },
    },
  });
  document.getElementById('r-note').textContent = `「${col.label}」が${dir === 'desc' ? '多い' : '少ない'}食品 ${rows.length}件${grp ? '（' + grp + '）' : '（全食品群）'}`;
  document.getElementById('r-meta').textContent = `対象：データのある${FOODS.filter(f => f.v[key] != null && (!grp || f.g === grp)).length}食品中の上位${rows.length}件　／　単位：${col.unit}（可食部100gあたり）`;
}

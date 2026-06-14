// タブ③ 食品群の中で全食品を比較：群を選び、栄養素ごとに棒グラフを横並び
import { COLS, FOODS, GROUPS, CATCOLORS } from '../store.js';
import { fmt, niceMax, dispName } from '../utils.js';
import { buildNutPicker } from '../nutrientPicker.js';

const gpNuts = ['ENERC_KCAL', 'PROT', 'FAT', 'CHOCDF', 'FIB', 'NACL_EQ'];
const charts = [];

export function initGroups() {
  const g = document.getElementById('gp-group');
  g.innerHTML = GROUPS.map(x => `<option>${x}</option>`).join('');
  g.value = '穀類';
  buildNutPicker(document.getElementById('gp-nuts'), gpNuts, draw);
  g.onchange = draw;
  document.getElementById('gp-topn').oninput = draw;
  document.getElementById('gp-all').onchange = function () { document.getElementById('gp-topn').disabled = this.checked; draw(); };
  document.querySelectorAll('#gp-sort button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#gp-sort button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); draw();
  });
  draw();
}

function draw() {
  const grp = document.getElementById('gp-group').value;
  const showAll = document.getElementById('gp-all').checked;
  const topn = parseInt(document.getElementById('gp-topn').value) || 0;
  const dir = document.querySelector('#gp-sort button.on').dataset.v;
  const wrap = document.getElementById('gp-charts');
  charts.forEach(c => c.destroy()); charts.length = 0; wrap.innerHTML = '';
  if (!gpNuts.length) { wrap.innerHTML = '<p class="hint">栄養素を1つ以上選んでください。</p>'; return; }
  const inGroup = FOODS.filter(f => f.g === grp);
  const order = COLS.filter(c => gpNuts.includes(c.key));
  order.forEach(col => {
    let rows = inGroup.filter(f => f.v[col.key] != null)
      .sort((a, b) => dir === 'desc' ? b.v[col.key] - a.v[col.key] : a.v[col.key] - b.v[col.key]);
    if (!showAll && topn > 0) rows = rows.slice(0, topn);
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<h3>${col.label}<span style="color:#9aa;font-weight:400">（${col.unit}）</span></h3><div class="cc"><canvas></canvas></div>`;
    wrap.appendChild(card);
    card.querySelector('.cc').style.height = Math.max(220, rows.length * 18 + 56) + 'px';
    const mx = niceMax(Math.max(...rows.map(f => f.v[col.key]), 0));
    const ch = new Chart(card.querySelector('canvas'), {
      type: 'bar',
      data: {
        labels: rows.map(f => { const d = dispName(f.n); return d.length > 26 ? d.slice(0, 26) + '…' : d; }),
        datasets: [{ data: rows.map(f => f.v[col.key]), backgroundColor: CATCOLORS[col.cat] || '#2f7d6e', borderRadius: 2 }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: i => dispName(rows[i[0].dataIndex].n), label: i => `${col.label}: ${fmt(i.raw)} ${col.unit}` } },
        },
        scales: {
          x: { position: 'bottom', min: 0, max: mx, grid: { color: '#eef2f4' }, title: { display: true, text: col.unit } },
          x2: { position: 'top', min: 0, max: mx, grid: { drawOnChartArea: false }, title: { display: true, text: col.unit } },
          y: { ticks: { font: { size: 10 }, autoSkip: false } },
        },
      },
    });
    charts.push(ch);
  });
}

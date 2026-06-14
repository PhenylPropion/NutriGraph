// エントリーポイント：データ読み込み → 各タブ初期化 → タブ切替
import { loadData } from './store.js';
import { initRanking } from './tabs/ranking.js';
import { initProfile } from './tabs/profile.js';
import { initGroups } from './tabs/groups.js';
import { initMatrix } from './tabs/matrix.js';

const TABS = { rank: 'tab-rank', profile: 'tab-profile', groups: 'tab-groups', matrix: 'tab-matrix' };

function setupTabs() {
  document.querySelectorAll('.tab[data-tab]').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab[data-tab]').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    Object.entries(TABS).forEach(([k, id]) => { document.getElementById(id).hidden = t.dataset.tab !== k; });
  });
}

// Chart.js（CDN・defer）が読み込まれるまで待つ
function whenChartReady() {
  return new Promise(resolve => {
    if (window.Chart) return resolve();
    const t = setInterval(() => { if (window.Chart) { clearInterval(t); resolve(); } }, 30);
  });
}

async function boot() {
  const status = document.getElementById('status');
  try {
    await Promise.all([loadData(), whenChartReady()]);
    initRanking();
    initProfile();
    initGroups();
    initMatrix();
    setupTabs();
    status.hidden = true;
    document.getElementById('tab-rank').hidden = false;
  } catch (e) {
    console.error(e);
    status.textContent = '読み込みに失敗しました：' + e.message;
  }
}

document.addEventListener('DOMContentLoaded', boot);

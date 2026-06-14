// エントリーポイント：データ読み込み → 各タブ初期化 → タブ切替
import { loadData } from './store.js';
import { initRanking } from './tabs/ranking.js';
import { initProfile } from './tabs/profile.js';
import { initGroups } from './tabs/groups.js';
import { initMatrix } from './tabs/matrix.js';

const TABS = { rank: 'tab-rank', profile: 'tab-profile', groups: 'tab-groups', matrix: 'tab-matrix' };

function setupTabs() {
  const tabs = [...document.querySelectorAll('.tab[data-tab]')];
  const activate = t => {
    tabs.forEach(x => { const on = x === t; x.classList.toggle('active', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
    Object.entries(TABS).forEach(([k, id]) => { document.getElementById(id).hidden = t.dataset.tab !== k; });
  };
  tabs.forEach((t, i) => {
    t.onclick = () => activate(t);
    // 左右矢印キーでタブ移動（アクセシビリティ）
    t.onkeydown = e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      tabs[n].focus(); activate(tabs[n]);
    };
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

// 共通の栄養素ピッカー：カテゴリ別表示・カテゴリ一括・プリセットボタン
import { COLS, CATS, CATCOLORS } from './store.js';

// 充実したプリセット（グループ系は追加選択、全選択/全解除のみ置換）
const PRESETS = [
  { label: '全選択', type: 'all', hint: '全53項目を選択' },
  { label: '全解除', type: 'none', hint: 'すべて解除' },
  { label: '主要栄養素', keys: ['ENERC_KCAL', 'PROT', 'FAT', 'CHOCDF', 'FIB', 'NACL_EQ'], hint: 'エネルギー・たんぱく質・脂質・炭水化物・食物繊維・食塩' },
  { label: 'エネルギー', keys: ['ENERC_KCAL'], hint: 'エネルギー(kcal)' },
  { label: '三大栄養素', keys: ['PROT', 'FAT', 'CHOCDF'], hint: 'たんぱく質・脂質・炭水化物' },
  { label: 'ミネラル', cat: '無機質', hint: '無機質すべて' },
  { label: '主要ミネラル', keys: ['NA', 'K', 'CA', 'MG', 'P', 'FE', 'ZN'], hint: 'ナトリウム・カリウム・カルシウム・マグネシウム・リン・鉄・亜鉛' },
  { label: 'ビタミン', cat: 'ビタミン', hint: 'ビタミンすべて' },
  { label: '主要ビタミン', keys: ['VITA_RAE', 'VITD', 'TOCPHA', 'VITK', 'THIA', 'RIBF', 'NIA', 'VITB6A', 'VITB12', 'FOL', 'VITC'], hint: 'A・D・E・K・B群・C' },
  { label: '脂質くわしく', cat: '脂質', hint: '脂質関連すべて' },
  { label: '炭水化物くわしく', cat: '炭水化物', hint: '炭水化物関連すべて' },
];

/**
 * @param {HTMLElement} container マウント先
 * @param {string[]} selected 選択中キーの配列（破壊的に更新される）
 * @param {Function} onChange 変更時コールバック
 */
export function buildNutPicker(container, selected, onChange) {
  container.className = 'nutpicker';
  container.innerHTML = '';
  const heads = {};
  const setSel = (k, on) => { const i = selected.indexOf(k); if (on && i < 0) selected.push(k); if (!on && i >= 0) selected.splice(i, 1); };
  const add = keys => keys.forEach(k => { if (!selected.includes(k)) selected.push(k); });
  const updateHeads = () => {
    CATS.forEach(cat => {
      const ins = [...heads[cat].items.querySelectorAll('input')];
      const on = ins.filter(i => i.checked).length;
      heads[cat].box.checked = on === ins.length;
      heads[cat].box.indeterminate = on > 0 && on < ins.length;
      heads[cat].cnt.textContent = on + '/' + ins.length;
    });
  };
  const syncAll = () => { container.querySelectorAll('.catitems input').forEach(i => i.checked = selected.includes(i.value)); updateHeads(); };

  // toolbar
  const tb = document.createElement('div'); tb.className = 'toolbar';
  PRESETS.forEach(p => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'pbtn' + (p.type === 'all' ? ' solid' : ''); b.textContent = p.label; b.title = p.hint || '';
    b.onclick = () => {
      if (p.type === 'all') { selected.length = 0; COLS.forEach(c => selected.push(c.key)); }
      else if (p.type === 'none') { selected.length = 0; }
      else if (p.cat) { add(COLS.filter(c => c.cat === p.cat).map(c => c.key)); }
      else { add(p.keys); }
      syncAll(); onChange();
    };
    tb.appendChild(b);
  });
  const note = document.createElement('span');
  note.className = 'selcount'; note.style.cssText = 'align-self:center;margin-left:4px';
  note.textContent = '（グループは追加選択。リセットは「全解除」）';
  tb.appendChild(note);
  container.appendChild(tb);

  // category sections
  CATS.forEach(cat => {
    const sec = document.createElement('div'); sec.className = 'catsec';
    const head = document.createElement('div'); head.className = 'cathead';
    head.innerHTML = `<input type="checkbox"><span class="catcolor" style="background:${CATCOLORS[cat]}"></span>${cat}<span class="selcount"></span>`;
    const items = document.createElement('div'); items.className = 'catitems';
    COLS.filter(c => c.cat === cat).forEach(c => {
      const lab = document.createElement('label');
      lab.innerHTML = `<input type="checkbox" value="${c.key}" ${selected.includes(c.key) ? 'checked' : ''}>${c.label}<span>（${c.unit}）</span>`;
      lab.querySelector('input').onchange = function () { setSel(this.value, this.checked); updateHeads(); onChange(); };
      items.appendChild(lab);
    });
    const hb = head.querySelector('input');
    hb.onchange = () => { items.querySelectorAll('input').forEach(i => { i.checked = hb.checked; setSel(i.value, hb.checked); }); updateHeads(); onChange(); };
    sec.appendChild(head); sec.appendChild(items); container.appendChild(sec);
    heads[cat] = { box: hb, items, cnt: head.querySelector('.selcount') };
  });
  updateHeads();
}

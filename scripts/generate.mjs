// 静的SEOページ生成スクリプト（プログラマティックSEO）
// data.json から 食品ページ / 栄養素ランキング / 食品群ページ / ハブ / sitemap を生成する。
//   実行: node scripts/generate.mjs
// 生成物はコミット対象。配信時のビルドは不要（静的HTML）。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://nutri-graph.vercel.app';
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
const { columns: COLS, foods: FOODS, groups: GROUPS } = data;
const colByKey = Object.fromEntries(COLS.map(c => [c.key, c]));
const CATS = [...new Set(COLS.map(c => c.cat))];

// ---- helpers ----
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dispName = n => n.replace(/[（(][^（）()]*[）)]/g, '').replace(/\s+/g, ' ').trim() || n;
const fmt = n => n == null ? '—' : (Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.0+$/, '');
const slugNut = k => k.toLowerCase();
const groupId = g => String(GROUPS.indexOf(g) + 1).padStart(2, '0');
function quantile(s, q) { const p = (s.length - 1) * q, b = Math.floor(p), r = p - b; return s[b + 1] !== undefined ? s[b] + r * (s[b + 1] - s[b]) : s[b]; }

// 群×栄養素の統計（上位下位5%除外）をキャッシュ
const groupStat = {};
for (const g of GROUPS) {
  groupStat[g] = {};
  const inG = FOODS.filter(f => f.g === g);
  for (const c of COLS) {
    let vals = inG.map(f => f.v[c.key]).filter(v => v != null).sort((a, b) => a - b);
    const t = Math.floor(vals.length * 0.05);
    if (t > 0) vals = vals.slice(t, vals.length - t);
    groupStat[g][c.key] = vals.length ? { q3: quantile(vals, .75), med: quantile(vals, .5), max: vals[vals.length - 1] } : null;
  }
}

const KEY = { ENERC_KCAL: 'エネルギー', PROT: 'たんぱく質', FAT: '脂質', CHOCDF: '炭水化物', FIB: '食物繊維総量', NACL_EQ: '食塩相当量' };
const HEADKEYS = ['ENERC_KCAL', 'PROT', 'FAT', 'CHOCDF', 'FIB', 'NACL_EQ'];

function page({ title, desc, canonical, body, jsonld, breadcrumb }) {
  const ld = [];
  if (breadcrumb) ld.push({
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumb.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: b.name, item: SITE + b.url })),
  });
  if (jsonld) ld.push(jsonld);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#2f7d6e">
<link rel="canonical" href="${SITE}${canonical}">
<meta property="og:type" content="article">
<meta property="og:locale" content="ja_JP">
<meta property="og:site_name" content="NutriGraph">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${canonical}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%232f7d6e'/%3E%3Crect x='22' y='52' width='13' height='26' fill='%23fff'/%3E%3Crect x='43' y='34' width='13' height='44' fill='%23fff'/%3E%3Crect x='64' y='22' width='13' height='56' fill='%23fff'/%3E%3C/svg%3E">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/styles.css">
${ld.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld })}</script>` : ''}
</head>
<body>
<header><h1 style="font-size:18px">NutriGraph｜日本食品標準成分表(八訂) 栄養素データベース</h1></header>
<article class="article">
${body}
<div class="pagefoot">
  出典：<a href="https://fooddb.mext.go.jp/" rel="noopener" target="_blank">文部科学省 食品成分データベース</a>（日本食品標準成分表2020年版〔八訂〕）。数値は可食部100gあたり。
  ｜<a href="/">インタラクティブ版 NutriGraph</a>
</div>
</article>
</body>
</html>`;
}

function write(rel, html) {
  const fp = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, html);
}

const urls = [{ loc: '/', pri: '1.0' }];

// ---------- 食品ページ ----------
for (const f of FOODS) {
  const name = dispName(f.n);
  const url = `/foods/${f.no}`;
  const head = HEADKEYS.filter(k => f.v[k] != null).map(k => `${KEY[k]}${fmt(f.v[k])}${colByKey[k].unit}`).join('・');
  // この食品が群の中で豊富な栄養素（≥Q3）
  const rich = COLS.filter(c => { const st = groupStat[f.g][c.key]; return st && f.v[c.key] != null && f.v[c.key] >= st.q3 && st.max > 0; })
    .sort((a, b) => (f.v[b.key] / (groupStat[f.g][b.key].max || 1)) - (f.v[a.key] / (groupStat[f.g][a.key].max || 1)));
  const richPills = rich.slice(0, 12).map(c => `<a class="pill" href="/nutrients/${slugNut(c.key)}">${esc(c.label)}</a>`).join('');
  // 全成分テーブル（カテゴリ別）
  let rows = '';
  for (const cat of CATS) {
    rows += `<tr class="catrow"><th colspan="2">${esc(cat)}</th></tr>`;
    for (const c of COLS.filter(x => x.cat === cat)) {
      rows += `<tr><td>${esc(c.label)}</td><td class="num">${fmt(f.v[c.key])} ${esc(c.unit)}</td></tr>`;
    }
  }
  const siblings = FOODS.filter(x => x.g === f.g && x.no !== f.no).slice(0, 16)
    .map(x => `<a href="/foods/${x.no}">${esc(dispName(x.n))}</a>`).join('');
  const body = `
<nav class="crumbs"><a href="/">ホーム</a> › <a href="/groups/${groupId(f.g)}">${esc(f.g)}</a> › ${esc(name)}</nav>
<h1>${esc(name)}の栄養成分（可食部100gあたり）</h1>
<p class="lead">${esc(name)}（食品群：${esc(f.g)}／食品番号 ${f.no}）の栄養成分です。${head ? esc(head) + '。' : ''}日本食品標準成分表2020年版（八訂）にもとづく全53項目の数値を掲載しています。</p>
${rich.length ? `<h2>${esc(name)}に豊富な栄養素</h2><p>同じ「${esc(f.g)}」の中で比較すると、次の栄養素が上位（第3四分位以上）です。クリックでランキングを表示します。</p><p>${richPills}</p>` : ''}
<h2>栄養成分表（全53項目）</h2>
<table class="data"><thead><tr><th>栄養素</th><th class="num">含有量（100gあたり）</th></tr></thead><tbody>${rows}</tbody></table>
<a class="toapp" href="/">▶ ほかの食品とグラフで比較する（NutriGraph）</a>
<h2>同じ食品群（${esc(f.g)}）の食品</h2>
<p>${siblings} … <a href="/groups/${groupId(f.g)}">${esc(f.g)}の一覧をすべて見る</a></p>`;
  const desc = `${name}の栄養成分（可食部100gあたり）。${head}。日本食品標準成分表2020年版(八訂)にもとづく全53栄養素の含有量一覧。`;
  write(`foods/${f.no}.html`, page({
    title: `${name}の栄養成分・カロリー｜日本食品標準成分表(八訂)`,
    desc, canonical: url, body,
    breadcrumb: [{ name: 'ホーム', url: '/' }, { name: f.g, url: `/groups/${groupId(f.g)}` }, { name: name, url }],
  }));
  urls.push({ loc: url, pri: '0.5' });
}

// ---------- 栄養素ランキングページ ----------
for (const c of COLS) {
  const url = `/nutrients/${slugNut(c.key)}`;
  const withV = FOODS.filter(f => f.v[c.key] != null);
  const top = [...withV].sort((a, b) => b.v[c.key] - a.v[c.key]).slice(0, 50);
  const low = [...withV].filter(f => f.v[c.key] > 0).sort((a, b) => a.v[c.key] - b.v[c.key]).slice(0, 20);
  const tr = arr => arr.map((f, i) => `<tr><td class="num">${i + 1}</td><td><a href="/foods/${f.no}">${esc(dispName(f.n))}</a></td><td>${esc(f.g)}</td><td class="num">${fmt(f.v[c.key])} ${esc(c.unit)}</td></tr>`).join('');
  const top3 = top.slice(0, 3).map(f => `${dispName(f.n)}（${fmt(f.v[c.key])}${c.unit}）`).join('、');
  const body = `
<nav class="crumbs"><a href="/">ホーム</a> › <a href="/nutrients/">栄養素から探す</a> › ${esc(c.label)}</nav>
<h1>${esc(c.label)}が多い食品ランキング【日本食品標準成分表 八訂】</h1>
<p class="lead">${esc(c.label)}（単位：${esc(c.unit)}／可食部100gあたり）を多く含む食品のランキングです。全2,538食品のうちデータのある${withV.length}食品から集計しました。最も多いのは${esc(top3)}。</p>
<h2>${esc(c.label)}が多い食品 トップ50</h2>
<table class="rank"><thead><tr><th class="num">順位</th><th>食品名</th><th>食品群</th><th class="num">${esc(c.label)}</th></tr></thead><tbody>${tr(top)}</tbody></table>
<h2>${esc(c.label)}が少ない食品（0を除く）トップ20</h2>
<table class="rank"><thead><tr><th class="num">順位</th><th>食品名</th><th>食品群</th><th class="num">${esc(c.label)}</th></tr></thead><tbody>${tr(low)}</tbody></table>
<a class="toapp" href="/">▶ NutriGraphで全食品・全栄養素をグラフ比較する</a>
<h2>ほかの栄養素ランキング</h2>
<p>${COLS.filter(x => x.key !== c.key).map(x => `<a class="pill" href="/nutrients/${slugNut(x.key)}">${esc(x.label)}</a>`).join('')}</p>`;
  const desc = `${c.label}が多い食品ランキング（可食部100gあたり）。1位は${top3 || '—'}。日本食品標準成分表2020年版(八訂)の全食品データから集計。`;
  write(`nutrients/${slugNut(c.key)}.html`, page({
    title: `${c.label}が多い食品ランキング｜日本食品標準成分表(八訂)`,
    desc, canonical: url, body,
    breadcrumb: [{ name: 'ホーム', url: '/' }, { name: '栄養素から探す', url: '/nutrients/' }, { name: c.label, url }],
  }));
  urls.push({ loc: url, pri: '0.8' });
}

// ---------- 食品群ページ ----------
for (const g of GROUPS) {
  const url = `/groups/${groupId(g)}`;
  const inG = FOODS.filter(f => f.g === g);
  const tr = inG.map(f => `<tr><td><a href="/foods/${f.no}">${esc(dispName(f.n))}</a></td>${HEADKEYS.slice(0, 4).map(k => `<td class="num">${fmt(f.v[k])}</td>`).join('')}</tr>`).join('');
  const body = `
<nav class="crumbs"><a href="/">ホーム</a> › <a href="/groups/">食品群から探す</a> › ${esc(g)}</nav>
<h1>${esc(g)}の栄養成分一覧【日本食品標準成分表 八訂】</h1>
<p class="lead">食品群「${esc(g)}」に分類される全${inG.length}食品の主要栄養成分（可食部100gあたり）の一覧です。各食品名をクリックすると全53栄養素の詳細を表示します。</p>
<h2>${esc(g)}の食品一覧（${inG.length}件）</h2>
<table class="rank"><thead><tr><th>食品名</th><th class="num">エネルギー(kcal)</th><th class="num">たんぱく質(g)</th><th class="num">脂質(g)</th><th class="num">炭水化物(g)</th></tr></thead><tbody>${tr}</tbody></table>
<a class="toapp" href="/">▶ ${esc(g)}をグラフで比較する（NutriGraph）</a>
<h2>ほかの食品群</h2>
<p>${GROUPS.filter(x => x !== g).map(x => `<a class="pill" href="/groups/${groupId(x)}">${esc(x)}</a>`).join('')}</p>`;
  const desc = `${g}の栄養成分一覧（全${inG.length}食品）。カロリー・たんぱく質・脂質・炭水化物などを可食部100gあたりで比較。日本食品標準成分表2020年版(八訂)。`;
  write(`groups/${groupId(g)}.html`, page({
    title: `${g}の栄養成分一覧｜日本食品標準成分表(八訂)`,
    desc, canonical: url, body,
    breadcrumb: [{ name: 'ホーム', url: '/' }, { name: '食品群から探す', url: '/groups/' }, { name: g, url }],
  }));
  urls.push({ loc: url, pri: '0.7' });
}

// ---------- ハブページ ----------
write('nutrients/index.html', page({
  title: '栄養素から食品を探す｜全53栄養素ランキング｜NutriGraph',
  desc: 'カロリー・たんぱく質・脂質・炭水化物・ビタミン・ミネラルなど全53栄養素について、多く含む食品ランキングを一覧。日本食品標準成分表2020年版(八訂)。',
  canonical: '/nutrients/',
  breadcrumb: [{ name: 'ホーム', url: '/' }, { name: '栄養素から探す', url: '/nutrients/' }],
  body: `<nav class="crumbs"><a href="/">ホーム</a> › 栄養素から探す</nav>
<h1>栄養素から食品を探す（全53栄養素ランキング）</h1>
<p class="lead">気になる栄養素を選ぶと、その栄養素を多く含む食品のランキングを確認できます。</p>
${CATS.map(cat => `<h2>${esc(cat)}</h2><div class="linklist">${COLS.filter(c => c.cat === cat).map(c => `<a href="/nutrients/${slugNut(c.key)}">${esc(c.label)}が多い食品</a>`).join('')}</div>`).join('')}
<a class="toapp" href="/">▶ インタラクティブ版で比較する</a>`,
}));
urls.push({ loc: '/nutrients/', pri: '0.8' });

write('groups/index.html', page({
  title: '食品群から探す｜18分類の栄養成分一覧｜NutriGraph',
  desc: '穀類・野菜類・魚介類・肉類など18の食品群ごとに、収載食品と栄養成分の一覧を掲載。日本食品標準成分表2020年版(八訂)。',
  canonical: '/groups/',
  breadcrumb: [{ name: 'ホーム', url: '/' }, { name: '食品群から探す', url: '/groups/' }],
  body: `<nav class="crumbs"><a href="/">ホーム</a> › 食品群から探す</nav>
<h1>食品群から探す（18分類）</h1>
<p class="lead">食品群を選ぶと、その群に含まれる全食品の栄養成分一覧を確認できます。</p>
<div class="linklist">${GROUPS.map(g => `<a href="/groups/${groupId(g)}">${esc(g)}（${FOODS.filter(f => f.g === g).length}件）</a>`).join('')}</div>
<a class="toapp" href="/">▶ インタラクティブ版で比較する</a>`,
}));
urls.push({ loc: '/groups/', pri: '0.8' });

// ---------- 特集（コレクション）ページ：複数栄養素の組み合わせ ----------
const kcal = f => f.v.ENERC_KCAL, has = (f, k) => f.v[k] != null;
const THEMES = [
  { slug: 'high-protein-low-calorie', name: '高たんぱく・低カロリーな食品', lead: 'ダイエットや筋トレ中のたんぱく質補給に。エネルギーあたりのたんぱく質量（たんぱく質g / 100kcal）が多い順。',
    show: ['PROT', 'ENERC_KCAL', 'FAT'], metric: 'たんぱく質/100kcal', munit: 'g',
    filter: f => has(f, 'PROT') && kcal(f) > 20 && f.v.PROT >= 8, score: f => f.v.PROT / kcal(f) * 100 },
  { slug: 'high-protein-low-fat', name: '高たんぱく・低脂質な食品', lead: 'たんぱく質が多く脂質が少ない食品。引き締めたい時の食事選びに。',
    show: ['PROT', 'FAT', 'ENERC_KCAL'], metric: 'たんぱく質−2×脂質', munit: '',
    filter: f => has(f, 'PROT') && has(f, 'FAT') && f.v.PROT >= 10, score: f => f.v.PROT - 2 * f.v.FAT },
  { slug: 'high-protein-low-carb', name: '高たんぱく・低糖質な食品', lead: 'たんぱく質が多く炭水化物が少ない食品。低糖質（ロカボ）志向の方に。',
    show: ['PROT', 'CHOCDF', 'ENERC_KCAL'], metric: 'たんぱく質−炭水化物', munit: '',
    filter: f => has(f, 'PROT') && has(f, 'CHOCDF') && f.v.PROT >= 10, score: f => f.v.PROT - f.v.CHOCDF },
  { slug: 'low-calorie', name: '低カロリーな食品', lead: 'エネルギー（kcal）が低い食品。かさ増しやダイエットの献立づくりに。',
    show: ['ENERC_KCAL', 'PROT', 'FIB'], metric: 'エネルギー', munit: 'kcal',
    filter: f => has(f, 'ENERC_KCAL'), score: f => -kcal(f) },
  { slug: 'low-carb', name: '低糖質・低炭水化物な食品', lead: '炭水化物が少ない食品。糖質制限の食事選びに。',
    show: ['CHOCDF', 'PROT', 'FAT'], metric: '炭水化物', munit: 'g',
    filter: f => has(f, 'CHOCDF') && kcal(f) > 20, score: f => -f.v.CHOCDF },
  { slug: 'high-fiber-low-calorie', name: '高食物繊維・低カロリーな食品', lead: '腸活・便通対策に。エネルギーあたりの食物繊維（g / 100kcal）が多い順。',
    show: ['FIB', 'ENERC_KCAL', 'CHOCDF'], metric: '食物繊維/100kcal', munit: 'g',
    filter: f => has(f, 'FIB') && f.v.FIB >= 3 && kcal(f) > 10, score: f => f.v.FIB / kcal(f) * 100 },
  { slug: 'iron-rich-low-calorie', name: '鉄分が豊富で低カロリーな食品', lead: '貧血が気になる方に。エネルギーあたりの鉄（mg / 100kcal）が多い順。',
    show: ['FE', 'ENERC_KCAL', 'PROT'], metric: '鉄/100kcal', munit: 'mg',
    filter: f => has(f, 'FE') && f.v.FE >= 1 && kcal(f) > 10, score: f => f.v.FE / kcal(f) * 100 },
  { slug: 'calcium-rich-low-calorie', name: 'カルシウムが豊富で低カロリーな食品', lead: '骨の健康に。エネルギーあたりのカルシウム（mg / 100kcal）が多い順。',
    show: ['CA', 'ENERC_KCAL', 'PROT'], metric: 'カルシウム/100kcal', munit: 'mg',
    filter: f => has(f, 'CA') && f.v.CA >= 30 && kcal(f) > 10, score: f => f.v.CA / kcal(f) * 100 },
];
for (const t of THEMES) {
  const url = `/collections/${t.slug}`;
  const ranked = FOODS.filter(t.filter).sort((a, b) => t.score(b) - t.score(a)).slice(0, 50);
  const cols = t.show.map(k => colByKey[k]);
  const rows = ranked.map((f, i) => `<tr><td class="num">${i + 1}</td><td><a href="/foods/${f.no}">${esc(dispName(f.n))}</a></td><td>${esc(f.g)}</td>${cols.map(c => `<td class="num">${fmt(f.v[c.key])} ${esc(c.unit)}</td>`).join('')}<td class="num">${fmt(t.score(ranked[i]) )}${t.munit ? ' ' + t.munit : ''}</td></tr>`).join('');
  const top3 = ranked.slice(0, 3).map(f => dispName(f.n)).join('、');
  const body = `
<nav class="crumbs"><a href="/">ホーム</a> › <a href="/collections/">特集から探す</a> › ${esc(t.name)}</nav>
<h1>${esc(t.name)}ランキング【日本食品標準成分表 八訂】</h1>
<p class="lead">${esc(t.lead)}（可食部100gあたり）。上位は${esc(top3)}など。</p>
<h2>ランキング トップ50</h2>
<table class="rank"><thead><tr><th class="num">順位</th><th>食品名</th><th>食品群</th>${cols.map(c => `<th class="num">${esc(c.label)}</th>`).join('')}<th class="num">${esc(t.metric)}</th></tr></thead><tbody>${rows}</tbody></table>
<a class="toapp" href="/">▶ NutriGraphで自分の条件でグラフ比較する</a>
<h2>ほかの特集</h2>
<p>${THEMES.filter(x => x.slug !== t.slug).map(x => `<a class="pill" href="/collections/${x.slug}">${esc(x.name)}</a>`).join('')}</p>`;
  write(`collections/${t.slug}.html`, page({
    title: `${t.name}ランキング｜日本食品標準成分表(八訂)`,
    desc: `${t.name}ランキング（可食部100gあたり）。上位は${top3}など。日本食品標準成分表2020年版(八訂)のデータから集計。`,
    canonical: url, body,
    breadcrumb: [{ name: 'ホーム', url: '/' }, { name: '特集から探す', url: '/collections/' }, { name: t.name, url }],
  }));
  urls.push({ loc: url, pri: '0.8' });
}
write('collections/index.html', page({
  title: '目的から探す｜高たんぱく・低カロリーなど食品特集｜NutriGraph',
  desc: '高たんぱく・低カロリー、低糖質、高食物繊維、鉄分・カルシウムが豊富な食品など、目的別の食品ランキング特集。日本食品標準成分表2020年版(八訂)。',
  canonical: '/collections/',
  breadcrumb: [{ name: 'ホーム', url: '/' }, { name: '特集から探す', url: '/collections/' }],
  body: `<nav class="crumbs"><a href="/">ホーム</a> › 特集から探す</nav>
<h1>目的から食品を探す（特集）</h1>
<p class="lead">ダイエット・筋トレ・健康管理など、目的に合わせた食品ランキングです。</p>
<div class="linklist">${THEMES.map(t => `<a href="/collections/${t.slug}">${esc(t.name)}</a>`).join('')}</div>
<a class="toapp" href="/">▶ インタラクティブ版で比較する</a>`,
}));
urls.push({ loc: '/collections/', pri: '0.8' });

// ---------- 比較ページ /compare（人気食品どうし） ----------
const PICKS = [
  ['水稲めし','精白米','うるち米'],['水稲めし','玄米'],['食パン'],['うどん','ゆで'],['そば','ゆで'],['マカロニ・スパゲッティ','ゆで'],['オートミール'],
  ['にわとり','むね','皮なし','生'],['にわとり','もも','皮なし','生'],['にわとり','ささみ','生'],
  ['ぶた','ロース','赤肉','生'],['ぶた','ばら','脂身つき','生'],['うし','もも','赤肉','生'],
  ['くろまぐろ','赤身','生'],['しろさけ','生'],['まさば','生'],['まあじ','皮つき','生'],['ぶり','成魚','生'],['かつお','春獲り','生'],
  ['鶏卵','全卵','生'],['普通牛乳'],['ヨーグルト','全脂無糖'],['プロセスチーズ'],
  ['木綿豆腐'],['絹ごし豆腐'],['糸引き納豆'],['だいず','全粒','国産','黄大豆','乾'],['アーモンド','乾'],
  ['ばなな','生'],['りんご','皮なし','生'],['アボカド','生'],['キウイフルーツ','緑肉種','生'],['うんしゅうみかん','じょうのう','普通','生'],
  ['ブロッコリー','花序','生'],['ほうれんそう','葉','通年平均','生'],['にんじん','根','皮なし','生'],['赤色トマト','果実','生'],['キャベツ','結球葉','生'],['たまねぎ','りん茎','生'],['きゅうり','果実','生'],['なす','果実','生'],
  ['じゃがいも','塊茎','皮なし','生'],['さつまいも','塊根','皮なし','生'],['ぶなしめじ','生'],['乾しいたけ','乾'],['まいたけ','生'],['アボカド','生'],
];
const seen = new Set(), picks = [];
for (const toks of PICKS) {
  const f = FOODS.find(x => toks.every(t => x.n.includes(t)));
  if (f && !seen.has(f.no)) { seen.add(f.no); picks.push(f); }
}
const macro = ['ENERC_KCAL', 'PROT', 'FAT', 'CHOCDF', 'FIB', 'NACL_EQ'];
function comparePage(a, b) {
  const url = `/compare/${a.no}-${b.no}`;
  const na = dispName(a.n), nb = dispName(b.n);
  let winA = 0, winB = 0;
  let rows = '';
  for (const cat of CATS) {
    rows += `<tr class="catrow"><th colspan="3">${esc(cat)}</th></tr>`;
    for (const c of COLS.filter(x => x.cat === cat)) {
      const va = a.v[c.key], vb = b.v[c.key];
      if (va != null && vb != null) { if (va > vb) winA++; else if (vb > va) winB++; }
      const sa = va != null && vb != null && va > vb ? ' style="font-weight:700;color:var(--accent)"' : '';
      const sb = va != null && vb != null && vb > va ? ' style="font-weight:700;color:var(--accent)"' : '';
      rows += `<tr><td>${esc(c.label)}<br><span style="color:#9aa;font-size:11px">${esc(c.unit)}</span></td><td class="num"${sa}>${fmt(va)}</td><td class="num"${sb}>${fmt(vb)}</td></tr>`;
    }
  }
  const macroLine = macro.filter(k => a.v[k] != null && b.v[k] != null).map(k => {
    const c = colByKey[k]; const d = a.v[k] - b.v[k];
    return `${c.label}は${d === 0 ? '同じ' : (d > 0 ? na : nb) + 'が多い'}（${fmt(a.v[k])}${c.unit} / ${fmt(b.v[k])}${c.unit}）`;
  }).join('、');
  const body = `
<nav class="crumbs"><a href="/">ホーム</a> › <a href="/compare/">食品の比較</a> › ${esc(na)} と ${esc(nb)}</nav>
<h1>${esc(na)}と${esc(nb)}の栄養を比較（可食部100gあたり）</h1>
<p class="lead">${esc(na)}（${esc(a.g)}）と${esc(nb)}（${esc(b.g)}）の栄養成分を比較します。${esc(macroLine)}。全53項目で多い方を緑色で示しています（${esc(na)}が${winA}項目、${esc(nb)}が${winB}項目で上回ります）。</p>
<h2>栄養成分の比較表（全53項目）</h2>
<table class="data"><thead><tr><th>栄養素</th><th class="num"><a href="/foods/${a.no}">${esc(na)}</a></th><th class="num"><a href="/foods/${b.no}">${esc(nb)}</a></th></tr></thead><tbody>${rows}</tbody></table>
<a class="toapp" href="/">▶ さらに多くの食品をグラフで比較する</a>
<h2>関連する比較・詳細</h2>
<p><a class="pill" href="/foods/${a.no}">${esc(na)}の詳細</a><a class="pill" href="/foods/${b.no}">${esc(nb)}の詳細</a>${picks.filter(x => x.no !== a.no && x.no !== b.no).slice(0, 8).map(x => { const lo = a.no < x.no ? a : x, hi = a.no < x.no ? x : a; return `<a class="pill" href="/compare/${lo.no}-${hi.no}">${esc(na)} vs ${esc(dispName(x.n))}</a>`; }).join('')}</p>`;
  write(`compare/${a.no}-${b.no}.html`, page({
    title: `${na}と${nb}の栄養を比較｜カロリー・たんぱく質ほか｜NutriGraph`,
    desc: `${na}と${nb}の栄養成分を可食部100gあたりで比較。${macroLine}。日本食品標準成分表2020年版(八訂)。`,
    canonical: url, body,
    breadcrumb: [{ name: 'ホーム', url: '/' }, { name: '食品の比較', url: '/compare/' }, { name: `${na} と ${nb}`, url }],
  }));
  urls.push({ loc: url, pri: '0.5' });
}
for (let i = 0; i < picks.length; i++)
  for (let j = i + 1; j < picks.length; j++)
    comparePage(picks[i], picks[j]);
write('compare/index.html', page({
  title: '食品の栄養を比較する｜人気食品の比較一覧｜NutriGraph',
  desc: 'ごはんと食パン、鶏むね肉と鶏もも肉など、人気食品どうしの栄養成分を1対1で比較。カロリー・たんぱく質・脂質・炭水化物ほか全53項目。',
  canonical: '/compare/',
  breadcrumb: [{ name: 'ホーム', url: '/' }, { name: '食品の比較', url: '/compare/' }],
  body: `<nav class="crumbs"><a href="/">ホーム</a> › 食品の比較</nav>
<h1>食品の栄養を比較する</h1>
<p class="lead">よく比較される食品どうしの栄養成分を1対1で比べられます。比較したい2つの食品を選んでください。</p>
<div class="linklist">${picks.map(f => `<a href="/foods/${f.no}">${esc(dispName(f.n))}</a>`).join('')}</div>
<a class="toapp" href="/">▶ インタラクティブ版で自由に比較する</a>`,
}));
urls.push({ loc: '/compare/', pri: '0.7' });

// ---------- sitemap.xml ----------
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u.loc}</loc><lastmod>2026-06-14</lastmod><priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm);

console.log(`生成完了: 食品 ${FOODS.length} / 栄養素 ${COLS.length} / 食品群 ${GROUPS.length} / sitemap URL ${urls.length}`);

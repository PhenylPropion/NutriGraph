/* NutriGraph: 生成ページのグラフをブラウザ側で描画する軽量スクリプト（依存なし）。
   - .g-bar[data-v][data-max][data-c]      → 単純な割合バー（stats.json 不要・即描画）
   - .g-box[data-k][data-g][data-v]         → 食品群の分布(箱ひげ)にこの食品の値を重ねたミニグラフ
   数値は静的HTMLに既に存在するため、JSが無効でも内容（数値）は読めます。 */
(function () {
  'use strict';
  var STAT = { q1: '#3b82c4', q3: '#8a5fb0', mean: '#5b6670', med: '#e0762e' };
  var TIER = ['#c2ccd2', '#8fc0b1', '#3f9b86', '#2f7d6e', '#d64541'];
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // 単純バー（HTMLのspan + 内側のi、CSSで装飾）
  function drawBars() {
    document.querySelectorAll('.g-bar').forEach(function (sp) {
      if (sp.dataset.done) return;
      var v = parseFloat(sp.dataset.v), max = parseFloat(sp.dataset.max);
      if (!(max > 0) || isNaN(v)) return;
      var w = Math.max(1, Math.min(100, v / max * 100));
      var i = document.createElement('i');
      i.style.width = w + '%';
      i.style.background = sp.dataset.c || '#2f7d6e';
      sp.appendChild(i);
      sp.dataset.done = '1';
    });
  }

  function tierOf(v, s) { // s = [min,q1,med,q3,max,mean]
    if (v > s[4]) return 4; if (v >= s[3]) return 3; if (v >= s[2]) return 2; if (v >= s[1]) return 1; return 0;
  }

  function drawBoxes(stats) {
    var W = 124, H = 18, pad = 5, y = 9;
    document.querySelectorAll('.g-box').forEach(function (sp) {
      if (sp.dataset.done) return;
      var g = stats[sp.dataset.g]; if (!g) return;
      var s = g[sp.dataset.k]; if (!s) return;
      var v = parseFloat(sp.dataset.v); if (isNaN(v)) return;
      var dmax = s[4] || 1, tier = tierOf(v, s), tc = TIER[tier], over = tier === 4;
      var X = function (x) { return pad + (Math.min(x, dmax) / dmax) * (W - 2 * pad); };
      var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', class: 'boxg', role: 'img', 'aria-label': '群内の相対位置' });
      if (over) {
        svg.appendChild(el('rect', { x: X(0), y: y - 5, width: (W - 2) - X(0), height: 10, rx: 2, fill: tc, 'fill-opacity': 0.9 }));
        svg.appendChild(el('polyline', { points: (W - 14) + ',' + (y - 5) + ' ' + (W - 10) + ',' + (y - 2) + ' ' + (W - 14) + ',' + y + ' ' + (W - 10) + ',' + (y + 2) + ' ' + (W - 14) + ',' + (y + 5), fill: 'none', stroke: '#fff', 'stroke-width': 1.2 }));
        svg.appendChild(el('path', { d: 'M' + (W - 9) + ',' + (y - 3) + ' L' + (W - 5) + ',' + y + ' L' + (W - 9) + ',' + (y + 3), fill: 'none', stroke: '#fff', 'stroke-width': 1.4 }));
      } else {
        svg.appendChild(el('rect', { x: X(0), y: y - 4, width: Math.max(0.5, X(v) - X(0)), height: 8, rx: 2, fill: tc, 'fill-opacity': tier >= 2 ? 0.9 : 0.7 }));
      }
      svg.appendChild(el('line', { x1: X(s[1]), y1: y - 6, x2: X(s[1]), y2: y + 6, stroke: STAT.q1, 'stroke-width': 1.2 }));
      svg.appendChild(el('line', { x1: X(s[3]), y1: y - 6, x2: X(s[3]), y2: y + 6, stroke: STAT.q3, 'stroke-width': 1.2 }));
      svg.appendChild(el('line', { x1: X(s[5]), y1: y - 6, x2: X(s[5]), y2: y + 6, stroke: STAT.mean, 'stroke-width': 0.9, 'stroke-dasharray': '2,1.5' }));
      svg.appendChild(el('circle', { cx: X(s[2]), cy: y, r: 2.4, fill: STAT.med, stroke: '#fff', 'stroke-width': 0.8 }));
      sp.appendChild(svg);
      sp.dataset.done = '1';
    });
  }

  function run() {
    drawBars(); // stats 不要なので即時
    if (!document.querySelector('.g-box')) return;
    fetch('/stats.json').then(function (r) { return r.json(); }).then(drawBoxes).catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

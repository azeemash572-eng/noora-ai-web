/* Astra 3.2.2 — lightweight neural-network background (matches azeemash572-eng.github.io/azeem/).
   ~52 nodes on a phone, 30fps, pauses when hidden or in light theme, respects prefers-reduced-motion.
   Independent of chat/voice; never touches input, WebAudio, or the recognition pipeline. */
(function () {
  var canvas = document.getElementById('net');
  if (!canvas || !canvas.getContext) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = canvas.getContext('2d', { alpha: true });
  var nodes = [], W = 0, H = 0, DPR = 1, hidden = document.visibilityState === 'hidden';
  var last = 0, FRAME = 1000 / 30, raf = 0, rt;

  function isLight() {
    var root = document.documentElement;
    var t = root.getAttribute('data-theme');
    if (t === 'light') return true;
    if (t === 'dark') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }
  function isOff() { return hidden || isLight(); }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    var cw = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 360);
    var ch = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 640);
    W = canvas.width = Math.floor(cw * DPR);
    H = canvas.height = Math.floor(ch * DPR);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    init(cw, ch);
  }
  function init(cw, ch) {
    var area = cw * ch;
    var n = Math.round(area / 18000);
    var cap = cw < 640 ? 52 : 88;
    n = Math.max(28, Math.min(n, cap));
    nodes = [];
    for (var i = 0; i < n; i++) {
      var hub = i % 11 === 0;
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.22 * DPR,
        vy: (Math.random() - 0.5) * 0.22 * DPR,
        r: (hub ? 1.8 : 0.8 + Math.random() * 0.9) * DPR,
        p: Math.random() * 6.283,
        hub: hub
      });
    }
  }
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    if (isOff() || !W) return;
    var maxd = ((window.innerWidth < 640) ? 110 : 140) * DPR, maxd2 = maxd * maxd;
    var i, j, a, b, dx, dy, d2, o;
    ctx.lineCap = 'round';
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        dx = a.x - b.x; dy = a.y - b.y; d2 = dx * dx + dy * dy;
        if (d2 < maxd2) {
          o = 1 - Math.sqrt(d2) / maxd;
          ctx.strokeStyle = a.hub || b.hub
            ? 'rgba(138,92,255,' + (o * 0.22) + ')'
            : 'rgba(0,229,255,' + (o * 0.2) + ')';
          ctx.lineWidth = DPR * (o * 0.85 + 0.3);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var pulse = reduce ? 1 : (0.65 + 0.35 * Math.sin(t * 0.002 + n.p));
      if (n.hub) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(138,92,255,' + (0.16 * pulse) + ')';
        ctx.arc(n.x, n.y, n.r * 3.6, 0, 6.283); ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0,229,255,' + (0.8 * pulse) + ')';
        ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(30,144,255,' + (0.14 * pulse) + ')';
        ctx.arc(n.x, n.y, n.r * 3.1, 0, 6.283); ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0,229,255,' + (0.55 * pulse) + ')';
        ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill();
      }
      if (!reduce) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }
    }
  }
  function frame(t) {
    raf = 0;
    if (isOff()) return;
    if (t - last >= FRAME) { last = t; draw(t); }
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (reduce || isOff() || raf) return;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (isOff() && ctx && W) ctx.clearRect(0, 0, W, H);
  }
  function onVis() {
    hidden = document.visibilityState !== 'visible';
    if (hidden) stop(); else start();
  }

  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', function () { hidden = true; stop(); });
  window.addEventListener('pageshow', function () { hidden = document.visibilityState !== 'visible'; if (!hidden) start(); });
  if (window.MutationObserver) {
    new MutationObserver(function () { if (isOff()) stop(); else start(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { resize(); if (!isOff()) draw(performance.now()); }, 150);
  });

  resize();
  draw(0);
  if (!reduce) start();
})();

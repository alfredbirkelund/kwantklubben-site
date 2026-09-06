/* js/kk-volsurface.js — the hero's implied-volatility surface.

   A self-contained canvas wireframe of σ(K, T): the curved sheet an options
   trader bootstraps out of noisy market prices, which is exactly the hero's
   promise ("from noise to insight"). No Three.js, no CDN, no build step — a
   small isometric projection drawn with the 2D context, styled to sit on the
   gridpaper in the chunky ink/lime idiom.

   Model: σ(x,T) = σ0 + (ρ·x + α·x²)·exp(−κ·T), x = log-moneyness. The smile
   (α) and put skew (ρ) are strongest at short maturity and flatten as T grows,
   which is the real, recognisable shape of an equity volatility surface.

   Projection is ISOMETRIC (parallel, rigid edges, no perspective warp) with a
   turntable yaw about the vertical: strike goes down-right, maturity down-left,
   vol straight UP — so the vol axis is always a clean vertical line. The view
   spins slowly when idle and pauses while you hover or drag (drag to orbit).
   Hovering shows a lime dot on the nearest vertex. Under
   prefers-reduced-motion the surface is drawn static and still draggable.
   Returns immediately where there is no #kk-volsurface. */
(function () {
  'use strict';
  var host = document.getElementById('kk-volsurface');
  if (!host) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    'An implied volatility surface: a curved wireframe sheet showing option volatility across strike and maturity.');
  host.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  function cvar(name, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  }
  var INK = cvar('--ink-600', '#2B3340');
  var INK_800 = cvar('--ink-800', '#14181F');
  var INK_900 = cvar('--ink-900', '#0C1016');
  var LIME = cvar('--lime-600', '#A6CE12');
  var PAPER = cvar('--paper-50', '#FBF9F2');
  var MONO = cvar('--font-mono', "'Space Mono', monospace");
  var DISPLAY = cvar('--font-display', "'Space Grotesk', sans-serif");

  /* --- surface model --- */
  var X0 = -0.8, X1 = 0.8;  // log-moneyness range (K ≈ 45% – 222% of spot)
  var T0 = 0.08, T1 = 2.0;  // maturity range (years); T0 also sets the decay reference

  /* σ(x,T) = σ_ATM(T) + [ρ₀·x + α₀·x²] · (T₀/T)^p ,  x = log-moneyness, T in years.
     σ_ATM(T) = σ∞ − (σ∞ − σ0)·e^(−λT)  →  a mild upward term structure (~16% at
     one month rising to ~21% at two years), typical of equity index options.
     The smile/skew term is at full strength at the shortest maturity (T₀) and
     decays by a power law with T, so it flattens with time but does not vanish
     (unlike an exponential decay). Negative ρ₀ gives put skew — OTM puts richer
     than OTM calls — and α₀ gives smile curvature; both are calibrated to a
     liquid equity index surface (e.g. SPX). */
  var SIG_SHORT = 0.155, SIG_LONG = 0.215, LAMBDA = 1.2;  // ATM term structure
  var RHO0 = -0.11, ALPHA0 = 0.14, DECAY_P = 0.5;         // skew, smile, decay

  function atm(T) { return SIG_LONG - (SIG_LONG - SIG_SHORT) * Math.exp(-LAMBDA * T); }
  function sigma(x, T) {
    var d = Math.pow(T0 / T, DECAY_P);
    return atm(T) + (RHO0 * x + ALPHA0 * x * x) * d;
  }
  var NX = 44, NT = 18;

  var xs = new Array(NX), ts = new Array(NT), v = [];
  var vMin = Infinity, vMax = -Infinity;
  for (var i = 0; i < NX; i++) xs[i] = X0 + (X1 - X0) * i / (NX - 1);
  for (var j = 0; j < NT; j++) ts[j] = T0 + (T1 - T0) * j / (NT - 1);
  for (var j = 0; j < NT; j++) {
    v[j] = new Array(NX);
    for (var i = 0; i < NX; i++) {
      var s = sigma(xs[i], ts[j]);
      v[j][i] = s;
      if (s < vMin) vMin = s;
      if (s > vMax) vMax = s;
    }
  }

  /* --- view --- */
  var yaw = 0.62;
  var elev = 0.38;      // elevation: 0 = eye-level/side-on, ~1.5 = top-down
  var AUTO = 0.00015;   // rad/ms idle spin (gentle, clearly visible)
  var lastT = performance.now();
  var R = 26;           // px — "on the graph" proximity for the dot and drag
  var dragging = false, hovered = false;
  var mx = -1, my = -1;
  var lastDrag = null;

  // Title + caption band reserved at the top of the graphic (drawn on canvas so
  // the hero keeps one self-contained element and its height does not grow).
  var HEADER = 124;
  var header = 0;        // animated current band height (eases 0 <-> HEADER)
  var axisP = 0;         // axis extension progress: 0 hidden, 1 fully extended
  var TITLE = 'Implied Volatility Surface';
  var CAPTION = "The smirk: implied volatility is lowest near the money, climbs sharply toward out-of-the-money puts, and flattens as maturity grows.";

  /* --- canvas sizing --- */
  var W = 0, H = 0;
  function resize() {
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var r = host.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Surface world box: strike/maturity X,Y ∈ [-S, S], vol Z ∈ [ZB, ZT].
     The axis frame is slightly larger (F) so the axes stand clear of the sheet,
     and the vol axis rises to FH. */
  var S = 0.40, ZB = 0.06, ZT = 0.88, F = 0.50, FH = 0.95;

  var SCALE = 1, OX = 0, OY = 0;
  function setView() {
    var hFrac = Math.min(1, Math.max(0, header / HEADER));
    var mult = 0.78 - 0.16 * hFrac; // 0.78 idle -> 0.62 hovered
    SCALE = Math.min(W, H - header) * mult;
    OX = W * 0.5;
    // Centre the graph (its vertical mid-point sits at sy ≈ −0.435) in the
    // space below the header, so there is no dead gap between caption and plot.
    OY = (header + H) * 0.5 + 0.435 * SCALE;
  }

  /* Orthographic azimuth + elevation (matplotlib-style): yaw is the azimuth
     (turntable about vertical), elev is the camera elevation. Strike faces the
     viewer horizontally, maturity recedes into depth, vol rises up. Lower elev
     = more side-on; higher = more top-down. No perspective, so edges stay
     rigid and parallel. d = -(Yr·ce + Z·se) is depth for painter's ordering. */
  function projectXYZ(X, Y, Z) {
    var c = Math.cos(yaw), sn = Math.sin(yaw);
    var Xr = X * c - Y * sn;
    var Yr = X * sn + Y * c;
    var se = Math.sin(elev), ce = Math.cos(elev);
    var sx = Xr;
    var sy = Yr * se - Z * ce;       // screen-down: higher vol -> higher on screen
    var d = -(Yr * ce + Z * se);     // far -> smaller (sort ascending draws far first)
    return { x: sx, y: sy, d: d };
  }

  function surfaceXYZ(x, t, s) {
    return projectXYZ(
      ((x - X0) / (X1 - X0)) * 2 * S - S,
      ((t - T0) / (T1 - T0)) * 2 * S - S,
      ZB + (s - vMin) / (vMax - vMin) * (ZT - ZB)
    );
  }
  function px(p) { return OX + p.x * SCALE; }
  function py(p) { return OY + p.y * SCALE; }

  /* Nearest surface node within R px of (sx, sy); null if the cursor is off the
     sheet. Used for the hover dot and to gate drag, so the plot only responds
     when the cursor is actually on the surface, not anywhere in the column. */
  function nearNode(sx, sy) {
    if (!pts) return null;
    var best = null, bd = Infinity;
    for (var j = 0; j < NT; j++) for (var i = 0; i < NX; i++) {
      var dx = sx - pts[j][i].x, dy = sy - pts[j][i].y, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = { i: i, j: j }; }
    }
    return (best && bd <= R * R) ? best : null;
  }

  var pts = null;

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // ---- title + caption (fade in on hover, for a cleaner idle state) ----
    if (header > 1) {
      ctx.globalAlpha = Math.min(1, header / HEADER);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = INK_900;
      ctx.font = '700 23px ' + DISPLAY;
      ctx.fillText(TITLE, W / 2, 28);

      ctx.fillStyle = INK;
      ctx.font = '400 15px ' + DISPLAY;
      var capLines = wrap(CAPTION, W * 0.92);
      for (var li = 0; li < capLines.length; li++) {
        ctx.fillText(capLines[li], W / 2, 54 + li * 20);
      }
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
    }

    // project all surface nodes
    pts = new Array(NT);
    var i, j;
    for (j = 0; j < NT; j++) {
      pts[j] = new Array(NX);
      for (i = 0; i < NX; i++) {
        var p = surfaceXYZ(xs[i], ts[j], v[j][i]);
        pts[j][i] = { x: px(p), y: py(p), d: p.d };
      }
    }

    // ---- floor plane (strike x maturity rectangle at z=0, frame extent) ----
    var f = [
      projectXYZ(-F, -F, 0), projectXYZ(F, -F, 0),
      projectXYZ(F, F, 0), projectXYZ(-F, F, 0)
    ];
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.14 * axisP;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(f[0]), py(f[0]));
    ctx.lineTo(px(f[1]), py(f[1]));
    ctx.lineTo(px(f[2]), py(f[2]));
    ctx.lineTo(px(f[3]), py(f[3]));
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ---- surface wireframe (painter's order: far -> near) ----
    var rows = [], cols = [], k, sum;
    for (j = 0; j < NT; j++) { sum = 0; for (i = 0; i < NX; i++) sum += pts[j][i].d; rows.push({ j: j, d: sum / NX }); }
    for (i = 0; i < NX; i++) { sum = 0; for (j = 0; j < NT; j++) sum += pts[j][i].d; cols.push({ i: i, d: sum / NT }); }
    rows.sort(function (a, b) { return a.d - b.d; });
    cols.sort(function (a, b) { return a.d - b.d; });

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    for (k = 0; k < rows.length; k++) {
      j = rows[k].j;
      ctx.beginPath();
      ctx.moveTo(pts[j][0].x, pts[j][0].y);
      for (i = 1; i < NX; i++) ctx.lineTo(pts[j][i].x, pts[j][i].y);
      ctx.stroke();
    }
    for (k = 0; k < cols.length; k++) {
      i = cols[k].i;
      ctx.beginPath();
      ctx.moveTo(pts[0][i].x, pts[0][i].y);
      for (j = 1; j < NT; j++) ctx.lineTo(pts[j][i].x, pts[j][i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // lime smile: the shortest-maturity edge, where the smile is most pronounced
    ctx.strokeStyle = LIME;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pts[0][0].x, pts[0][0].y);
    for (i = 1; i < NX; i++) ctx.lineTo(pts[0][i].x, pts[0][i].y);
    ctx.stroke();
    ctx.lineWidth = 1;

    // ---- axes (extend from the origin on hover; labels land once full) ----
    // Three rigid edges diverging from one back-corner origin, so the labels
    // land in three separated directions (right / depth / up). The vol axis
    // rises at the back corner, clear of the sheet thanks to the F > S gap.
    drawAxis(projectXYZ(-F, -F, 0), projectXYZ(F, -F, 0), 'strike', [0.25, 0.5, 0.75], axisP);
    drawAxis(projectXYZ(-F, -F, 0), projectXYZ(-F, F, 0), 'maturity', [0.25, 0.5, 0.75], axisP);
    drawAxis(projectXYZ(-F, -F, 0), projectXYZ(-F, -F, FH), 'vol', [0.25, 0.5, 0.75], axisP);

    // hover readout
    if (hovered && mx >= 0 && pts) {
      var best = nearNode(mx, my);
      if (best) {
        var dotx = pts[best.j][best.i].x, doty = pts[best.j][best.i].y;
        ctx.fillStyle = LIME;
        ctx.beginPath();
        ctx.arc(dotx, doty, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* Draw one axis as it extends from the origin to its full length, where t is
     the progress 0..1. The line and its ticks grow with t; the arrowhead and
     end label appear only once the axis is (nearly) full. */
  function drawAxis(w0, w1, label, ticks, t) {
    if (t <= 0) return;
    var p0 = { x: px(w0), y: py(w0) };
    var pf = { x: px(w1), y: py(w1) };          // full endpoint
    var ax = pf.x - p0.x, ay = pf.y - p0.y;
    var len = Math.hypot(ax, ay) || 1;
    var ux = ax / len, uy = ay / len;
    var p1 = { x: p0.x + ax * t, y: p0.y + ay * t }; // current visible tip

    ctx.strokeStyle = INK_800;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = INK_800;
    ctx.globalAlpha = 0.6;
    for (var i = 0; i < ticks.length; i++) {
      var f = ticks[i];
      if (f > t) break;
      var cx = p0.x + ax * f, cy = p0.y + ay * f;
      var nx = -uy * 4, ny = ux * 4;
      ctx.beginPath();
      ctx.moveTo(cx - nx, cy - ny);
      ctx.lineTo(cx + nx, cy + ny);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // arrowhead + label only once the axis is full (small fade-in)
    if (t >= 0.97) {
      ctx.globalAlpha = Math.min(1, (t - 0.97) / 0.03);
      var ang = Math.atan2(ay, ax);
      var s = 7;
      ctx.fillStyle = INK_800;
      ctx.beginPath();
      ctx.moveTo(pf.x, pf.y);
      ctx.lineTo(pf.x - s * Math.cos(ang - 0.42), pf.y - s * Math.sin(ang - 0.42));
      ctx.lineTo(pf.x - s * Math.cos(ang + 0.42), pf.y - s * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();

      ctx.font = '500 11px ' + MONO;
      ctx.fillStyle = INK_800;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pf.x + ux * 18, pf.y + uy * 18);
      ctx.textAlign = 'start';
      ctx.globalAlpha = 1;
    }
  }

  /* Wrap text to a max pixel width, splitting on spaces. */
  function wrap(text, maxWidth) {
    var words = text.split(' ');
    var lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!dragging && !reduce) {
      yaw += AUTO * 1000 * dt; // constant, frame-rate-independent spin
    }
    // ease the header band in/out on hover so the caption slides smoothly
    var target = hovered ? HEADER : 0;
    header += (target - header) * Math.min(1, dt * 10);
    // axes extend from the origin on hover, a bit faster than the caption
    var aTarget = hovered ? 1 : 0;
    axisP += (aTarget - axisP) * Math.min(1, dt * 16);
    setView();
    draw();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (!nearNode(e.offsetX, e.offsetY)) return; // only orbit when on the surface
    dragging = true;
    lastDrag = { x: e.clientX, y: e.clientY };
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    mx = e.offsetX; my = e.offsetY;
    if (dragging && lastDrag) {
      var dx = e.clientX - lastDrag.x;
      yaw += dx * 0.008;
      lastDrag = { x: e.clientX, y: e.clientY };
    }
  });
  canvas.addEventListener('pointerup', function () { dragging = false; lastDrag = null; });
  canvas.addEventListener('pointerenter', function () { hovered = true; });
  canvas.addEventListener('pointerleave', function () { hovered = false; mx = -1; my = -1; });

  window.addEventListener('resize', function () { resize(); setView(); });

  resize();
  setView();
  requestAnimationFrame(frame);
})();
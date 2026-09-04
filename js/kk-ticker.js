/* js/kk-ticker.js — the partners marquee.

   CSS animates the strip with a fixed 14s keyframe loop, which is fine until
   you want a hover to *slow* it: changing animation-duration re-times the
   running animation and snaps the position. This script takes over so the
   speed can ease smoothly instead of jumping.

   It clones the logo row once (two identical halves), then drives transform
   with requestAnimationFrame, easing the velocity toward a target when the
   strip is hovered. The wrap distance is measured between an item and its
   clone, so the loop stays seamless even once real, distinct partner logos
   are added. Returns immediately where there is no .kk-ticker-wrap, and does
   nothing under prefers-reduced-motion. */
(function () {
  var wrap = document.querySelector('.kk-ticker-wrap');
  if (!wrap) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  var track = wrap.querySelector('.kk-ticker');
  if (!track) return;

  // Two identical halves -> a seamless wrap measured across exactly one copy.
  track.innerHTML += track.innerHTML;

  var NORMAL = 14; // seconds for one lap at full speed
  var SLOW = 4;    // hover runs at 1/4 speed (75% slower)
  var lap = 0;     // measured: distance from an item to its clone (px)
  var speed = 1;   // current velocity multiplier
  var targetSpeed = 1;

  function measure() {
    var kids = track.children;
    if (kids.length < 2) return;
    var half = kids.length / 2;
    lap = kids[half].getBoundingClientRect().left - kids[0].getBoundingClientRect().left;
    if (lap <= 0) lap = track.scrollWidth / 2;
  }

  wrap.addEventListener('mouseenter', function () { targetSpeed = 1 / SLOW; });
  wrap.addEventListener('mouseleave', function () { targetSpeed = 1; });
  window.addEventListener('resize', measure);

  var pos = 0;
  var last = performance.now();

  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); // clamp tab-switch gaps
    last = now;

    speed += (targetSpeed - speed) * Math.min(1, dt * 9); // ease the velocity
    pos += (lap / NORMAL) * speed * dt;
    pos %= lap;

    track.style.transform = 'translateX(' + (-pos).toFixed(2) + 'px)';
    requestAnimationFrame(tick);
  }

  measure();
  requestAnimationFrame(tick);
})();
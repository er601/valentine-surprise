/**
 * Buttons logic:
 * - YES: hearts burst + open modal + optional auto-music
 * - NO: runs away by switching to position:fixed and moving via left/top (NO transform conflicts)
 *
 * Works on mouse + touch (pointer events).
 */

export function setupButtons({ yesBtn, noBtn, fxCanvas, modal, onYes }) {
  if (!yesBtn || !noBtn) {
    console.error("Buttons not found. Check ids: btnYes / btnNo");
    return;
  }

  const fx = createHeartsFx(fxCanvas);

  // YES
  yesBtn.addEventListener("click", async () => {
    fx.burst();
    onYes?.();

    modal.open({
      title: "A letter for you ❤️",
      body:
`Alina, thank you for being my favorite person.
You make my world softer, brighter, and more beautiful.
Thank you for every moment we’ve shared.
I hope this little surprise brings a smile to your face, just like you do to mine every day.
I love you so much.`
    });

    // Optional: auto-start music after YES (counts as user gesture)
    try {
      await modal.toggleMusic?.();
    } catch {}
  });

  // ---------------------------------
  // NO runaway (robust fixed-position)
  // ---------------------------------
  const no = createRunawayNo(noBtn, { modal, fx });

  // Mouse/touch near detection on the whole window
  window.addEventListener(
    "pointermove",
    (e) => {
      if (modal.isOpen?.()) return;
      no.runAwayFrom(e.clientX, e.clientY, false);
    },
    { passive: true }
  );

  // Guaranteed escape when pointer enters the NO button
  noBtn.addEventListener(
    "pointerenter",
    (e) => {
      if (modal.isOpen?.()) return;
      no.runAwayFrom(e.clientX, e.clientY, true);
    },
    { passive: true }
  );

  // Touch: if they try to press NO, it escapes + small tease burst
  noBtn.addEventListener(
    "pointerdown",
    (e) => {
      if (modal.isOpen?.()) return;
      no.runAwayFrom(e.clientX, e.clientY, true);
      fx.tease(e.clientX, e.clientY);
      e.preventDefault();
    },
    { passive: false }
  );

  // Keep inside viewport after resize/scroll
  window.addEventListener("resize", () => no.reclamp(), { passive: true });
  window.addEventListener("scroll", () => no.reclamp(), { passive: true });

  return { fx };
}

/**
 * Turns the NO button into a fixed-position "runner"
 * while keeping layout stable using a placeholder.
 */
function createRunawayNo(noBtn, { modal, fx }) {
  let isFixed = false;
  let placeholder = null;

  // current fixed position
  let left = 0;
  let top = 0;

  // throttle to avoid jitter
  let lastMove = 0;
  const throttleMs = 120;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function makeFixedIfNeeded() {
    if (isFixed) return;

    // create placeholder to keep layout where the button was
    const rect = noBtn.getBoundingClientRect();
    placeholder = document.createElement("span");
    placeholder.className = "no-placeholder";
    placeholder.style.display = "inline-block";
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;

    // insert placeholder where button currently sits
    noBtn.parentNode.insertBefore(placeholder, noBtn);

    // move NO button to body, so it can freely move above everything
    document.body.appendChild(noBtn);

    // set fixed position at the same screen spot
    left = rect.left;
    top = rect.top;

    noBtn.classList.add("btn-no-fixed");
    noBtn.style.position = "fixed";
    noBtn.style.left = `${left}px`;
    noBtn.style.top = `${top}px`;
    noBtn.style.zIndex = "10";
    noBtn.style.margin = "0";
    noBtn.style.transform = "none"; // IMPORTANT: no transform conflicts
    noBtn.style.transition = "left 240ms cubic-bezier(.2,.9,.2,1), top 240ms cubic-bezier(.2,.9,.2,1), background 160ms ease, box-shadow 200ms ease, border-color 160ms ease";

    isFixed = true;
  }

  function getButtonRectFixed() {
    // When fixed, getBoundingClientRect gives current screen rect
    return noBtn.getBoundingClientRect();
  }

  function boundsForRect(rect) {
    const padding = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const minL = padding;
    const minT = padding;
    const maxL = vw - rect.width - padding;
    const maxT = vh - rect.height - padding;

    return { minL, maxL, minT, maxT };
  }

  function reclamp() {
    if (!isFixed) return;
    const rect = getButtonRectFixed();
    const { minL, maxL, minT, maxT } = boundsForRect(rect);

    left = clamp(left, minL, maxL);
    top = clamp(top, minT, maxT);

    noBtn.style.left = `${left}px`;
    noBtn.style.top = `${top}px`;
  }

  function runAwayFrom(px, py, force = false) {
    const now = performance.now();
    if (!force && now - lastMove < throttleMs) return;
    lastMove = now;

    if (modal.isOpen?.()) return;

    makeFixedIfNeeded();

    const rect = getButtonRectFixed();

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx0 = cx - px;
    const dy0 = cy - py;
    const dist = Math.hypot(dx0, dy0);

    // Only run when near unless forced
    const dangerRadius = Math.max(120, Math.min(200, rect.width * 2.0));
    if (!force && dist > dangerRadius) return;

    // direction away
    let dx = dx0 / (dist || 1);
    let dy = dy0 / (dist || 1);

    // playful randomness
    dx += (Math.random() * 2 - 1) * 0.35;
    dy += (Math.random() * 2 - 1) * 0.35;

    const len = Math.max(Math.hypot(dx, dy), 0.0001);
    dx /= len;
    dy /= len;

    const step = Math.min(270, Math.max(160, window.innerWidth * 0.24));

    left += dx * step;
    top += dy * step;

    // clamp to screen
    const { minL, maxL, minT, maxT } = boundsForRect(rect);
    left = clamp(left, minL, maxL);
    top = clamp(top, minT, maxT);

    // if got stuck (corner), jump somewhere random safe
    const stuck = (Math.abs(dx0) < 1 && Math.abs(dy0) < 1);
    if (stuck) {
      left = clamp(Math.random() * (maxL - minL) + minL, minL, maxL);
      top = clamp(Math.random() * (maxT - minT) + minT, minT, maxT);
    }

    noBtn.style.left = `${left}px`;
    noBtn.style.top = `${top}px`;
  }

  return { runAwayFrom, reclamp };
}

/* -------------------------
   Hearts FX (Canvas 2D)
   ------------------------- */

function createHeartsFx(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });

  const hearts = [];
  let running = false;
  let lastT = performance.now();

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function heartPath(c, x, y, size) {
    const s = size;
    c.beginPath();
    c.moveTo(x, y + s * 0.35);
    c.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.35);
    c.bezierCurveTo(x - s, y + s * 0.85, x - s * 0.2, y + s * 1.05, x, y + s * 1.25);
    c.bezierCurveTo(x + s * 0.2, y + s * 1.05, x + s, y + s * 0.85, x + s, y + s * 0.35);
    c.bezierCurveTo(x + s, y, x, y, x, y + s * 0.35);
    c.closePath();
  }

  function spawnBurst(cx, cy, count = 120) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < count; i++) {
      const angle = rand(-Math.PI, Math.PI);
      const speed = rand(260, 820);

      hearts.push({
        x: cx ?? w * 0.5,
        y: cy ?? h * 0.55,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(80, 250),
        g: rand(520, 920),
        size: rand(6, 14),
        rot: rand(-2.2, 2.2),
        vr: rand(-4.5, 4.5),
        life: rand(0.9, 1.35),
        t: 0,
        hue: rand(330, 355),
        sat: rand(75, 95),
        lit: rand(58, 70),
        alpha: rand(0.7, 1.0)
      });
    }

    if (!running) start();
  }

  function burst() {
    spawnBurst(undefined, undefined, window.innerWidth > 700 ? 160 : 100);
  }

  function tease(x, y) {
    spawnBurst(x, y, window.innerWidth > 700 ? 50 : 34);
  }

  function start() {
    running = true;
    lastT = performance.now();
    requestAnimationFrame(tick);
  }

  function tick(now) {
    const dt = Math.min((now - lastT) / 1000, 0.033);
    lastT = now;

    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    for (let i = hearts.length - 1; i >= 0; i--) {
      const p = hearts[i];
      p.t += dt;

      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      const fade = 1 - p.t / p.life;

      if (fade <= 0 || p.y > h + 120 || p.x < -140 || p.x > w + 140) {
        hearts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);

      ctx.shadowBlur = 18;
      ctx.shadowColor = `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${0.35 * fade})`;

      ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lit}%, ${p.alpha * fade})`;
      heartPath(ctx, 0, 0, p.size);
      ctx.fill();

      ctx.restore();
    }

    if (hearts.length > 0) requestAnimationFrame(tick);
    else {
      running = false;
      ctx.clearRect(0, 0, w, h);
    }
  }

  return { burst, tease };
}

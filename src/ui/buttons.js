/**
 * Buttons logic:
 * - YES: open modal, hide NO, start music
 * - NO: runs away (fixed) and SHRINKS on hover/attempts
 * - When modal closes: restore NO back and reset size
 */

export function setupButtons({ yesBtn, noBtn, fxCanvas, modal, onYes }) {
  if (!yesBtn || !noBtn) {
    console.error("Buttons not found. Check ids: btnYes / btnNo");
    return;
  }

  const fx = createHeartsFx(fxCanvas);
  const noCtrl = createRunawayNo(noBtn);

  // bring NO back after modal close
  modal.onClose?.(() => {
    noCtrl.restore();
  });

  // YES
  yesBtn.addEventListener("click", async () => {
    fx.burst();
    onYes?.();

    noCtrl.hide();

    modal.open({
      title: "A letter for you ❤️",
      body:
`Alina, thank you for being my favorite person.
You make my world softer, brighter, and more beautiful.
Thank you for every moment we’ve shared.`
    });

    try {
      await modal.toggleMusic?.();
    } catch {}
  });

  // when mouse comes near -> run
  window.addEventListener(
    "pointermove",
    (e) => {
      if (modal.isOpen?.()) return;
      noCtrl.runAwayFrom(e.clientX, e.clientY, false);
    },
    { passive: true }
  );

  // hover on NO -> shrink + run
  noBtn.addEventListener(
    "pointerenter",
    (e) => {
      if (modal.isOpen?.()) return;
      noCtrl.shrinkHover();
      noCtrl.runAwayFrom(e.clientX, e.clientY, true);
    },
    { passive: true }
  );

  // attempt press NO -> shrink more + run + tease
  noBtn.addEventListener(
    "pointerdown",
    (e) => {
      if (modal.isOpen?.()) return;
      noCtrl.shrinkPress();
      noCtrl.runAwayFrom(e.clientX, e.clientY, true);
      fx.tease(e.clientX, e.clientY);
      e.preventDefault();
    },
    { passive: false }
  );

  window.addEventListener("resize", () => noCtrl.reclamp(), { passive: true });
  window.addEventListener("scroll", () => noCtrl.reclamp(), { passive: true });

  return { fx };
}

function createRunawayNo(noBtn) {
  let isFixed = false;
  let hidden = false;

  const originalParent = noBtn.parentNode;
  const originalNextSibling = noBtn.nextSibling;

  let placeholder = null;

  let left = 0;
  let top = 0;

  // scale state
  let scale = 1.0;
  const minScale = 0.55;
  const hoverShrink = 0.90;  // stronger so you SEE it
  const pressShrink = 0.85;

  let lastMove = 0;
  const throttleMs = 120;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ✅ IMPORTANT: force transform with !important (wins over any CSS)
  function applyScale() {
    noBtn.style.setProperty("transform", `scale(${scale})`, "important");
    noBtn.style.setProperty("transform-origin", "center center", "important");
  }

  function resetScale() {
    scale = 1.0;
    applyScale();
  }

  function shrinkHover() {
    if (hidden) return;
    scale = Math.max(minScale, scale * hoverShrink);
    applyScale();
  }

  function shrinkPress() {
    if (hidden) return;
    scale = Math.max(minScale, scale * pressShrink);
    applyScale();
  }

  function hide() {
    hidden = true;
    noBtn.style.display = "none";
    if (placeholder) placeholder.style.display = "none";
  }

  function restore() {
    hidden = false;

    // remove placeholder
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }
    placeholder = null;

    // move back to original layout position
    if (originalNextSibling) originalParent.insertBefore(noBtn, originalNextSibling);
    else originalParent.appendChild(noBtn);

    // remove fixed styles
    noBtn.classList.remove("btn-no-fixed");
    noBtn.style.position = "";
    noBtn.style.left = "";
    noBtn.style.top = "";
    noBtn.style.zIndex = "";
    noBtn.style.margin = "";
    noBtn.style.transition = "";
    noBtn.style.display = "";

    isFixed = false;

    // reset scale
    resetScale();

    // also remove any leftover transform important (keep it but at scale 1)
    // (already done by resetScale)
  }

  function makeFixedIfNeeded() {
    if (isFixed || hidden) return;

    const rect = noBtn.getBoundingClientRect();

    placeholder = document.createElement("span");
    placeholder.className = "no-placeholder";
    placeholder.style.display = "inline-block";
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;

    originalParent.insertBefore(placeholder, noBtn);
    document.body.appendChild(noBtn);

    left = rect.left;
    top = rect.top;

    noBtn.classList.add("btn-no-fixed");
    noBtn.style.position = "fixed";
    noBtn.style.left = `${left}px`;
    noBtn.style.top = `${top}px`;
    noBtn.style.zIndex = "10";
    noBtn.style.margin = "0";

    noBtn.style.transition =
      "left 240ms cubic-bezier(.2,.9,.2,1), top 240ms cubic-bezier(.2,.9,.2,1), transform 220ms ease";

    applyScale();
    isFixed = true;
  }

  function getRect() {
    return noBtn.getBoundingClientRect();
  }

  function boundsForRect(rect) {
    const padding = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      minL: padding,
      minT: padding,
      maxL: vw - rect.width - padding,
      maxT: vh - rect.height - padding
    };
  }

  function reclamp() {
    if (!isFixed || hidden) return;
    const rect = getRect();
    const { minL, maxL, minT, maxT } = boundsForRect(rect);

    left = clamp(left, minL, maxL);
    top = clamp(top, minT, maxT);

    noBtn.style.left = `${left}px`;
    noBtn.style.top = `${top}px`;
  }

  function runAwayFrom(px, py, force = false) {
    if (hidden) return;

    const now = performance.now();
    if (!force && now - lastMove < throttleMs) return;
    lastMove = now;

    makeFixedIfNeeded();

    const rect = getRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx0 = cx - px;
    const dy0 = cy - py;
    const dist = Math.hypot(dx0, dy0);

    const dangerRadius = Math.max(120, Math.min(210, rect.width * 2.0));
    if (!force && dist > dangerRadius) return;

    let dx = dx0 / (dist || 1);
    let dy = dy0 / (dist || 1);

    dx += (Math.random() * 2 - 1) * 0.35;
    dy += (Math.random() * 2 - 1) * 0.35;

    const len = Math.max(Math.hypot(dx, dy), 0.0001);
    dx /= len;
    dy /= len;

    const step = Math.min(280, Math.max(160, window.innerWidth * 0.24));

    left += dx * step;
    top += dy * step;

    const { minL, maxL, minT, maxT } = boundsForRect(rect);
    left = clamp(left, minL, maxL);
    top = clamp(top, minT, maxT);

    noBtn.style.left = `${left}px`;
    noBtn.style.top = `${top}px`;
  }

  return { runAwayFrom, reclamp, hide, restore, shrinkHover, shrinkPress };
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

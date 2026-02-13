const MUSIC_FILE = "music/my-song.mp3";
const DEFAULT_VOLUME = 0.6;

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createModal(rootEl) {
  let isOpen = false;

  let audioEl = null;
  let playing = false;

  // NEW: close listeners
  const closeListeners = new Set();

  const defaultContent = {
    title: "A letter for you ❤️",
    body: `
Thank you for being the warmest part of my days.
You make the ordinary feel magical — just by being you.
If you ever forget how loved you are… come back to this moment.
    `.trim()
  };

  function getMusicUrl() {
    const base = import.meta.env.BASE_URL || "/";
    return `${base}${MUSIC_FILE}`;
  }

  function ensureAudio() {
    if (audioEl) return audioEl;
    audioEl = new Audio();
    audioEl.src = getMusicUrl();
    audioEl.loop = true;
    audioEl.preload = "auto";
    audioEl.volume = DEFAULT_VOLUME;
    audioEl.addEventListener("ended", () => (playing = false));
    return audioEl;
  }

  function render(content = defaultContent) {
    const safeTitle = escapeHtml(content.title);
    const safeBody = escapeHtml(content.body).replaceAll("\n", "<br/>");
    const shownUrl = escapeHtml(getMusicUrl());

    rootEl.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Valentine letter">
          <div class="modal-glow" aria-hidden="true"></div>

          <div class="modal-header">
            <h2 class="modal-title">${safeTitle}</h2>
            <button class="modal-x" type="button" aria-label="Close modal" data-modal-close>✕</button>
          </div>

          <div class="modal-body">
            <p>${safeBody}</p>
          </div>

          <div class="modal-actions">
            <button class="modal-btn" type="button" data-modal-close>Fermer</button>
            <button class="modal-btn modal-btn-primary" type="button" data-modal-music>
              Lance la musique
            </button>
          </div>

          <p class="modal-footnote" aria-hidden="true">
            (Music: <b>${shownUrl}</b>)
          </p>
        </div>
      </div>
    `;

    injectStylesOnce();
  }

  function open(content) {
    if (isOpen) return;
    isOpen = true;

    rootEl.setAttribute("aria-hidden", "false");
    render(content);

    requestAnimationFrame(() => {
      rootEl.querySelector(".modal-backdrop")?.classList.add("open");
    });

    const backdrop = rootEl.querySelector("[data-modal-backdrop]");
    const closeEls = rootEl.querySelectorAll("[data-modal-close]");
    const musicBtn = rootEl.querySelector("[data-modal-music]");

    closeEls.forEach((btn) => btn.addEventListener("click", close, { passive: true }));

    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });

    musicBtn?.addEventListener("click", async () => {
      await toggleMusic(musicBtn);
    });

    window.addEventListener("keydown", onKeyDown);
    (musicBtn || closeEls[0])?.focus?.();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    stopMusic();

    const backdrop = rootEl.querySelector(".modal-backdrop");
    backdrop?.classList.remove("open");

    setTimeout(() => {
      rootEl.innerHTML = "";
      rootEl.setAttribute("aria-hidden", "true");
    }, 180);

    window.removeEventListener("keydown", onKeyDown);

    // NEW: notify listeners
    closeListeners.forEach((fn) => {
      try { fn(); } catch {}
    });
  }

  function onKeyDown(e) {
    if (e.key === "Escape") close();
  }

  function stopMusic() {
    if (!audioEl) return;
    try {
      audioEl.pause();
      audioEl.currentTime = 0;
    } catch {}
    playing = false;
  }

  async function toggleMusic(buttonEl) {
    try {
      const a = ensureAudio();

      if (!playing) {
        await a.play();
        playing = true;
        if (buttonEl) buttonEl.textContent = "Coupe la musique";
      } else {
        stopMusic();
        if (buttonEl) buttonEl.textContent = "Lance la musique";
      }
    } catch (err) {
      console.warn("Music failed. Check URL:", getMusicUrl(), err);
      playing = false;
      if (buttonEl) buttonEl.textContent = "Lance la musique";
    }
  }

  // NEW: allow buttons.js to subscribe
  function onClose(fn) {
    closeListeners.add(fn);
    return () => closeListeners.delete(fn);
  }

  let stylesInjected = false;
  function injectStylesOnce() {
    if (stylesInjected) return;
    stylesInjected = true;

    const style = document.createElement("style");
    style.textContent = `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(0,0,0,0.55);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        opacity: 0;
        transform: translateY(6px);
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .modal-backdrop.open { opacity: 1; transform: translateY(0px); }

      .modal {
        width: min(640px, 92vw);
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,0.16);
        background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06));
        box-shadow: 0 24px 90px rgba(0,0,0,0.62);
        position: relative;
        overflow: hidden;
        padding: 18px 18px 14px;
      }

      .modal-glow {
        position: absolute;
        inset: -120px;
        background:
          radial-gradient(circle at 30% 25%, rgba(255,79,167,0.30), transparent 55%),
          radial-gradient(circle at 70% 70%, rgba(255,43,92,0.22), transparent 60%);
        filter: blur(40px);
        pointer-events: none;
        opacity: 0.7;
      }

      .modal-header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        position: relative;
        z-index: 1;
      }

      .modal-title {
        margin: 0;
        font-size: clamp(18px, 3.2vw, 24px);
        letter-spacing: -0.01em;
      }

      .modal-x {
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.9);
        border-radius: 12px;
        width: 40px;
        height: 40px;
        cursor: pointer;
        transition: transform 140ms ease, background 160ms ease;
      }
      .modal-x:hover { transform: translateY(-1px); background: rgba(255,255,255,0.10); }

      .modal-body {
        position: relative;
        z-index: 1;
        margin-top: 10px;
        color: rgba(255,255,255,0.82);
        line-height: 1.55;
        font-size: 15px;
      }

      .modal-actions {
        position: relative;
        z-index: 1;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 16px;
      }

      .modal-btn {
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.92);
        padding: 10px 14px;
        border-radius: 14px;
        cursor: pointer;
        font-weight: 700;
        letter-spacing: 0.02em;
        transition: transform 140ms ease, background 160ms ease, border-color 160ms ease;
        min-width: 140px;
      }
      .modal-btn:hover {
        transform: translateY(-1px);
        background: rgba(255,255,255,0.10);
        border-color: rgba(255,255,255,0.22);
      }
      .modal-btn:active { transform: translateY(0px) scale(0.98); }

      .modal-btn-primary {
        border-color: rgba(255,79,167,0.35);
        background: linear-gradient(180deg, rgba(255,79,167,0.22), rgba(255,43,92,0.12));
      }

      .modal-footnote {
        position: relative;
        z-index: 1;
        margin: 10px 0 0;
        color: rgba(255,255,255,0.55);
        font-size: 12px;
        word-break: break-all;
      }

      @media (max-width: 420px) {
        .modal-btn { min-width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  return {
    open,
    close,
    isOpen: () => isOpen,
    toggleMusic,
    onClose
  };
}

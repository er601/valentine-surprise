import "./style.css";

import { createHeartScene } from "./three/heartParticles.js";
import { createModal } from "./ui/modal.js";
import { setupButtons } from "./ui/buttons.js";

console.log("main.js loaded ✅");

const canvas3d = document.getElementById("bg3d");
const canvasFx = document.getElementById("fx");
const modalRoot = document.getElementById("modalRoot");

const modal = createModal(modalRoot);

const scene3d = createHeartScene({
  canvas: canvas3d
});

// Resize FX canvas to match viewport
function resizeFx() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasFx.width = Math.floor(window.innerWidth * dpr);
  canvasFx.height = Math.floor(window.innerHeight * dpr);
  canvasFx.style.width = "100%";
  canvasFx.style.height = "100%";
  const ctx = canvasFx.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeFx();

window.addEventListener("resize", () => {
  resizeFx();
  scene3d.resize();
}, { passive: true });

setupButtons({
  yesBtn: document.getElementById("btnYes"),
  noBtn: document.getElementById("btnNo"),
  fxCanvas: canvasFx,
  modal,
  onYes: () => {
    // Make the heart a little happier when YES is pressed
    scene3d.pulse();
  }
});

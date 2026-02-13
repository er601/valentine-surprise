import * as THREE from "three";

/**
 * HeartParticles scene:
 * - Points "assemble" from scattered positions to heart shape
 * - Additive glow + vertex colors (pink/red gradient)
 * - Background star dust
 * - Auto quality based on screen size
 *
 * No external assets, no models.
 */
export function createHeartScene({ canvas }) {
  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setClearColor(0x000000, 0); // transparent
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // Scene + camera
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 0, 32);

  // Gentle ambient + fake "glow" via points themselves
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  // Group for floating/rotating the heart
  const heartGroup = new THREE.Group();
  scene.add(heartGroup);

  // --- Quality / counts ---
  function computeQuality() {
    const w = window.innerWidth;
    // Desktop: 10k+ (requirement). Scale down for small screens.
    if (w >= 1100) return { heartCount: 12000, starsCount: 2200 };
    if (w >= 780) return { heartCount: 10000, starsCount: 1700 };
    if (w >= 520) return { heartCount: 6500, starsCount: 1200 };
    return { heartCount: 3800, starsCount: 900 };
  }

  let quality = computeQuality();

  // --- Heart target points (parametric) ---
  // A classic 2D heart curve:
  // x = 16 sin^3(t)
  // y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)
  // We'll create a 3D "volume" by extruding along z and distributing points.
  function heart2D(t) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      1 * Math.cos(4 * t);
    return { x, y };
  }

  /**
   * Generate points "inside" the heart area by:
   * - sample curve position
   * - scale inward by a random factor r^k to fill the interior
   * - add z thickness
   */
  function generateHeartTargets(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorA = new THREE.Color("#ff2b5c"); // red
    const colorB = new THREE.Color("#ff4fa7"); // pink

    // Heart scale
    const s = 0.22; // overall size
    const zThickness = 2.6;

    for (let i = 0; i < count; i++) {
      const t = Math.random() * Math.PI * 2;
      const p = heart2D(t);

      // Fill interior: r in [0..1], use power to bias points towards boundary a bit
      const r = Math.pow(Math.random(), 0.55);
      const x = p.x * r * s;
      const y = p.y * r * s;

      // Thickness (more dense near center)
      const z = (Math.random() * 2 - 1) * zThickness * Math.pow(1 - r, 0.2);

      // Slight organic jitter
      const j = 0.08;
      positions[i * 3 + 0] = x + (Math.random() * 2 - 1) * j;
      positions[i * 3 + 1] = y + (Math.random() * 2 - 1) * j;
      positions[i * 3 + 2] = z + (Math.random() * 2 - 1) * j;

      // Gradient color by height (y) and some randomness
      // Normalize y into [0..1] roughly
      const yn = THREE.MathUtils.clamp((y + 3) / 6, 0, 1);
      const c = colorA.clone().lerp(colorB, yn * 0.85 + Math.random() * 0.15);

      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    return { positions, colors };
  }

  // --- Animated assembly system ---
  let heartMesh = null;
  let heartGeo = null;

  // Per-particle state
  let currentPositions = null;
  let velocities = null;
  let targetPositions = null;

  // Assembly progress
  let assembled = false;
  let assembleAmount = 0; // 0..1

  // Heart points material (additive glow)
  const heartMaterial = new THREE.PointsMaterial({
    size: 0.085,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });

  function createOrRebuildHeart() {
    quality = computeQuality();

    const { positions: targets, colors } = generateHeartTargets(quality.heartCount);
    targetPositions = targets;

    // Start positions scattered in a sphere
    currentPositions = new Float32Array(quality.heartCount * 3);
    velocities = new Float32Array(quality.heartCount * 3);

    const spread = 26;
    for (let i = 0; i < quality.heartCount; i++) {
      // random point in sphere-ish
      const rx = (Math.random() * 2 - 1);
      const ry = (Math.random() * 2 - 1);
      const rz = (Math.random() * 2 - 1);
      const len = Math.max(Math.sqrt(rx * rx + ry * ry + rz * rz), 0.0001);
      const k = Math.pow(Math.random(), 0.35) * spread;

      currentPositions[i * 3 + 0] = (rx / len) * k;
      currentPositions[i * 3 + 1] = (ry / len) * k;
      currentPositions[i * 3 + 2] = (rz / len) * k;

      velocities[i * 3 + 0] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
    }

    if (heartMesh) {
      heartGroup.remove(heartMesh);
      heartGeo.dispose();
    }

    heartGeo = new THREE.BufferGeometry();
    heartGeo.setAttribute("position", new THREE.BufferAttribute(currentPositions, 3));
    heartGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    heartMesh = new THREE.Points(heartGeo, heartMaterial);
    heartGroup.add(heartMesh);

    assembled = false;
    assembleAmount = 0;
  }

  // --- Background "dust" stars ---
  let stars = null;
  const starsMaterial = new THREE.PointsMaterial({
    size: 0.06,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });

  function buildStars() {
    const count = quality.starsCount;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const c1 = new THREE.Color("#8aa0ff");
    const c2 = new THREE.Color("#ff9ad0");
    const radius = 85;

    for (let i = 0; i < count; i++) {
      // random in a large sphere shell
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);

      const r = radius * (0.55 + Math.random() * 0.45);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      pos[i * 3 + 0] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const mix = Math.random() * 0.6 + 0.2;
      const c = c1.clone().lerp(c2, mix);

      // dim most stars a bit randomly
      const dim = 0.4 + Math.random() * 0.6;
      col[i * 3 + 0] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

    const pts = new THREE.Points(geo, starsMaterial);
    pts.position.z = -20;
    return pts;
  }

  function createOrRebuildStars() {
    if (stars) {
      scene.remove(stars);
      stars.geometry.dispose();
    }
    stars = buildStars();
    scene.add(stars);
  }

  // Initialize
  createOrRebuildHeart();
  createOrRebuildStars();

  // Resize
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // If quality bucket changed, rebuild
    const q2 = computeQuality();
    if (q2.heartCount !== quality.heartCount || q2.starsCount !== quality.starsCount) {
      createOrRebuildHeart();
      createOrRebuildStars();
    }
  }
  resize();

  // Helpers
  let lastT = performance.now();
  let time = 0;

  // Public: pulse effect after YES
  let pulseBoost = 0;
  function pulse() {
    // small impulse that temporarily increases float + rotation speed
    pulseBoost = Math.min(pulseBoost + 1.2, 2.5);
  }

  function tick(now) {
    const dt = Math.min((now - lastT) / 1000, 0.033);
    lastT = now;
    time += dt;

    // --- Animate stars slowly for atmosphere ---
    if (stars) {
      stars.rotation.y += dt * 0.02;
      stars.rotation.x += dt * 0.006;
    }

    // --- Assembly simulation ---
    // A smooth "magnetic" attraction with damping.
    // We also raise strength as assembleAmount increases.
    if (!assembled) {
      assembleAmount = Math.min(assembleAmount + dt * 0.22, 1);

      const strength = 4.2 + assembleAmount * 10.0;
      const damp = 0.86; // velocity damping
      const snap = 0.0022; // little snap to reduce jitter at the end

      const posAttr = heartGeo.getAttribute("position");

      let avgDist = 0;

      for (let i = 0; i < quality.heartCount; i++) {
        const ix = i * 3;

        const px = currentPositions[ix + 0];
        const py = currentPositions[ix + 1];
        const pz = currentPositions[ix + 2];

        const tx = targetPositions[ix + 0];
        const ty = targetPositions[ix + 1];
        const tz = targetPositions[ix + 2];

        const dx = tx - px;
        const dy = ty - py;
        const dz = tz - pz;

        // Move towards target with speed scaled by assembleAmount (ease-in)
        const ax = dx * strength * dt;
        const ay = dy * strength * dt;
        const az = dz * strength * dt;

        velocities[ix + 0] = (velocities[ix + 0] + ax) * damp;
        velocities[ix + 1] = (velocities[ix + 1] + ay) * damp;
        velocities[ix + 2] = (velocities[ix + 2] + az) * damp;

        currentPositions[ix + 0] = px + velocities[ix + 0] + dx * snap * assembleAmount;
        currentPositions[ix + 1] = py + velocities[ix + 1] + dy * snap * assembleAmount;
        currentPositions[ix + 2] = pz + velocities[ix + 2] + dz * snap * assembleAmount;

        avgDist += Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      }

      posAttr.needsUpdate = true;

      // Determine assembled state when close enough
      const mean = avgDist / quality.heartCount;
      if (assembleAmount > 0.98 && mean < 0.09) {
        assembled = true;
      }
    }

    // --- Post-assembly float + rotation ---
    const boost = pulseBoost;
    pulseBoost = Math.max(0, pulseBoost - dt * 0.9);

    // Levitation (gentle)
    const floatAmp = 0.55 + boost * 0.18;
    const floatSpeed = 1.1 + boost * 0.35;

    heartGroup.position.y = Math.sin(time * floatSpeed) * floatAmp;

    // Rotation (yaw + small roll)
    const rotBase = 0.22 + boost * 0.10;
    heartGroup.rotation.y += dt * rotBase;
    heartGroup.rotation.z = Math.sin(time * 0.7) * (0.10 + boost * 0.02);

    // Subtle camera breathing
    camera.position.z = 32 + Math.sin(time * 0.3) * 0.35;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return {
    resize,
    pulse,
    destroy() {
      renderer.dispose();
      if (heartGeo) heartGeo.dispose();
      if (stars) stars.geometry.dispose();
    }
  };
}

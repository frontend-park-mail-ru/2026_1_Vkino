/**
 * @fileoverview Плавная анимация открытия бутылки на странице регистрации.
 */

const PARTICLE_POOL_SIZE = 140;
const EMISSION_RATE = 95;
const PRESSURE_DELAY_MS = 150;
const OPEN_DURATION_MS = 820;
const SPRAY_DURATION_MS = 1680;
const TOTAL_DURATION_MS = PRESSURE_DELAY_MS + OPEN_DURATION_MS + SPRAY_DURATION_MS;
const NOZZLE_X = 0.496;
const NOZZLE_Y = 0.053;
const BASE_BOTTLE_ROTATION_DEG = 45;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const mix = (from, to, progress) => from + (to - from) * progress;
const randomBetween = (min, max) => min + Math.random() * (max - min);

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

const createParticle = () => ({
  active: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  gravity: 0,
  drag: 1,
  life: 0,
  maxLife: 0,
  size: 0,
  alpha: 0,
  stretch: 1,
  type: "spray",
});

const waitForImage = (image) => {
  if (!image) {
    return Promise.resolve();
  }

  if (image.complete && image.naturalWidth > 0) {
    return typeof image.decode === "function"
      ? image.decode().catch(() => {})
      : Promise.resolve();
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleLoad);
    };

    const handleLoad = () => {
      cleanup();
      if (typeof image.decode === "function") {
        image.decode().catch(() => {}).finally(resolve);
        return;
      }
      resolve();
    };

    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleLoad, { once: true });
  });
};

/**
 * Инициализирует анимацию бутылки в блоке регистрации.
 *
 * @param {ParentNode|null} root Корневой элемент страницы регистрации.
 * @returns {() => void} Функция очистки обработчиков и анимации.
 */
export const initRegisterBottleEffect = (root) => {
  if (!root) {
    return () => {};
  }

  const scene = root.querySelector("[data-bottle-scene]");
  const bottle = root.querySelector("[data-bottle]");
  const bodyImage = root.querySelector("[data-bottle-body]");
  const cap = root.querySelector("[data-bottle-cap]");
  const canvas = root.querySelector("[data-bottle-fx]");

  if (!scene || !bottle || !bodyImage || !cap || !canvas) {
    return () => {};
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return () => {};
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const particles = Array.from({ length: PARTICLE_POOL_SIZE }, createParticle);
  const emitter = { carry: 0 };
  const state = {
    ready: false,
    phase: "idle",
    interactionStart: 0,
    rafId: 0,
    lastFrameTime: 0,
    idleTime: 0,
    dpr: 1,
    reducedMotion: prefersReducedMotion.matches,
  };

  bottle.dataset.ready = "false";

  const resizeCanvas = () => {
    const rect = scene.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    state.dpr = dpr;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const getBottleMetrics = () => {
    const sceneRect = scene.getBoundingClientRect();
    const bottleRect = bottle.getBoundingClientRect();

    return {
      x: bottleRect.left - sceneRect.left,
      y: bottleRect.top - sceneRect.top,
      width: bottleRect.width,
      height: bottleRect.height,
    };
  };

  const getNozzlePoint = () => {
    const metrics = getBottleMetrics();
    return {
      x: metrics.x + metrics.width * NOZZLE_X,
      y: metrics.y + metrics.height * NOZZLE_Y,
    };
  };

  const clearParticles = () => {
    particles.forEach((particle) => {
      particle.active = false;
    });
    emitter.carry = 0;
  };

  const resetBottleStyles = () => {
    bottle.style.transform =
      `translate3d(0, 0, 0) rotate(${BASE_BOTTLE_ROTATION_DEG}deg) scale(1)`;
    cap.style.transform = "translate3d(0, 0, 0) rotate(20deg) scale(1)";
    cap.style.opacity = "1";
    cap.style.visibility = "visible";
  };

  const setShadowStyle = (scaleX, scaleY, opacity) => {
    const shadow = bottle.querySelector(".bottle__shadow");
    if (!shadow) {
      return;
    }

    shadow.style.transform = `translateX(-50%) scale(${scaleX}, ${scaleY})`;
    shadow.style.opacity = String(opacity);
  };

  const spawnParticle = (origin, strength, bubbleBias = 0.18) => {
    const particle = particles.find((item) => !item.active);
    if (!particle) {
      return;
    }

    const spread = state.reducedMotion ? 0.2 : 0.33;
    const angle = -Math.PI / 2 + randomBetween(-spread, spread);
    const speed = randomBetween(220, 520) * strength;
    const bubble = Math.random() < bubbleBias;

    particle.active = true;
    particle.type = bubble ? "bubble" : "spray";
    particle.x = origin.x + randomBetween(-4, 4);
    particle.y = origin.y + randomBetween(-2, 2);
    particle.vx = Math.cos(angle) * speed + randomBetween(-24, 24);
    particle.vy = Math.sin(angle) * speed - randomBetween(12, 64);
    particle.gravity = bubble ? randomBetween(90, 180) : randomBetween(420, 620);
    particle.drag = bubble ? 0.992 : 0.984;
    particle.maxLife = bubble ? randomBetween(0.7, 1.15) : randomBetween(0.45, 0.92);
    particle.life = particle.maxLife;
    particle.size = bubble ? randomBetween(2, 5.4) : randomBetween(2.5, 6.8);
    particle.alpha = bubble ? randomBetween(0.18, 0.34) : randomBetween(0.62, 0.9);
    particle.stretch = bubble ? 1 : randomBetween(1.1, 1.95);
  };

  const emitParticles = (origin, dt, intensity) => {
    const rate = EMISSION_RATE * intensity * (state.reducedMotion ? 0.48 : 1);
    emitter.carry += rate * dt;

    while (emitter.carry >= 1) {
      emitter.carry -= 1;
      spawnParticle(origin, mix(0.72, 1.22, intensity));
    }
  };

  const drawParticle = (particle) => {
    const lifeProgress = 1 - particle.life / particle.maxLife;
    const alpha = particle.alpha * (1 - lifeProgress);
    if (alpha <= 0) {
      return;
    }

    context.save();
    context.globalAlpha = alpha;
    context.translate(particle.x, particle.y);

    if (particle.type === "bubble") {
      context.beginPath();
      context.arc(0, 0, particle.size, 0, Math.PI * 2);
      context.fillStyle = "rgba(255, 245, 226, 0.16)";
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = "rgba(255, 255, 255, 0.4)";
      context.stroke();
      context.restore();
      return;
    }

    const angle = Math.atan2(particle.vy, particle.vx) + Math.PI / 2;
    context.rotate(angle);

    const radiusX = particle.size;
    const radiusY = particle.size * particle.stretch;
    const gradient = context.createRadialGradient(
      -radiusX * 0.2,
      -radiusY * 0.25,
      0,
      0,
      0,
      radiusY,
    );

    gradient.addColorStop(0, "rgba(255, 246, 225, 0.95)");
    gradient.addColorStop(0.32, "rgba(255, 219, 140, 0.92)");
    gradient.addColorStop(0.72, "rgba(255, 149, 79, 0.7)");
    gradient.addColorStop(1, "rgba(188, 52, 24, 0.06)");

    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();

    context.restore();
  };

  const updateParticles = (dt) => {
    context.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((particle) => {
      if (!particle.active) {
        return;
      }

      particle.vx *= Math.pow(particle.drag, dt * 60);
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;

      if (particle.life <= 0) {
        particle.active = false;
        return;
      }

      drawParticle(particle);
    });
  };

  const updateIdleBottle = (timeMs) => {
    const swing = Math.sin(timeMs * 0.0014);
    const float = Math.sin(timeMs * 0.0021 + 1.2);
    const rotate = swing * 2.2;
    const translateY = float * -5;
    const scale = 1 + Math.sin(timeMs * 0.0017) * 0.004;

    bottle.style.transform =
      `translate3d(0, ${translateY}px, 0) rotate(${BASE_BOTTLE_ROTATION_DEG + rotate}deg) scale(${scale})`;
    setShadowStyle(1 + swing * 0.045, 1 - Math.abs(swing) * 0.06, 0.84 - Math.abs(swing) * 0.1);
    cap.style.transform = "translate3d(0, 0, 0) rotate(20deg) scale(1)";
    cap.style.opacity = "1";
  };

  const updateOpeningBottle = (elapsed) => {
    const pressureProgress = clamp(elapsed / PRESSURE_DELAY_MS, 0, 1);
    const openingElapsed = Math.max(0, elapsed - PRESSURE_DELAY_MS);
    const openingProgress = clamp(openingElapsed / OPEN_DURATION_MS, 0, 1);
    const pressurePhase = elapsed < PRESSURE_DELAY_MS;

    let rotate = 0;
    let translateY = 0;
    let scale = 1;
    let shadowX = 1;
    let shadowY = 1;
    let shadowOpacity = 0.82;

    if (pressurePhase) {
      const jitter = Math.sin(pressureProgress * Math.PI * 5.4) * (1 - pressureProgress);
      rotate = jitter * 2.3;
      translateY = pressureProgress * 3;
      scale = 1 - pressureProgress * 0.012;
      shadowX = 1 + pressureProgress * 0.1;
      shadowY = 1 - pressureProgress * 0.08;
      shadowOpacity = 0.78;
    } else {
      const recoil = Math.sin(Math.min(openingProgress, 1) * Math.PI);
      rotate = mix(-5.2, 0.8, easeOutCubic(openingProgress)) + Math.sin(openingProgress * 10) * 0.35 * (1 - openingProgress);
      translateY = mix(8, -2, easeOutCubic(openingProgress)) - recoil * 4;
      scale = 1 + Math.sin(openingProgress * Math.PI) * 0.016;
      shadowX = mix(1.12, 1, openingProgress);
      shadowY = mix(0.88, 1, openingProgress);
      shadowOpacity = mix(0.7, 0.82, openingProgress);
    }

    bottle.style.transform =
      `translate3d(0, ${translateY}px, 0) rotate(${BASE_BOTTLE_ROTATION_DEG + rotate}deg) scale(${scale})`;
    setShadowStyle(shadowX, shadowY, shadowOpacity);

    if (!pressurePhase) {
      const capProgress = clamp(openingElapsed / (OPEN_DURATION_MS + 240), 0, 1);
      const arcX = mix(0, 124, easeOutBack(capProgress));
      const arcY = mix(0, -182, easeOutCubic(capProgress)) + Math.pow(capProgress, 2) * 112;
      const rotation = mix(20, 288, capProgress);
      const scaleCap = mix(1, 0.9, capProgress);
      const opacity = 1 - easeInCubic(clamp((capProgress - 0.52) / 0.48, 0, 1));

      cap.style.transform = `translate3d(${arcX}px, ${arcY}px, 0) rotate(${rotation}deg) scale(${scaleCap})`;
      cap.style.opacity = String(opacity);
      cap.style.visibility = opacity <= 0.02 ? "hidden" : "visible";
    }
  };

  const updateOpenedBottle = (elapsed) => {
    const settle = clamp((elapsed - (PRESSURE_DELAY_MS + OPEN_DURATION_MS)) / 420, 0, 1);
    const wobble = Math.sin(settle * Math.PI * 2) * (1 - settle) * 0.45;

    bottle.style.transform =
      `translate3d(0, ${wobble * -1.4}px, 0) rotate(${BASE_BOTTLE_ROTATION_DEG + wobble}deg) scale(1)`;
    setShadowStyle(1, 1, 0.82);
    cap.style.opacity = "0";
    cap.style.visibility = "hidden";
  };

  const resetScene = () => {
    state.phase = "idle";
    state.interactionStart = 0;
    clearParticles();
    resetBottleStyles();
    setShadowStyle(1, 1, 0.82);
    bottle.ariaLabel = "Открыть бутылку";
  };

  const startInteraction = (timeMs) => {
    if (!state.ready || state.phase !== "idle") {
      return;
    }

    state.phase = "opening";
    state.interactionStart = timeMs;
    emitter.carry = 0;
    bottle.ariaLabel = "Бутылка открывается";
  };

  const updateScene = (timeMs, dt) => {
    if (state.phase === "idle") {
      updateIdleBottle(timeMs);
      return;
    }

    const elapsed = timeMs - state.interactionStart;
    const sprayStart = PRESSURE_DELAY_MS + 120;
    const sprayElapsed = elapsed - sprayStart;

    updateOpeningBottle(elapsed);

    if (sprayElapsed >= 0 && elapsed <= TOTAL_DURATION_MS) {
      const sprayProgress = clamp(sprayElapsed / SPRAY_DURATION_MS, 0, 1);
      const burst = 1 - Math.pow(1 - clamp(sprayProgress / 0.16, 0, 1), 2);
      const decay = 1 - easeInOutSine(sprayProgress);
      const intensity = clamp(Math.max(burst, decay * 0.82), 0.18, 1);
      emitParticles(getNozzlePoint(), dt, intensity);
    }

    if (elapsed >= TOTAL_DURATION_MS) {
      state.phase = "opened";
      bottle.ariaLabel = "Анимация завершена";
    }

    if (state.phase === "opened") {
      updateOpenedBottle(elapsed);
    }
  };

  const frame = (timeMs) => {
    if (!state.lastFrameTime) {
      state.lastFrameTime = timeMs;
    }

    const dt = Math.min((timeMs - state.lastFrameTime) / 1000, 0.032);
    state.lastFrameTime = timeMs;
    state.idleTime += dt;

    updateScene(timeMs, dt);
    updateParticles(dt);

    state.rafId = window.requestAnimationFrame(frame);
  };

  const handleBottleClick = () => {
    startInteraction(performance.now());
  };

  const handleResize = () => {
    resizeCanvas();
  };

  const handleMotionPreference = () => {
    state.reducedMotion = prefersReducedMotion.matches;
    clearParticles();

    if (state.phase !== "idle") {
      resetScene();
    }
  };

  Promise.all([waitForImage(bodyImage), waitForImage(cap)]).finally(() => {
    resizeCanvas();
    state.ready = true;
    bottle.dataset.ready = "true";
    resetScene();
  });

  window.addEventListener("resize", handleResize);
  bottle.addEventListener("click", handleBottleClick);

  if (typeof prefersReducedMotion.addEventListener === "function") {
    prefersReducedMotion.addEventListener("change", handleMotionPreference);
  }

  state.rafId = window.requestAnimationFrame(frame);

  return () => {
    window.removeEventListener("resize", handleResize);
    bottle.removeEventListener("click", handleBottleClick);

    if (typeof prefersReducedMotion.removeEventListener === "function") {
      prefersReducedMotion.removeEventListener("change", handleMotionPreference);
    }

    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    clearParticles();
  };
};

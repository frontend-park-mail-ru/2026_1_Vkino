/**
 * @fileoverview Эффект "взрыва" бутылки на странице регистрации.
 */

interface OriginPoint {
  x: number;
  y: number;
}

interface BaseEffectParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  drag: number;
  r: number;
  op: number;
  life: number;
  decay: number;
}

interface DropParticle extends BaseEffectParticle {
  t: "d";
  cr: number;
  cg: number;
  cb: number;
  stretch: number;
}

interface BubbleParticle extends BaseEffectParticle {
  t: "b";
}

type EffectParticle = DropParticle | BubbleParticle;

/**
 * Инициализирует интерактивный canvas-эффект для блока регистрации.
 *
 * @param {ParentNode|null} root Корневой элемент страницы регистрации.
 * @returns {() => void} Функция очистки обработчиков и состояния эффекта.
 */
export const initRegisterBottleEffect = (root: ParentNode | null) => {
  if (!root) {
    return () => {};
  }

  let exploded = false;

  const scene = root.querySelector<HTMLElement>("#scene");
  const bw = root.querySelector<HTMLElement>("#bw");
  const stream = root.querySelector<HTMLElement>("#stream");
  const puddle = root.querySelector<HTMLElement>("#puddle");
  const capGroup = root.querySelector<HTMLElement>("#capG");
  const canvas = root.querySelector<HTMLCanvasElement>("#fx");

  if (!scene || !bw || !stream || !puddle || !capGroup || !canvas) {
    return () => {};
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return () => {};
  }

  /** @type {EffectParticle[]} */
  let pts: EffectParticle[] = [];
  let rafId: number | null = null;
  let last: number | null = null;

  const rand = (a: number, b: number): number => a + Math.random() * (b - a);

  /**
   * Подгоняет размер canvas под окно.
   *
   * @returns {void}
   */
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  /**
   * Вычисляет точку вылета частиц из горлышка бутылки.
   *
   * @returns {OriginPoint}
   */
  const getOrigin = () => {
    const ANGLE = (30 * Math.PI) / 180;
    const H = scene.offsetHeight;
    const r = bw.getBoundingClientRect();
    const cx = r.left + r.width * 0.5;
    const cy = r.top + r.height * 0.5;

    return {
      x: cx + H * 0.455 * Math.sin(ANGLE),
      y: cy - H * 0.455 * Math.cos(ANGLE),
    };
  };

  /**
   * Создает частицу-каплю.
   *
   * @param {OriginPoint} o
   * @returns {void}
   */
  const mkDrop = (o: OriginPoint) => {
    const core = Math.random() < 0.68;
    const deg = core ? rand(-128, 8) : rand(-145, 25);
    const rad = (deg * Math.PI) / 180;
    const spd = rand(170, 460);
    const r = rand(2.5, 9.5);
    const br = rand(0, 1);

    pts.push({
      t: "d",
      x: o.x + rand(-6, 6),
      y: o.y + rand(-3, 3),
      vx: Math.cos(rad) * spd,
      vy: Math.sin(rad) * spd,
      ay: rand(270, 370),
      drag: 0.87,
      r,
      cr: (60 + br * 75) | 0,
      cg: (2 + br * 10) | 0,
      cb: (2 + br * 8) | 0,
      op: rand(0.78, 1),
      life: 1,
      decay: rand(0.5, 0.88),
      stretch: rand(1, 2.1),
    });
  };

  /**
   * Создает частицу-пузырь.
   *
   * @param {OriginPoint} o
   * @returns {void}
   */
  const mkBub = (o: OriginPoint) => {
    const deg = rand(-132, 12);
    const rad = (deg * Math.PI) / 180;
    const spd = rand(80, 300);

    pts.push({
      t: "b",
      x: o.x + rand(-5, 5),
      y: o.y + rand(-3, 3),
      vx: Math.cos(rad) * spd,
      vy: Math.sin(rad) * spd,
      ay: rand(90, 190),
      drag: 0.91,
      r: rand(2, 8.5),
      op: rand(0.55, 0.95),
      life: 1,
      decay: rand(0.33, 0.65),
    });
  };

  /**
   * Рендерит каплю.
   *
   * @param {EffectParticle} p
   * @param {number} a Текущая прозрачность.
   * @returns {void}
   */
  const drawDrop = (p: DropParticle, a: number) => {
    ctx.save();
    ctx.globalAlpha = a;

    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const ang = Math.atan2(p.vy, p.vx);
    const el = 1 + Math.min(spd / 270, 1.6) * (p.stretch - 1);

    ctx.translate(p.x, p.y);
    ctx.rotate(ang + Math.PI / 2);

    const rx = p.r;
    const ry = p.r * el;

    const g = ctx.createRadialGradient(
      -rx * 0.28,
      -ry * 0.26,
      0,
      0,
      0,
      Math.max(rx, ry) * 1.1,
    );

    const hlR = Math.min(255, p.cr + 130);
    const hlG = Math.min(255, p.cg + 55);
    const hlB = Math.min(255, p.cb + 25);

    g.addColorStop(0, `rgba(${hlR},${hlG},${hlB},.92)`);
    g.addColorStop(0.38, `rgba(${p.cr},${p.cg},${p.cb},.95)`);
    g.addColorStop(
      0.82,
      `rgba(${(p.cr * 0.55) | 0},${(p.cg * 0.45) | 0},0,.65)`,
    );
    g.addColorStop(1, `rgba(${(p.cr * 0.3) | 0},0,0,.15)`);

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(
      -rx * 0.22,
      -ry * 0.28,
      rx * 0.33,
      ry * 0.18,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = "rgba(255,255,255,.52)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-rx * 0.08, -ry * 0.1, rx * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fill();

    ctx.restore();
  };

  /**
   * Рендерит пузырь.
   *
   * @param {EffectParticle} p
   * @param {number} a Текущая прозрачность.
   * @returns {void}
   */
  const drawBub = (p: BubbleParticle, a: number) => {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);

    const r = p.r;
    const rim = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r);

    rim.addColorStop(0, "rgba(140,185,255,0)");
    rim.addColorStop(0.7, "rgba(170,210,255,.08)");
    rim.addColorStop(0.87, "rgba(205,232,255,.48)");
    rim.addColorStop(1, "rgba(255,255,255,.82)");

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = rim;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(55,4,2,.1)";
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-r * 0.26, -r * 0.3, r * 0.42, r * 0.23, -0.42, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(r * 0.18, r * 0.36, r * 0.18, r * 0.1, 0.38, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(155,115,255,.2)";
    ctx.lineWidth = r * 0.22;
    ctx.stroke();

    ctx.restore();
  };

  /**
   * Обновляет физику частиц и перерисовывает кадр.
   *
   * @param {number} ts Timestamp requestAnimationFrame.
   * @returns {void}
   */
  const loop = (ts: number) => {
    if (!last) {
      last = ts;
    }

    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    pts = pts.filter((p) => p.life > 0.012);

    for (const p of pts) {
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy += p.ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;

      const a = Math.max(0, p.life) * p.op;
      p.t === "d" ? drawDrop(p, a) : drawBub(p, a);
    }

    rafId = pts.length ? requestAnimationFrame(loop) : null;

    if (!pts.length) {
      last = null;
    }
  };

  /**
   * Запускает сценарий генерации капель/пузырей.
   *
   * @returns {void}
   */
  const boom = () => {
    const o = getOrigin();

    for (let i = 0; i < 70; i++) {
      setTimeout(() => mkDrop(o), i * 16);
    }

    for (let i = 0; i < 40; i++) {
      setTimeout(() => mkBub(o), i * 20 + 25);
    }

    for (let i = 0; i < 22; i++) {
      setTimeout(() => mkDrop(o), 300 + i * 28);
    }

    if (!rafId) {
      rafId = requestAnimationFrame(loop);
    }
  };

  /**
   * Обрабатывает первый клик по сцене и запускает эффект.
   *
   * @returns {void}
   */
  const handleSceneClick = () => {
    if (exploded) {
      return;
    }

    exploded = true;
    scene.classList.add("exploded");
    bw.classList.add("shake");

    setTimeout(() => {
      capGroup.style.display = "none";
      stream.classList.add("gush");
      puddle.classList.add("spread");
      boom();
    }, 430);
  };

  resize();

  window.addEventListener("resize", resize);
  scene.addEventListener("click", handleSceneClick);

  return () => {
    window.removeEventListener("resize", resize);
    scene.removeEventListener("click", handleSceneClick);

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    pts = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
};

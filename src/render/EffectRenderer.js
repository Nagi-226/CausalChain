class EffectRenderer {
  constructor(options) {
    const opts = options || {};
    this.particles = [];
    this.ripples = [];
    this.celebrations = [];
    this.baseMaxParticles = opts.maxParticles || 180;
    this.reducedMotion = Boolean(opts.reducedMotion);
    this.maxParticles = this.reducedMotion ? Math.min(72, this.baseMaxParticles) : this.baseMaxParticles;
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
    this.maxParticles = this.reducedMotion ? Math.min(72, this.baseMaxParticles) : this.baseMaxParticles;
    if (this.particles.length > this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles);
    }
    if (this.reducedMotion) {
      this.ripples = [];
      this.celebrations = [];
    }
  }

  update(dt, time) {
    const delta = Math.min(50, dt || 16.67) / 1000;
    const now = time || defaultNow();
    const particles = [];
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      p.age = now - p.start;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += p.gravity * delta;
      if (p.age < p.life) {
        particles.push(p);
      }
    }
    this.particles = particles;
    this.ripples = this.ripples.filter((r) => now - r.start < r.duration);
    this.celebrations = this.celebrations.filter((c) => now - c.start < c.duration);
  }

  draw(ctx, layout) {
    if (!ctx) {
      return;
    }
    this.drawRipples(ctx);
    this.drawParticles(ctx);
    this.drawCelebrations(ctx, layout);
  }

  burstParticles(x, y, color, count, options) {
    const opts = options || {};
    const total = this.reducedMotion ? Math.max(4, Math.floor((count || 18) * 0.45)) : (count || 18);
    const now = defaultNow();
    for (let i = 0; i < total; i += 1) {
      const angle = (Math.PI * 2 * i) / total + randomRange(-0.22, 0.22);
      const speed = randomRange(opts.minSpeed || 80, opts.maxSpeed || 230);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        size: randomRange(2, 5),
        color: color || '#f8fafc',
        start: now,
        age: 0,
        life: randomRange(420, 760),
        gravity: opts.gravity || 280
      });
    }
    if (this.particles.length > this.maxParticles) {
      this.particles.splice(0, this.particles.length - this.maxParticles);
    }
  }

  addRipple(x, y, color, options) {
    const opts = options || {};
    if (this.reducedMotion) {
      return;
    }
    this.ripples.push({
      x,
      y,
      color: color || '#93c5fd',
      start: defaultNow(),
      duration: opts.duration || 520,
      radius: opts.radius || 80,
      lineWidth: opts.lineWidth || 3
    });
  }

  playCelebration(rect, options) {
    const opts = options || {};
    const now = defaultNow();
    if (this.reducedMotion) {
      return;
    }
    this.celebrations.push({
      rect: rect || { x: 0, y: 0, width: 375, height: 667 },
      start: now,
      duration: opts.duration || 1800
    });
    const area = rect || { x: 0, y: 0, width: 375, height: 667 };
    for (let i = 0; i < 42; i += 1) {
      this.particles.push({
        x: area.x + randomRange(0, area.width),
        y: area.y + randomRange(0, area.height * 0.18),
        vx: randomRange(-45, 45),
        vy: randomRange(80, 210),
        size: randomRange(2, 5),
        color: ['#fde68a', '#93c5fd', '#86efac', '#fca5a5'][i % 4],
        start: now,
        age: 0,
        life: randomRange(1100, 1800),
        gravity: 80
      });
    }
  }

  drawParticles(ctx) {
    ctx.save();
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      const progress = clamp01(p.age / p.life);
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - progress * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawRipples(ctx) {
    const now = defaultNow();
    ctx.save();
    for (let i = 0; i < this.ripples.length; i += 1) {
      const r = this.ripples[i];
      const progress = clamp01((now - r.start) / r.duration);
      ctx.globalAlpha = (1 - progress) * 0.72;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lineWidth * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * easeOutCubic(progress), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCelebrations(ctx, layout) {
    const now = defaultNow();
    ctx.save();
    for (let i = 0; i < this.celebrations.length; i += 1) {
      const c = this.celebrations[i];
      const p = clamp01((now - c.start) / c.duration);
      const rect = c.rect || layout || { x: 0, y: 0, width: 375, height: 667 };
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.36;
      const gradient = ctx.createRadialGradient
        ? ctx.createRadialGradient(rect.x + rect.width / 2, rect.y + rect.height / 2, 12, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width * 0.75)
        : null;
      if (gradient && gradient.addColorStop) {
        gradient.addColorStop(0, '#fef3c7');
        gradient.addColorStop(1, 'rgba(254,243,199,0)');
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = '#fef3c7';
      }
      ctx.fillRect(rect.x - 20, rect.y - 20, rect.width + 40, rect.height + 40);
    }
    ctx.restore();
  }
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function defaultNow() {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(t) {
  const p = 1 - t;
  return 1 - p * p * p;
}

module.exports = EffectRenderer;

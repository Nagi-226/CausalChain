const DEFAULT_COLORS = {
  mask: 'rgba(4, 8, 16, 0.58)',
  bubble: 'rgba(248, 251, 255, 0.96)',
  text: '#14213D',
  muted: '#5C677D',
  accent: '#FFD166',
  cutout: 'rgba(255, 255, 255, 0.18)'
};

function readString(strings, key) {
  return key.split('.').reduce((node, part) => {
    if (!node || typeof node !== 'object') return undefined;
    return node[part];
  }, strings) || key;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split('');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

class Tutorial {
  constructor(options = {}) {
    this.tutorials = options.tutorials || {};
    this.strings = options.strings || {};
    this.colors = { ...DEFAULT_COLORS, ...(options.colors || {}) };
    this.width = options.width || 375;
    this.height = options.height || 667;
    this.active = false;
    this.tutorialId = null;
    this.steps = [];
    this.index = 0;
    this.elapsedMs = 0;
    this.boardRect = options.boardRect || null;
    this.cellSize = options.cellSize || 48;
    this.nextButton = null;
    this.skipButton = null;
  }

  setStrings(strings) {
    this.strings = strings || {};
  }

  setTutorials(tutorials) {
    this.tutorials = tutorials || {};
  }

  setLayout(width, height, options = {}) {
    this.width = width;
    this.height = height;
    if (options.boardRect) this.boardRect = options.boardRect;
    if (options.cellSize) this.cellSize = options.cellSize;
  }

  t(key) {
    return readString(this.strings, key);
  }

  getTutorial(id) {
    if (!id) return null;
    if (this.tutorials.tutorials && this.tutorials.tutorials[id]) return this.tutorials.tutorials[id];
    return this.tutorials[id] || null;
  }

  start(tutorialId) {
    const tutorial = this.getTutorial(tutorialId);
    if (!tutorial || !tutorial.steps || tutorial.steps.length === 0) {
      this.active = false;
      return false;
    }
    this.active = true;
    this.tutorialId = tutorialId;
    this.steps = tutorial.steps;
    this.index = 0;
    this.elapsedMs = 0;
    return true;
  }

  startForLevel(level) {
    return this.start(level && level.tutorialId);
  }

  stop() {
    const id = this.tutorialId;
    this.active = false;
    this.tutorialId = null;
    this.steps = [];
    this.index = 0;
    return { type: 'tutorial.close', tutorialId: id };
  }

  next() {
    if (!this.active) return null;
    if (this.index >= this.steps.length - 1) return this.stop();
    this.index += 1;
    this.elapsedMs = 0;
    return { type: 'tutorial.next', tutorialId: this.tutorialId, index: this.index };
  }

  update(dt = 0, gameState = {}) {
    if (!this.active) return null;
    this.elapsedMs += dt;
    const step = this.steps[this.index];
    if (step && step.advance === 'state' && gameState[step.when] === step.equals) {
      return this.next();
    }
    return null;
  }

  resolveHighlight(step) {
    if (!step || !step.highlight) return null;
    const h = step.highlight;
    if (h.type === 'rect') return { ...h.rect };
    if (h.type === 'cell' && this.boardRect) {
      return {
        x: this.boardRect.x + h.col * this.cellSize,
        y: this.boardRect.y + h.row * this.cellSize,
        width: this.cellSize,
        height: this.cellSize
      };
    }
    return null;
  }

  draw(ctx) {
    if (!this.active || !ctx) return;
    const step = this.steps[this.index];
    const highlight = this.resolveHighlight(step);

    ctx.save();
    ctx.fillStyle = this.colors.mask;
    ctx.fillRect(0, 0, this.width, this.height);

    if (highlight) {
      roundRect(ctx, highlight.x - 6, highlight.y - 6, highlight.width + 12, highlight.height + 12, 14);
      ctx.fillStyle = this.colors.cutout;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = this.colors.accent;
      ctx.stroke();
    }

    const bubbleWidth = Math.min(this.width - 32, 320);
    const bubbleHeight = 136;
    const anchor = step.anchor || 'bottom';
    const bubbleX = (this.width - bubbleWidth) / 2;
    const bubbleY = anchor === 'top' ? 92 : this.height - bubbleHeight - 116;
    roundRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 18);
    ctx.fillStyle = this.colors.bubble;
    ctx.fill();

    ctx.fillStyle = this.colors.text;
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.t(step.titleKey || 'tutorial.title'), bubbleX + 18, bubbleY + 16);

    ctx.font = '14px sans-serif';
    const lines = wrapText(ctx, this.t(step.promptKey), bubbleWidth - 36).slice(0, 3);
    lines.forEach((line, lineIndex) => {
      ctx.fillText(line, bubbleX + 18, bubbleY + 46 + lineIndex * 20);
    });

    this.skipButton = { x: bubbleX + 18, y: bubbleY + bubbleHeight - 38, width: 72, height: 26 };
    this.nextButton = { x: bubbleX + bubbleWidth - 92, y: bubbleY + bubbleHeight - 38, width: 74, height: 26 };
    ctx.fillStyle = this.colors.muted;
    ctx.font = '12px sans-serif';
    ctx.fillText(this.t('tutorial.skip'), this.skipButton.x, this.skipButton.y + 6);

    roundRect(ctx, this.nextButton.x, this.nextButton.y, this.nextButton.width, this.nextButton.height, 13);
    ctx.fillStyle = this.colors.accent;
    ctx.fill();
    ctx.fillStyle = this.colors.text;
    ctx.textAlign = 'center';
    ctx.fillText(
      this.index >= this.steps.length - 1 ? this.t('tutorial.done') : this.t('tutorial.next'),
      this.nextButton.x + this.nextButton.width / 2,
      this.nextButton.y + 7
    );
    ctx.restore();
  }

  handleTap(x, y) {
    if (!this.active) return null;
    if (this.skipButton && x >= this.skipButton.x && x <= this.skipButton.x + this.skipButton.width &&
      y >= this.skipButton.y && y <= this.skipButton.y + this.skipButton.height) {
      return this.stop();
    }
    if (this.nextButton && x >= this.nextButton.x && x <= this.nextButton.x + this.nextButton.width &&
      y >= this.nextButton.y && y <= this.nextButton.y + this.nextButton.height) {
      return this.next();
    }
    return this.next();
  }
}

module.exports = Tutorial;

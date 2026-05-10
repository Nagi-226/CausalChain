// Shared Canvas 2D drawing helpers and general utilities.
// Used by render, UI, social, and open-data-context modules.

/**
 * Draw a rounded rectangle path (no fill/stroke — caller applies them).
 */
function roundedRect(ctx, x, y, width, height, radius) {
  var r = Math.min(radius || 0, width / 2, height / 2);
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

/**
 * Resolve a dot-separated key against a strings object. Returns the key itself as fallback.
 */
function readString(strings, key) {
  return key.split('.').reduce(function (node, part) {
    if (!node || typeof node !== 'object') return undefined;
    return node[part];
  }, strings) || key;
}

/**
 * Draw a small arrow-head indicator at (x, y) pointing in direction dir.
 */
function drawArrowHead(ctx, x, y, dir) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - dir * 6, y - 4);
  ctx.lineTo(x - dir * 6, y + 4);
  ctx.closePath();
  ctx.fill();
}

/**
 * FNV-1a 32-bit string hash (deterministic across runs).
 */
function hashString(value) {
  var hash = 2166136261;
  for (var i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

/** Clamp value to [min, max]. */
function clamp(value, min, max) {
  return value < min ? min : (value > max ? max : value);
}

/** Clamp to [0, 1]. */
function clamp01(value) {
  return value < 0 ? 0 : (value > 1 ? 1 : value);
}

/** Hex color adjust (positive amount = lighten, negative = darken). */
function adjustHex(hex, amount) {
  var num = parseInt(hex.replace('#', ''), 16);
  var r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  var g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  var b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

module.exports = {
  roundedRect: roundedRect,
  readString: readString,
  drawArrowHead: drawArrowHead,
  hashString: hashString,
  clamp: clamp,
  clamp01: clamp01,
  adjustHex: adjustHex
};

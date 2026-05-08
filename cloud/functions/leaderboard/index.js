let cloud = null;

try {
  cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
} catch (error) {
  cloud = null;
}

const MEMORY_ROWS = [];

exports.main = async function main(event = {}) {
  const action = event.action || '';
  if (action === 'submitProvinceScore') {
    return submitProvinceScore(event);
  }
  if (action === 'getProvinceLeaderboard') {
    return getProvinceLeaderboard(event);
  }
  return { ok: false, reason: 'unknown_action', action };
};

async function submitProvinceScore(event) {
  const levelId = Number(event.levelId || 1);
  const province = normalizeProvince(event.province);
  const record = normalizeRecord(event.record || {});
  const context = cloud && typeof cloud.getWXContext === 'function' ? cloud.getWXContext() : {};
  const openid = context.OPENID || event.openid || 'local-player';
  const row = {
    openid,
    levelId,
    province,
    bestMoves: record.bestMoves,
    bestTimeMs: record.bestTimeMs,
    stars: record.stars,
    updatedAt: Date.now()
  };

  if (!cloud || typeof cloud.database !== 'function') {
    upsertMemory(row);
    return { ok: true, mock: true, row };
  }

  const db = cloud.database();
  const collection = db.collection('leaderboard_province_scores');
  const existing = await collection.where({ openid, levelId, province }).limit(1).get();
  const previous = existing.data && existing.data[0];
  if (previous && !isBetterRecord(row, previous)) {
    return { ok: true, updated: false, row: previous };
  }
  if (previous) {
    await collection.doc(previous._id).update({ data: row });
    return { ok: true, updated: true, row };
  }
  await collection.add({ data: row });
  return { ok: true, created: true, row };
}

async function getProvinceLeaderboard(event) {
  const levelId = Number(event.levelId || 1);
  const province = normalizeProvince(event.province);
  const limit = Math.max(1, Math.min(100, Number(event.limit || 50)));

  if (!cloud || typeof cloud.database !== 'function') {
    return { ok: true, mock: true, rows: rankRows(MEMORY_ROWS.filter((row) => row.levelId === levelId && row.province === province)).slice(0, limit) };
  }

  const db = cloud.database();
  const response = await db.collection('leaderboard_province_scores')
    .where({ levelId, province })
    .orderBy('bestMoves', 'asc')
    .orderBy('stars', 'desc')
    .orderBy('bestTimeMs', 'asc')
    .limit(limit)
    .get();
  return { ok: true, rows: rankRows(response.data || []) };
}

function normalizeProvince(province) {
  return province || 'unknown';
}

function normalizeRecord(record) {
  return {
    bestMoves: Number(record.bestMoves || record.moves || 0),
    bestTimeMs: Number(record.bestTimeMs || record.elapsedMs || 0),
    stars: Number(record.stars || 0)
  };
}

function isBetterRecord(next, previous) {
  if (!previous || !previous.bestMoves) return true;
  if (next.bestMoves && next.bestMoves < previous.bestMoves) return true;
  if (next.bestMoves === previous.bestMoves && next.stars > (previous.stars || 0)) return true;
  if (next.bestMoves === previous.bestMoves && next.stars === (previous.stars || 0) &&
    next.bestTimeMs && next.bestTimeMs < (previous.bestTimeMs || Infinity)) return true;
  return false;
}

function upsertMemory(row) {
  const index = MEMORY_ROWS.findIndex((item) => item.openid === row.openid &&
    item.levelId === row.levelId && item.province === row.province);
  if (index < 0) {
    MEMORY_ROWS.push(row);
    return;
  }
  if (isBetterRecord(row, MEMORY_ROWS[index])) {
    MEMORY_ROWS[index] = row;
  }
}

function rankRows(rows) {
  return rows.slice()
    .sort((a, b) => a.bestMoves - b.bestMoves || b.stars - a.stars || a.bestTimeMs - b.bestTimeMs)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

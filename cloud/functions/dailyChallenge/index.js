let cloud = null;

try {
  cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
} catch (error) {
  cloud = null;
}

const MEMORY_RESULTS = {};

exports.main = async function main(event = {}) {
  const action = event.action || '';
  if (action === 'getTodayChallenge') return { ok: true, challenge: buildChallenge(event.dateKey || getDateKey()) };
  if (action === 'submitResult') return submitResult(event);
  if (action === 'getNationalLeaderboard') return getNationalLeaderboard(event.dateKey || getDateKey());
  return { ok: false, reason: 'unknown_action', action };
};

async function submitResult(event) {
  const dateKey = event.dateKey || getDateKey();
  const context = cloud && typeof cloud.getWXContext === 'function' ? cloud.getWXContext() : {};
  const row = {
    openid: context.OPENID || event.openid || 'local-player',
    nickname: event.nickname || 'Player',
    dateKey,
    moves: Number(event.moves || 0),
    stars: Number(event.stars || 0),
    elapsedMs: Number(event.elapsedMs || 0),
    cleared: event.cleared !== false,
    updatedAt: Date.now()
  };

  if (!cloud || typeof cloud.database !== 'function') {
    MEMORY_RESULTS[dateKey] = MEMORY_RESULTS[dateKey] || [];
    upsertMemoryResult(MEMORY_RESULTS[dateKey], row);
    const rows = rankRows(MEMORY_RESULTS[dateKey]);
    return { ok: true, mock: true, rank: findRank(rows, row), rows };
  }

  const db = cloud.database();
  const collection = db.collection('daily_challenge_results');
  const existing = await collection.where({ openid: row.openid, dateKey }).limit(1).get();
  const previous = existing.data && existing.data[0];
  if (previous && !isBetter(row, previous)) {
    const rows = await queryRows(collection, dateKey);
    return { ok: true, updated: false, rank: findRank(rows, previous), rows };
  }
  if (previous) await collection.doc(previous._id).update({ data: row });
  else await collection.add({ data: row });
  const rows = await queryRows(collection, dateKey);
  return { ok: true, updated: true, rank: findRank(rows, row), rows };
}

async function getNationalLeaderboard(dateKey) {
  if (!cloud || typeof cloud.database !== 'function') {
    return { ok: true, mock: true, rows: rankRows(MEMORY_RESULTS[dateKey] || []) };
  }
  const rows = await queryRows(cloud.database().collection('daily_challenge_results'), dateKey);
  return { ok: true, rows };
}

async function queryRows(collection, dateKey) {
  const response = await collection.where({ dateKey, cleared: true })
    .orderBy('moves', 'asc')
    .orderBy('stars', 'desc')
    .orderBy('elapsedMs', 'asc')
    .limit(100)
    .get();
  return rankRows(response.data || []);
}

function buildChallenge(dateKey) {
  const hash = hashString(dateKey);
  return {
    id: `daily-${dateKey}`,
    levelId: 8000 + Number(dateKey.replace(/-/g, '').slice(-4)),
    dateKey,
    seed: `daily-${dateKey}-${hash}`,
    difficulty: 4 + (hash % 4),
    fillRate: 0.56 + (hash % 8) / 100,
    minimumSteps: 12 + (hash % 8),
    theme: hash % 2 === 0 ? 'star' : 'ocean',
    board: { width: 8, height: 6 },
    generator: {
      colors: 3,
      icons: 3,
      chainLength: 2 + (hash % 2),
      relationMode: 'chain',
      guaranteedPairs: 5
    },
    goals: { clearAll: true, moveBudget: 28 },
    rewards: { items: { reveal: 1, undo: 1 } },
    isDailyChallenge: true
  };
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function isBetter(next, previous) {
  if (!previous || !previous.moves) return true;
  if (next.moves && next.moves < previous.moves) return true;
  if (next.moves === previous.moves && next.stars > (previous.stars || 0)) return true;
  if (next.moves === previous.moves && next.stars === (previous.stars || 0) &&
    next.elapsedMs && next.elapsedMs < (previous.elapsedMs || Infinity)) return true;
  return false;
}

function upsertMemoryResult(rows, row) {
  const index = rows.findIndex((item) => item.openid === row.openid);
  if (index < 0) {
    rows.push(row);
    return;
  }
  if (isBetter(row, rows[index])) {
    rows[index] = row;
  }
}

function rankRows(rows = []) {
  return rows.slice()
    .filter((row) => row.cleared !== false && row.moves > 0)
    .sort((a, b) => a.moves - b.moves || b.stars - a.stars || a.elapsedMs - b.elapsedMs)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function findRank(rows, row) {
  const match = rows.find((item) => item.openid === row.openid);
  return match ? match.rank : rows.length;
}

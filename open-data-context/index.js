const STATE = {
  levelId: 1,
  rows: [],
  title: 'Friends',
  width: 375,
  height: 420
};

function setupOpenDataContext(wxApi) {
  const api = wxApi || (typeof wx !== 'undefined' ? wx : null);
  if (!api || typeof api.onMessage !== 'function') {
    return STATE;
  }

  api.onMessage((message) => {
    if (!message || message.type !== 'renderLeaderboard') return;
    STATE.levelId = message.levelId || 1;
    STATE.title = message.title || `Level ${STATE.levelId} Friends`;
    STATE.width = message.width || STATE.width;
    STATE.height = message.height || STATE.height;
    const keyList = message.keyList || [`level_${STATE.levelId}_best_moves`, `level_${STATE.levelId}_stars`, 'total_stars'];
    if (typeof api.getFriendCloudStorage === 'function') {
      api.getFriendCloudStorage({
        keyList,
        success: (res) => {
          STATE.rows = normalizeRows(STATE.levelId, res.data || []);
          render(api);
        },
        fail: () => {
          STATE.rows = [];
          render(api);
        }
      });
    } else {
      STATE.rows = [];
      render(api);
    }
  });

  return STATE;
}

function normalizeRows(levelId, data) {
  const moveKey = `level_${levelId}_best_moves`;
  const starKey = `level_${levelId}_stars`;
  return (data || []).map((entry, index) => {
    const kv = {};
    (entry.KVDataList || []).forEach((item) => { kv[item.key] = item.value; });
    return {
      rank: index + 1,
      nickname: entry.nickname || `Friend ${index + 1}`,
      avatarUrl: entry.avatarUrl || '',
      bestMoves: Number(kv[moveKey] || 0),
      stars: Number(kv[starKey] || 0),
      totalStars: Number(kv.total_stars || 0)
    };
  }).filter((row) => row.bestMoves > 0).sort((a, b) => a.bestMoves - b.bestMoves || b.stars - a.stars)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function render(wxApi) {
  if (!wxApi || typeof wxApi.getSharedCanvas !== 'function') return false;
  const canvas = wxApi.getSharedCanvas();
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return false;
  if (STATE.width) canvas.width = STATE.width;
  if (STATE.height) canvas.height = STATE.height;
  const width = canvas.width || 375;
  const height = canvas.height || 667;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(7,17,31,0.92)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#F7FAFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(STATE.title, width / 2, 42);

  if (!STATE.rows.length) {
    ctx.fillStyle = '#A9B7D0';
    ctx.font = '15px sans-serif';
    ctx.fillText('No friend scores yet', width / 2, 112);
    return true;
  }

  for (let i = 0; i < Math.min(STATE.rows.length, 8); i += 1) {
    const row = STATE.rows[i];
    const y = 84 + i * 52;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
    roundRect(ctx, 18, y - 28, width - 36, 42, 12);
    ctx.fill();
    ctx.fillStyle = '#FFD166';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`#${row.rank}`, 32, y - 2);
    ctx.fillStyle = '#F7FAFF';
    ctx.fillText(row.nickname, 78, y - 2);
    ctx.textAlign = 'right';
    ctx.fillText(`${row.bestMoves} steps`, width - 32, y - 2);
  }
  return true;
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

setupOpenDataContext();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { setupOpenDataContext, normalizeRows, render, STATE };
}

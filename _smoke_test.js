// Smoke test — verify all modules load + core gameplay after Phase 1 UI polish
var g = require('./game.js');
var inst = g.bootstrap({ autoStart: false, width: 375, height: 667 });

var modules = [
  'engine', 'boardRenderer', 'touch', 'hud', 'toolbar',
  'tutorial', 'menu', 'resultPanel', 'adManager', 'itemManager',
  'shareManager', 'leaderboardManager'
];

var passed = 0;
var failed = 0;

modules.forEach(function (key) {
  var t = typeof inst[key];
  if (t === 'object' || t === 'function') {
    console.log('  OK  ' + key + ': ' + t);
    passed += 1;
  } else {
    console.log('  FAIL ' + key + ': ' + t);
    failed += 1;
  }
});

console.log('');
console.log('levelCompleted:', inst.levelCompleted);
console.log('lastCompletedResult:', inst.lastCompletedResult);
console.log('shareReviveLimit:', inst.shareReviveLimit);
console.log('shareReviveRemaining:', inst.getShareReviveRemaining());
console.log('canUseShareRevive:', inst.canUseShareRevive());

// Engine health
var engine = inst.engine;
var moves = engine.findLegalMoves();
console.log('legal moves:', moves.length);
console.log('engine status:', engine.getStatus());
console.log('');
console.log(passed + ' modules OK, ' + failed + ' failed');

if (failed > 0) process.exit(1);
process.exit(0);

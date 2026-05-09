// End-to-end + new system verification after Phase 1 UI polish
var g = require('./game.js');
var inst = g.bootstrap({ autoStart: false, width: 375, height: 667 });
var engine = inst.engine;

var allOK = true;
function check(label, result) {
  if (result) {
    console.log('  OK  ' + label);
  } else {
    console.log('  FAIL ' + label);
    allOK = false;
  }
}

// ===== 1. Core gameplay =====
var moves = engine.findLegalMoves();
check('legal moves > 0', moves.length > 0);
var m = moves[0];
var r = engine.processMove(m.from, m.to);
check('move success', r.success === true);
check('steps incremented', engine.steps > 0);

// ===== 2. buildResultState =====
var state = inst.buildResultState(r);
check('resultState has stars', state.stars > 0);
check('resultState has canShareRevive', typeof state.canShareRevive === 'boolean');
check('resultState has shareReviveRemaining', typeof state.shareReviveRemaining === 'number');

// ===== 3. levelCompleted guard =====
inst.showLevelComplete(r);
check('levelCompleted set to true', inst.levelCompleted === true);
check('lastCompletedResult saved', inst.lastCompletedResult !== null);

// Try double-fire
inst.showLevelComplete(r);
check('levelCompleted still true after 2nd call', inst.levelCompleted === true);

// ===== 4. Share revive system =====
check('share revive initially available (3)', inst.canUseShareRevive() === true);
inst.markShareReviveUsed();
check('share revive remaining (2)', inst.getShareReviveRemaining() === 2);
inst.markShareReviveUsed();
inst.markShareReviveUsed();
check('share revive exhausted (0)', inst.getShareReviveRemaining() === 0);
check('canUseShareRevive false when exhausted', inst.canUseShareRevive() === false);

// ===== 5. exportSharePathData =====
var pathData = inst.exportSharePathData();
check('exportSharePathData returns object', typeof pathData === 'object');
check('exportSharePathData has nodes', Array.isArray(pathData.nodes));
check('exportSharePathData has edges', Array.isArray(pathData.edges));

// ===== 6. ItemManager new features =====
var itemMgr = inst.itemManager;
check('itemManager loaded', typeof itemMgr === 'object');

// Inventory caps
itemMgr.inventory.freeze = 100;
itemMgr.grantItem('freeze', 50);
check('inventory cap enforced (freeze <= 5)', itemMgr.inventory.freeze <= 5);

// Economy: free grants
var initial = itemMgr.inventory.reveal || 0;
itemMgr.applyLevelGrants(3, null);
check('level 3 free reveal granted', itemMgr.inventory.reveal > initial);

// Ad item request
itemMgr.requestAdItem('reveal', 1).then(function (result) {
  check('requestAdItem returns Promise (mock ok)', result.success === true || result.reason === 'adNotCompleted');
  console.log('');
  if (allOK) {
    console.log('All end-to-end checks passed.');
    process.exit(0);
  } else {
    console.log('Some checks failed.');
    process.exit(1);
  }
}).catch(function () {
  check('requestAdItem resolved', false);
  process.exit(1);
});

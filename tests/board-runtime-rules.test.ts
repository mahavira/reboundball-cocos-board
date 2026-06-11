import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPipePath,
  canEnterEntity,
  createEntityState,
  getDurationMultiplierFromSpeedMultiplier,
  getTurnerExitDirection,
  getWeaponChargeLimit,
  getWeaponTailCells,
  handleBlockedEntityHit,
  nextChaosDirection,
  resolveCenterInteraction,
  resolvePipeDirection,
  resolveSegmentDurationMultiplier,
  rotateFacingClockwise,
  rotateVariantClockwise,
} from '../assets/scripts/board-runtime/board-runtime-rules.ts';

test('turner and facing rules keep current runtime semantics', () => {
  assert.equal(rotateVariantClockwise('right-up'), 'right-down');
  assert.equal(getTurnerExitDirection('left-up', 'right'), 'up');
  assert.equal(getTurnerExitDirection('right-up', 'right'), null);
  assert.equal(rotateFacingClockwise('up'), 'right');
  assert.equal(nextChaosDirection('up', 0), 'right');
});

test('speed-to-duration helper keeps reciprocal timing semantics explicit', () => {
  assert.equal(getDurationMultiplierFromSpeedMultiplier(1), 1);
  assert.equal(getDurationMultiplierFromSpeedMultiplier(2.5), 0.4);
});

test('weapon runtime helpers derive tail cells and charge limit from entity state', () => {
  const entity = createEntityState(
    {
      kind: 'weapon',
      coord: { row: 3, col: 4 },
      weaponType: 'pistol',
      facing: 'up',
    },
    2,
  );

  assert.equal(entity.kind, 'weapon');
  if (entity.kind !== 'weapon') {
    throw new Error('expected weapon entity');
  }

  assert.equal(getWeaponChargeLimit(entity), 2);
  assert.deepEqual(getWeaponTailCells(entity), [{ row: 2, col: 4 }]);
});

test('pipe helpers preserve clockwise outer-ring traversal semantics', () => {
  const pipePath = buildPipePath();
  const pipeIndexByKey = new Map(pipePath.map((coord, index) => [`${coord.row},${coord.col}`, index]));

  assert.equal(pipePath.length, 24);
  assert.deepEqual(pipePath[0], { row: 3, col: 0 });
  assert.equal(resolvePipeDirection({ row: 6, col: 6 }, pipePath, pipeIndexByKey), 'up');
});

test('entity interaction helpers preserve blocking and center effects', () => {
  const iceBlock = createEntityState(
    { kind: 'ice-block', coord: { row: 3, col: 1 }, durability: 1 },
    0,
  );
  const blackHole = createEntityState({ kind: 'black-hole', coord: { row: 3, col: 1 } }, 1);
  const turner = createEntityState(
    { kind: 'turner', coord: { row: 3, col: 1 }, variant: 'left-up', level: 2 },
    2,
  );

  assert.equal(canEnterEntity(turner, 'right'), true);
  assert.equal(canEnterEntity(iceBlock, 'right'), false);
  assert.deepEqual(handleBlockedEntityHit(iceBlock), { removeSelf: true });
  assert.deepEqual(resolveCenterInteraction(blackHole, 'right', 4, { row: 3, col: 0 }), {
    teleportTo: { row: 3, col: 0 },
    resetDirection: 'right',
    speedMultiplier: 1,
  });
});

test('segment duration helper keeps entry, pipe, and slow-zone timing rules', () => {
  const ball = {
    ballId: 'ball-1',
    cell: { row: 3, col: 0 },
    direction: 'right' as const,
    isFast: false,
    speedMultiplier: 1,
  };

  assert.equal(
    resolveSegmentDurationMultiplier({
      ball,
      fromCell: { row: 3, col: 0 },
      toCell: { row: 3, col: 1 },
      currentEntity: null,
      targetEntity: null,
      entryCoord: { row: 3, col: 0 },
      boardSize: 7,
      phase: 'from-current',
    }),
    1,
  );

  assert.equal(
    resolveSegmentDurationMultiplier({
      ball: { ...ball, direction: 'down', cell: { row: 3, col: 0 } },
      fromCell: { row: 3, col: 0 },
      toCell: { row: 4, col: 0 },
      currentEntity: null,
      targetEntity: null,
      entryCoord: { row: 3, col: 0 },
      boardSize: 7,
      phase: 'from-current',
    }),
    0.1,
  );

  assert.equal(
    resolveSegmentDurationMultiplier({
      ball,
      fromCell: { row: 3, col: 0 },
      toCell: { row: 3, col: 1 },
      currentEntity: null,
      targetEntity: { kind: 'slow-zone', coord: { row: 3, col: 1 } },
      entryCoord: { row: 3, col: 0 },
      boardSize: 7,
      phase: 'to-target',
    }),
    2.5,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cloneCoord,
  coordKey,
  isBoardCoord,
  isInnerBoardCoord,
  isOuterRingCoord,
  moveCoord,
  sameCoord,
} from '../assets/scripts/shared/helpers.ts';

test('coord helpers preserve semantics across runtime and board rendering', () => {
  const coord = { row: 3, col: 2 };

  const clonedCoord = cloneCoord(coord);
  const movedCoord = moveCoord(coord, 'right');

  assert.deepEqual(clonedCoord, coord);
  assert.notEqual(clonedCoord, coord);
  assert.equal(coordKey(coord), '3,2');
  assert.equal(sameCoord(coord, clonedCoord), true);
  assert.deepEqual(movedCoord, { row: 3, col: 3 });
});

test('board range helpers distinguish outer ring, inner board, and out-of-bounds cells', () => {
  assert.equal(isOuterRingCoord({ row: 0, col: 3 }, 7), true);
  assert.equal(isOuterRingCoord({ row: 3, col: 3 }, 7), false);
  assert.equal(isInnerBoardCoord({ row: 3, col: 3 }, 1, 5), true);
  assert.equal(isInnerBoardCoord({ row: 0, col: 3 }, 1, 5), false);
  assert.equal(isBoardCoord({ row: 6, col: 6 }, 7), true);
  assert.equal(isBoardCoord({ row: 7, col: 6 }, 7), false);
});

test('board helper semantics stay stable while comments are clarified', () => {
  assert.deepEqual(moveCoord({ row: 3, col: 3 }, 'up'), { row: 2, col: 3 });
  assert.equal(isOuterRingCoord({ row: 3, col: 0 }, 7), true);
  assert.equal(isBoardCoord({ row: -1, col: 0 }, 7), false);
});

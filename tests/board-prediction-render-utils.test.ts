import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDashedPolylines,
  createDashedPredictionPolylines,
  roundPredictionPathCorners,
} from '../assets/scripts/board-prediction/board-prediction-render-utils.ts';

test('prediction corner rounding trims the hard corner and inserts arc points', () => {
  const roundedPoints = roundPredictionPathCorners([
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
  ]);

  assert.deepEqual(roundedPoints[0], { x: 0, y: 0 });
  assert.deepEqual(roundedPoints[1], { x: 16, y: 0 });
  assert.deepEqual(roundedPoints.at(-2), { x: 20, y: 4 });
  assert.deepEqual(roundedPoints.at(-1), { x: 20, y: 20 });
  assert.equal(roundedPoints.some((point) => point.x === 20 && point.y === 0), false);
  assert.equal(roundedPoints.length > 4, true);
});

test('prediction dashes follow fixed 8-2 rhythm on straight segments', () => {
  const dashedPolylines = buildDashedPolylines([
    { x: 0, y: 0 },
    { x: 25, y: 0 },
  ]);

  assert.deepEqual(dashedPolylines, [
    [{ x: 0, y: 0 }, { x: 8, y: 0 }],
    [{ x: 10, y: 0 }, { x: 18, y: 0 }],
    [{ x: 20, y: 0 }, { x: 25, y: 0 }],
  ]);
});

test('prediction dashes can span a rounded corner without breaking the path shape', () => {
  const dashedPolylines = createDashedPredictionPolylines([
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
  ]);

  assert.equal(dashedPolylines.some((polyline) => polyline.length > 2), true);
});

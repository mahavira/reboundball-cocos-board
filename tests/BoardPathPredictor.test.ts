import test from 'node:test';
import assert from 'node:assert/strict';

import { BoardPathPredictor } from '../assets/scripts/board-prediction/BoardPathPredictor.ts';
import { BoardRuntime, createBoardPreset, type EntitySpec } from '../assets/scripts/BoardRuntime.ts';

function createPredictor(entities: EntitySpec[], maxSteps = 32) {
  const runtime = new BoardRuntime(createBoardPreset({ entities }));
  return new BoardPathPredictor(
    {
      entryCoord: runtime.getEntryCoord(),
      entities: runtime.getEntities(),
    },
    { maxSteps },
  );
}

test('predicts the straight entry path until a loop is detected', () => {
  const predictor = createPredictor([]);

  const result = predictor.predictSharedPath();

  assert.equal(result.terminationReason, 'looped');
  assert.equal(result.isEmpty, false);
  assert.deepEqual(result.points[0], { row: 3, col: 0 });
  assert.deepEqual(result.points[1], { row: 3, col: 1 });
});

test('stops prediction when a chaos gate is reached', () => {
  const predictor = createPredictor([
    { kind: 'chaos-gate', coord: { row: 3, col: 1 } },
  ]);

  const result = predictor.predictSharedPath();

  assert.equal(result.terminationReason, 'chaos-gate');
  assert.deepEqual(result.segments.at(-1)?.to, { row: 3, col: 1 });
});

test('predicts black hole reset back to entry and then terminates on the repeated loop state', () => {
  const predictor = createPredictor([
    { kind: 'black-hole', coord: { row: 3, col: 1 } },
  ], 8);

  const result = predictor.predictSharedPath();

  assert.deepEqual(
    result.points,
    [
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 0 },
    ],
  );
  assert.equal(result.terminationReason, 'looped');
  assert.equal(result.segments.length, 2);
  assert.deepEqual(result.segments[1].to, { row: 3, col: 0 });
});

test('predicts a blocked weapon bounce as an out-and-back segment pair', () => {
  const predictor = createPredictor([
    { kind: 'weapon', coord: { row: 3, col: 2 }, weaponType: 'pistol', facing: 'up' },
  ], 8);

  const result = predictor.predictSharedPath();

  assert.equal(result.segments[1].to.col, 1);
  assert.equal(result.segments[2].to.col, 0);
});

test('uses max-steps as a safety fallback when loop detection is disabled by new rules', () => {
  const predictor = createPredictor([], 1);

  const result = predictor.predictSharedPath();

  assert.equal(result.terminationReason, 'max-steps');
});

test('does not terminate early when revisiting the same cell from a different direction', () => {
  const predictor = createPredictor([
    { kind: 'turner', coord: { row: 1, col: 1 }, variant: 'right-up', level: 1 },
    { kind: 'turner', coord: { row: 3, col: 1 }, variant: 'left-up', level: 1 },
  ], 28);

  const result = predictor.predictSharedPath();

  assert.deepEqual(
    result.points.slice(0, 6),
    [
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 2, col: 1 },
      { row: 2, col: 1 },
      { row: 3, col: 1 },
      { row: 3, col: 0 },
    ],
  );
  assert.equal(result.segments[0].direction, 'right');
  assert.equal(result.segments[3].direction, 'down');
  assert.equal(result.terminationReason, 'max-steps');
});

test('predictor does not mutate the runtime entity snapshot it reads from', () => {
  const runtime = new BoardRuntime(createBoardPreset({
    entities: [{ kind: 'rotator', coord: { row: 3, col: 1 }, variant: 'left-up', level: 1 }],
  }));

  const predictor = new BoardPathPredictor({
    entryCoord: runtime.getEntryCoord(),
    entities: runtime.getEntities(),
  });

  predictor.predictSharedPath();
  const entityAfterPrediction = runtime.getEntityAt({ row: 3, col: 1 });

  assert.equal(entityAfterPrediction?.kind, 'rotator');
  assert.equal(entityAfterPrediction?.kind === 'rotator' ? entityAfterPrediction.variant : null, 'left-up');
});

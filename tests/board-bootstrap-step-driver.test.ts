import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectReachedProgressEvents,
  createStepContext,
  shouldStartBallStep,
} from '../assets/scripts/board-bootstrap/board-bootstrap-step-driver.ts';
import type { BallStepResult } from '../assets/scripts/shared/types.ts';

function createStep(overrides?: Partial<BallStepResult>): BallStepResult {
  return {
    ballId: 'ball-1',
    stepId: 1,
    outcome: 'moved',
    finalCell: { row: 3, col: 1 },
    finalDirection: 'right',
    segments: [
      { from: { row: 3, col: 0 }, to: { row: 3, col: 0.5 }, durationMs: 400 },
      { from: { row: 3, col: 0.5 }, to: { row: 3, col: 1 }, durationMs: 400 },
    ],
    progressEvents: [
      { ballId: 'ball-1', stepId: 1, progress: 100, cell: { row: 3, col: 0 }, direction: 'right', atMs: 400 },
      { ballId: 'ball-1', stepId: 1, progress: 0, cell: { row: 3, col: 1 }, direction: 'right', atMs: 400 },
      { ballId: 'ball-1', stepId: 1, progress: 50, cell: { row: 3, col: 1 }, direction: 'right', atMs: 800 },
    ],
    weaponEvents: [],
    ...overrides,
  };
}

test('shouldStartBallStep blocks paused auto scheduling but allows force scheduling', () => {
  assert.equal(shouldStartBallStep({ isPaused: true, force: false, hasActiveStep: false }), false);
  assert.equal(shouldStartBallStep({ isPaused: true, force: true, hasActiveStep: false }), true);
  assert.equal(shouldStartBallStep({ isPaused: false, force: false, hasActiveStep: true }), false);
});

test('collectReachedProgressEvents emits each event once when elapsed crosses checkpoints', () => {
  const context = createStepContext(createStep());

  const firstBatch = collectReachedProgressEvents(context, 400);
  const secondBatch = collectReachedProgressEvents(context, 800);
  const repeatedBatch = collectReachedProgressEvents(context, 800);

  assert.deepEqual(firstBatch.map((event) => event.progress), [100, 0]);
  assert.deepEqual(secondBatch.map((event) => event.progress), [50]);
  assert.deepEqual(repeatedBatch, []);
});

test('createStepContext computes totalDurationMs from all step segments', () => {
  const context = createStepContext(createStep({
    segments: [
      { from: { row: 3, col: 0 }, to: { row: 3, col: 0.5 }, durationMs: 250 },
      { from: { row: 3, col: 0.5 }, to: { row: 3, col: 1 }, durationMs: 750 },
    ],
  }));

  assert.equal(context.totalDurationMs, 1000);
  assert.equal(context.elapsedMs, 0);
});

test('collectReachedProgressEvents handles zero-duration step checkpoints immediately', () => {
  const context = createStepContext(createStep({
    segments: [],
    progressEvents: [
      { ballId: 'ball-1', stepId: 1, progress: 50, cell: { row: 3, col: 0 }, direction: 'right', atMs: 0 },
    ],
  }));

  const events = collectReachedProgressEvents(context, 0);

  assert.deepEqual(events.map((event) => event.progress), [50]);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BoardRuntime,
  createBoardPreset,
  type EntitySpec,
} from '../assets/scripts/BoardRuntime.ts';

/** 测试辅助：创建空实体的 BoardRuntime 实例，可自定义实体列表和步进时长 */
function createRuntime(options?: {
  entities?: EntitySpec[];
  baseStepMs?: number;
}) {
  return new BoardRuntime(
    createBoardPreset({
      baseStepMs: options?.baseStepMs,
      entities: options?.entities ?? [],
    }),
  );
}

test('pipe path contains 24 cells and entrance stays on outer ring', () => {
  const runtime = createRuntime();
  const pipePath = runtime.getPipePath();

  assert.equal(pipePath.length, 24);
  assert.deepEqual(runtime.getState().entryCoord, { row: 3, col: 0 });
});

test('blocking weapon cell bounces back to current center in the same step', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'up',
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');

  assert.equal(step.outcome, 'blocked');
  assert.deepEqual(step.finalCell, { row: 3, col: 1 });
  assert.equal(step.finalDirection, 'left');
  assert.deepEqual(
    step.progressEvents.map((event) => event.progress),
    [],
  );
});

test('slow zone applies after entering target edge and changes segment duration', () => {
  const runtime = createRuntime({
    entities: [{ kind: 'slow-zone', coord: { row: 3, col: 1 } }],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  const step = runtime.tickBall('ball-1');

  assert.equal(step.outcome, 'moved');
  assert.equal(step.segments.length, 2);
  assert.equal(step.segments[0].durationMs, 400);
  assert.equal(step.segments[1].durationMs, 1000);
  assert.deepEqual(
    step.progressEvents.map((event) => [event.progress, event.cell.row, event.cell.col]),
    [
      [100, 3, 0],
      [0, 3, 1],
      [50, 3, 1],
    ],
  );
});

test('connected turner changes direction at target center', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'turner',
        coord: { row: 3, col: 1 },
        variant: 'left-up',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  const step = runtime.tickBall('ball-1');

  assert.equal(step.outcome, 'moved');
  assert.equal(step.finalDirection, 'up');
});

test('rotator rotates only after successful leave', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'rotator',
        coord: { row: 3, col: 1 },
        variant: 'left-up',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  runtime.tickBall('ball-1');
  const entity = runtime.getEntityAt({ row: 3, col: 1 });

  assert.equal(entity?.kind, 'rotator');
  assert.equal(entity?.variant, 'right-up');
});

test('black hole teleports ball at center and omits leave event for target cell', () => {
  const runtime = createRuntime({
    entities: [{ kind: 'black-hole', coord: { row: 3, col: 1 } }],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  const step = runtime.tickBall('ball-1');

  assert.equal(step.outcome, 'teleported');
  assert.deepEqual(step.finalCell, { row: 3, col: 0 });
  assert.equal(step.finalDirection, 'right');
  assert.deepEqual(
    step.progressEvents.map((event) => event.progress),
    [100, 0, 50],
  );
});

test('ice block loses durability and disappears after enough blocked hits', () => {
  const runtime = createRuntime({
    entities: [{ kind: 'ice-block', coord: { row: 3, col: 1 }, durability: 2 }],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.spawnBall({ ballId: 'ball-2', isFast: false });

  runtime.tickBall('ball-1');

  let entity = runtime.getEntityAt({ row: 3, col: 1 });
  assert.equal(entity?.kind, 'ice-block');
  assert.equal(entity?.durability, 1);

  runtime.tickBall('ball-2');
  entity = runtime.getEntityAt({ row: 3, col: 1 });
  assert.equal(entity, null);
});

test('weapon tail fires when the next step starts from a fully charged tail center', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
        charge: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const fireStep = runtime.tickBall('ball-1');
  const weapon = runtime.getEntityAt({ row: 3, col: 2 });

  assert.equal(fireStep.outcome, 'blocked');
  assert.equal(fireStep.weaponEvents.length, 1);
  assert.equal(fireStep.weaponEvents[0].type, 'weapon-fired');
  assert.equal(fireStep.weaponEvents[0].weaponType, 'pistol');
  assert.equal(weapon?.kind, 'weapon');
  assert.equal(weapon?.kind === 'weapon' ? weapon.charge : null, 0);
});

test('support entity blocks ball like weapon cell', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'support',
        coord: { row: 3, col: 2 },
        supportType: 'damage-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');

  assert.equal(step.outcome, 'blocked');
  assert.deepEqual(step.finalCell, { row: 3, col: 1 });
  assert.equal(step.finalDirection, 'left');
});

test('charge-booster support increases adjacent weapon charge gain', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
      },
      {
        kind: 'support',
        coord: { row: 2, col: 2 },
        supportType: 'charge-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  runtime.tickBall('ball-1');

  const weapon = runtime.getEntityAt({ row: 3, col: 2 });

  assert.equal(weapon?.kind, 'weapon');
  assert.equal(weapon?.kind === 'weapon' ? weapon.charge : null, 1.2);
});

test('charge-booster keeps overflow charge after weapon fires', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
        charge: 1,
      },
      {
        kind: 'support',
        coord: { row: 2, col: 2 },
        supportType: 'charge-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');

  const weapon = runtime.getEntityAt({ row: 3, col: 2 });

  assert.equal(step.weaponEvents.length, 1);
  assert.equal(step.weaponEvents[0].modifiers.chargeGainMultiplier, 1.2);
  assert.equal(weapon?.kind, 'weapon');
  assert.equal(weapon?.kind === 'weapon' ? Math.round(weapon.charge * 10) / 10 : null, 0.2);
});

test('support aura adds weapon fire modifiers from adjacent supports', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
        charge: 1,
      },
      {
        kind: 'support',
        coord: { row: 2, col: 2 },
        supportType: 'damage-booster',
        level: 1,
      },
      {
        kind: 'support',
        coord: { row: 3, col: 3 },
        supportType: 'gold-booster',
        level: 1,
      },
      {
        kind: 'support',
        coord: { row: 4, col: 2 },
        supportType: 'crit-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');

  assert.equal(step.weaponEvents.length, 1);

  const modifiers = step.weaponEvents[0].modifiers;
  assert.equal(modifiers.damageMultiplier, 1.2);
  assert.equal(modifiers.onKillGoldBonus, 1);
  assert.equal(modifiers.critChanceBonus, 0.1);
  assert.equal(modifiers.chargeGainMultiplier, 1);
});

test('diagonal support does not affect weapon modifiers', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
        charge: 1,
      },
      {
        kind: 'support',
        coord: { row: 2, col: 1 },
        supportType: 'damage-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');

  assert.equal(step.weaponEvents.length, 1);
  assert.equal(step.weaponEvents[0].modifiers.damageMultiplier, 1);
});

test('blocked step also charges when ball is already at the weapon tail center', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const blockedStep = runtime.tickBall('ball-1');
  const weapon = runtime.getEntityAt({ row: 3, col: 2 });

  assert.equal(blockedStep.outcome, 'blocked');
  assert.equal(blockedStep.weaponEvents.length, 0);
  assert.equal(weapon?.kind, 'weapon');
  assert.equal(weapon?.kind === 'weapon' ? weapon.charge : null, 1);
});

test('moving off the weapon tail center also charges before the next move resolves', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 4, col: 1 },
        weaponType: 'pistol',
        facing: 'up',
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');
  const weapon = runtime.getEntityAt({ row: 4, col: 1 });

  assert.equal(step.outcome, 'moved');
  assert.equal(weapon?.kind, 'weapon');
  assert.equal(weapon?.kind === 'weapon' ? weapon.charge : null, 1);
});

test('weapon tail does not charge when the ball reaches a non-tail cell center', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'up',
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  const step = runtime.tickBall('ball-1');
  const weapon = runtime.getEntityAt({ row: 3, col: 2 });

  assert.equal(step.weaponEvents.length, 0);
  assert.equal(weapon?.kind, 'weapon');
  assert.equal(weapon?.kind === 'weapon' ? weapon.charge : null, 0);
});

test('turner exits normally, then reflects at blocked exit neighbor and returns via entry side', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'turner',
        coord: { row: 3, col: 1 },
        variant: 'left-up',
        level: 1,
      },
      {
        kind: 'stone',
        coord: { row: 2, col: 1 },
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  const turnerStep = runtime.tickBall('ball-1');
  assert.equal(turnerStep.outcome, 'moved');
  assert.deepEqual(turnerStep.finalCell, { row: 3, col: 1 });
  assert.equal(turnerStep.finalDirection, 'up');

  const blockedExitStep = runtime.tickBall('ball-1');
  assert.equal(blockedExitStep.outcome, 'blocked');
  assert.deepEqual(blockedExitStep.finalCell, { row: 3, col: 1 });
  assert.equal(blockedExitStep.finalDirection, 'left');

  const backToEntryStep = runtime.tickBall('ball-1');
  assert.equal(backToEntryStep.outcome, 'moved');
  assert.deepEqual(backToEntryStep.finalCell, { row: 3, col: 0 });
  assert.equal(backToEntryStep.finalDirection, 'left');
});

test('ball moves clockwise along pipe after leaving inner board', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'turner',
        coord: { row: 3, col: 5 },
        variant: 'left-down',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });

  for (let stepIndex = 0; stepIndex < 5; stepIndex += 1) {
    runtime.tickBall('ball-1');
  }
  runtime.tickBall('ball-1');
  runtime.tickBall('ball-1');
  const pipeEntryStep = runtime.tickBall('ball-1');
  assert.equal(pipeEntryStep.outcome, 'moved');
  assert.deepEqual(pipeEntryStep.finalCell, { row: 6, col: 5 });
  assert.equal(pipeEntryStep.finalDirection, 'right');

  const nextPipeStep = runtime.tickBall('ball-1');
  assert.deepEqual(nextPipeStep.finalCell, { row: 6, col: 6 });
  assert.equal(nextPipeStep.finalDirection, 'up');
  assert.equal(nextPipeStep.segments[0].durationMs, 40);
  assert.equal(nextPipeStep.segments[1].durationMs, 40);
});

test('ball returns to entry then re-enters board to the right at base speed', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'turner',
        coord: { row: 3, col: 5 },
        variant: 'left-down',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });

  for (let stepIndex = 0; stepIndex < 24; stepIndex += 1) {
    runtime.tickBall('ball-1');
  }

  const stateAtEntry = runtime.getBallStates().find((ball) => ball.ballId === 'ball-1');
  assert.deepEqual(stateAtEntry?.cell, { row: 3, col: 0 });
  assert.equal(stateAtEntry?.direction, 'right');

  const reenterStep = runtime.tickBall('ball-1');
  assert.deepEqual(reenterStep.finalCell, { row: 3, col: 1 });
  assert.equal(reenterStep.finalDirection, 'right');
  assert.equal(reenterStep.segments[0].durationMs, 400);
  assert.equal(reenterStep.segments[1].durationMs, 400);
});

test('ball blocked back toward entry then follows pipe clockwise on next step', () => {
  const runtime = createRuntime({
    entities: [{ kind: 'weapon', coord: { row: 3, col: 2 }, weaponType: 'pistol', facing: 'up' }],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  runtime.tickBall('ball-1');
  runtime.tickBall('ball-1');
  const pipeStep = runtime.tickBall('ball-1');

  assert.deepEqual(pipeStep.finalCell, { row: 4, col: 0 });
  assert.equal(pipeStep.finalDirection, 'down');
});

test('entry behaves as pipe-speed cell except when re-entering inner board', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'turner',
        coord: { row: 3, col: 5 },
        variant: 'left-down',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  for (let stepIndex = 0; stepIndex < 24; stepIndex += 1) {
    const step = runtime.tickBall('ball-1');
    if (stepIndex === 23) {
      assert.deepEqual(step.finalCell, { row: 3, col: 0 });
      assert.equal(step.segments[1].durationMs, 40);
    }
  }

  const fromEntryToInnerBoard = runtime.tickBall('ball-1');
  assert.equal(fromEntryToInnerBoard.segments[0].durationMs, 400);
  assert.equal(fromEntryToInnerBoard.segments[1].durationMs, 400);
});

test('turner speed persists after leaving turner until another tile changes it', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'turner',
        coord: { row: 3, col: 1 },
        variant: 'left-up',
        level: 2,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  const turnerStep = runtime.tickBall('ball-1');
  assert.equal(turnerStep.finalDirection, 'up');
  assert.equal(turnerStep.segments[1].durationMs, 400);

  const nextStep = runtime.tickBall('ball-1');
  assert.deepEqual(nextStep.finalCell, { row: 2, col: 1 });
  assert.equal(nextStep.segments[0].durationMs, 160);
  assert.equal(nextStep.segments[1].durationMs, 160);
});

test('bounce back to entry ends at entry center before next step enters pipe', () => {
  const runtime = createRuntime({
    entities: [{ kind: 'weapon', coord: { row: 3, col: 2 }, weaponType: 'pistol', facing: 'up' }],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const blockedStep = runtime.tickBall('ball-1');
  assert.equal(blockedStep.outcome, 'blocked');
  assert.deepEqual(blockedStep.finalCell, { row: 3, col: 1 });

  const toEntryStep = runtime.tickBall('ball-1');
  assert.deepEqual(toEntryStep.finalCell, { row: 3, col: 0 });
  assert.equal(toEntryStep.finalDirection, 'left');

  const pipeStep = runtime.tickBall('ball-1');
  assert.deepEqual(pipeStep.finalCell, { row: 4, col: 0 });
  assert.equal(pipeStep.finalDirection, 'down');
});

test('explicit entity layout operations publish passive refresh events', () => {
  const runtime = createRuntime();
  const events: Array<{ kind: string; changedCoords: string[]; requiresPredictionRefresh: boolean }> = [];

  runtime.addEntityChangeListener((event) => {
    events.push({
      kind: event.kind,
      changedCoords: event.changedCoords.map((coord) => `${coord.row},${coord.col}`),
      requiresPredictionRefresh: event.requiresPredictionRefresh,
    });
  });

  runtime.placeEntity({
    kind: 'turner',
    coord: { row: 3, col: 3 },
    variant: 'left-up',
    level: 1,
  });
  runtime.rotateEntity({ row: 3, col: 3 });
  runtime.upgradeEntity({ row: 3, col: 3 });
  runtime.removeEntity({ row: 3, col: 3 });
  runtime.resetEntities([]);

  assert.deepEqual(events, [
    { kind: 'placed', changedCoords: ['3,3'], requiresPredictionRefresh: true },
    { kind: 'rotated', changedCoords: ['3,3'], requiresPredictionRefresh: true },
    { kind: 'upgraded', changedCoords: ['3,3'], requiresPredictionRefresh: true },
    { kind: 'removed', changedCoords: ['3,3'], requiresPredictionRefresh: true },
    { kind: 'reset', changedCoords: [], requiresPredictionRefresh: true },
  ]);
});

test('resetBoard rejects preset-level board config changes on an existing runtime', () => {
  const runtime = createRuntime();

  assert.throws(
    () => runtime.resetBoard(createBoardPreset({ entryCoord: { row: 0, col: 0 } })),
    /cannot replace entryCoord or baseStepMs/,
  );

  assert.throws(
    () => runtime.resetBoard(createBoardPreset({ baseStepMs: 1200 })),
    /cannot replace entryCoord or baseStepMs/,
  );
});

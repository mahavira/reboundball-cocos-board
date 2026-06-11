import test from 'node:test';
import assert from 'node:assert/strict';

import { BallStepAnimator } from '../assets/scripts/board-bootstrap/BallStepAnimator.ts';
import { BoardPresentationRefresher } from '../assets/scripts/board-bootstrap/BoardPresentationRefresher.ts';
import type {
  BallRenderState,
  BallStepResult,
  BoardEntityChangeEvent,
  EntityState,
  GridCoord,
} from '../assets/scripts/shared/types.ts';

function createBallState(overrides?: Partial<BallRenderState>): BallRenderState {
  return {
    ballId: 'ball-1',
    cell: { row: 3, col: 0 },
    direction: 'right',
    isFast: false,
    speedMultiplier: 1,
    ...overrides,
  };
}

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

function createAnimatorRuntimeStub() {
  const initialBall = createBallState();
  const finalBall = createBallState({ cell: { row: 3, col: 1 } });
  const runtimeState = {
    paused: false,
    ballStates: [initialBall],
    step: createStep(),
    tickCalls: [] as string[],
  };

  return {
    runtime: {
      isPaused: () => runtimeState.paused,
      getBallStates: () => runtimeState.ballStates.map((ball) => structuredClone(ball)),
      tickBall: (ballId: string) => {
        runtimeState.tickCalls.push(ballId);
        runtimeState.ballStates = [finalBall];
        return structuredClone(runtimeState.step);
      },
    },
    runtimeState,
  };
}

function createSequentialAnimatorRuntimeStub() {
  const steps = [
    createStep(),
    createStep({
      stepId: 2,
      finalCell: { row: 3, col: 2 },
      segments: [
        { from: { row: 3, col: 1 }, to: { row: 3, col: 1.5 }, durationMs: 400 },
        { from: { row: 3, col: 1.5 }, to: { row: 3, col: 2 }, durationMs: 400 },
      ],
      progressEvents: [
        { ballId: 'ball-1', stepId: 2, progress: 100, cell: { row: 3, col: 1 }, direction: 'right', atMs: 400 },
        { ballId: 'ball-1', stepId: 2, progress: 0, cell: { row: 3, col: 2 }, direction: 'right', atMs: 400 },
        { ballId: 'ball-1', stepId: 2, progress: 50, cell: { row: 3, col: 2 }, direction: 'right', atMs: 800 },
      ],
    }),
  ];
  const runtimeState = {
    paused: false,
    ballStates: [createBallState()],
    steps,
    tickCalls: [] as string[],
  };

  return {
    runtime: {
      isPaused: () => runtimeState.paused,
      getBallStates: () => runtimeState.ballStates.map((ball) => structuredClone(ball)),
      tickBall: (ballId: string) => {
        const step = runtimeState.steps.shift();
        if (!step) {
          throw new Error('No more steps available');
        }
        runtimeState.tickCalls.push(ballId);
        runtimeState.ballStates = [
          createBallState({
            cell: structuredClone(step.finalCell),
            direction: step.finalDirection,
          }),
        ];
        return structuredClone(step);
      },
    },
    runtimeState,
  };
}

function createAnimatorRendererStub() {
  const rendererState = {
    syncBallNodesCalls: [] as BallRenderState[][],
    setBallPositionCalls: [] as Array<{ ballId: string; coord: GridCoord }>,
  };

  return {
    renderer: {
      syncBallNodes: (ballStates: BallRenderState[]) => {
        rendererState.syncBallNodesCalls.push(structuredClone(ballStates));
      },
      setBallPosition: (ballId: string, coord: GridCoord) => {
        rendererState.setBallPositionCalls.push({
          ballId,
          coord: structuredClone(coord),
        });
        return true;
      },
    },
    rendererState,
  };
}

function createRefresherRuntimeStub() {
  const runtimeState = {
    entryCoord: { row: 3, col: 0 } as GridCoord,
    entities: [
      {
        kind: 'turner',
        coord: { row: 3, col: 1 },
        variant: 'left-up',
        level: 1,
      },
    ] satisfies EntityState[],
    ballStates: [createBallState()],
  };

  return {
    runtime: {
      getEntryCoord: () => structuredClone(runtimeState.entryCoord),
      getEntities: () => structuredClone(runtimeState.entities),
      getBallStates: () => structuredClone(runtimeState.ballStates),
    },
    runtimeState,
  };
}

function createRefresherRendererStub() {
  const rendererState = {
    rebuildEntityLayerCalls: [] as EntityState[][],
    renderPredictionPathCalls: [] as Array<{ isEmpty: boolean; segmentsLength: number }>,
    syncBallNodesCalls: [] as BallRenderState[][],
    syncIdleBallNodesCalls: [] as Array<{ ballStates: BallRenderState[]; activeBallIds: string[] }>,
  };

  return {
    renderer: {
      rebuildEntityLayer: (entities: EntityState[]) => {
        rendererState.rebuildEntityLayerCalls.push(structuredClone(entities));
      },
      renderPredictionPath: (prediction: { isEmpty: boolean; segments: unknown[] }) => {
        rendererState.renderPredictionPathCalls.push({
          isEmpty: prediction.isEmpty,
          segmentsLength: prediction.segments.length,
        });
      },
      syncBallNodes: (ballStates: BallRenderState[]) => {
        rendererState.syncBallNodesCalls.push(structuredClone(ballStates));
      },
      syncIdleBallNodes: (ballStates: BallRenderState[], activeBallIds: ReadonlySet<string>) => {
        rendererState.syncIdleBallNodesCalls.push({
          ballStates: structuredClone(ballStates),
          activeBallIds: Array.from(activeBallIds),
        });
      },
    },
    rendererState,
  };
}

test('BallStepAnimator syncs ball nodes, starts a step, emits progress, and clears active state on finish', () => {
  const { runtime, runtimeState } = createAnimatorRuntimeStub();
  const { renderer, rendererState } = createAnimatorRendererStub();
  const animator = new BallStepAnimator({
    runtime: runtime as never,
    renderer: renderer as never,
  });

  const progressEvents: number[] = [];
  animator.addProgressListener((event) => {
    progressEvents.push(event.progress);
  });

  animator.update(0);
  assert.deepEqual(runtimeState.tickCalls, ['ball-1']);
  assert.deepEqual(Array.from(animator.getActiveBallIds()), ['ball-1']);
  assert.equal(rendererState.syncBallNodesCalls.length, 1);
  assert.deepEqual(rendererState.setBallPositionCalls[0], {
    ballId: 'ball-1',
    coord: { row: 3, col: 0 },
  });

  animator.update(400);
  assert.deepEqual(progressEvents, [100, 0]);
  assert.deepEqual(rendererState.setBallPositionCalls.at(-1), {
    ballId: 'ball-1',
    coord: { row: 3, col: 0.5 },
  });

  animator.update(400);
  assert.deepEqual(progressEvents, [100, 0, 50]);
  assert.deepEqual(Array.from(animator.getActiveBallIds()), []);
  assert.deepEqual(rendererState.setBallPositionCalls.at(-1), {
    ballId: 'ball-1',
    coord: { row: 3, col: 1 },
  });

  animator.clear();
  assert.deepEqual(Array.from(animator.getActiveBallIds()), []);
});

test('BallStepAnimator advances a newly started step in the same frame', () => {
  const { runtime, runtimeState } = createAnimatorRuntimeStub();
  const { renderer, rendererState } = createAnimatorRendererStub();
  const animator = new BallStepAnimator({
    runtime: runtime as never,
    renderer: renderer as never,
  });

  animator.update(100);

  assert.deepEqual(runtimeState.tickCalls, ['ball-1']);
  assert.deepEqual(Array.from(animator.getActiveBallIds()), ['ball-1']);
  assert.deepEqual(rendererState.setBallPositionCalls, [
    {
      ballId: 'ball-1',
      coord: { row: 3, col: 0.125 },
    },
  ]);
});

test('BallStepAnimator carries overflow delta into the next step instead of dropping it', () => {
  const { runtime, runtimeState } = createSequentialAnimatorRuntimeStub();
  const { renderer, rendererState } = createAnimatorRendererStub();
  const animator = new BallStepAnimator({
    runtime: runtime as never,
    renderer: renderer as never,
  });

  animator.update(900);

  assert.deepEqual(runtimeState.tickCalls, ['ball-1', 'ball-1']);
  assert.deepEqual(Array.from(animator.getActiveBallIds()), ['ball-1']);
  assert.deepEqual(rendererState.setBallPositionCalls, [
    {
      ballId: 'ball-1',
      coord: { row: 3, col: 1 },
    },
    {
      ballId: 'ball-1',
      coord: { row: 3, col: 1 },
    },
    {
      ballId: 'ball-1',
      coord: { row: 3, col: 1.125 },
    },
  ]);
});

test('BoardPresentationRefresher batches entity and prediction refreshes until flush', () => {
  const { runtime } = createRefresherRuntimeStub();
  const { renderer, rendererState } = createRefresherRendererStub();
  const refresher = new BoardPresentationRefresher({
    runtime: runtime as never,
    renderer: renderer as never,
    getActiveBallIds: () => new Set(['ball-1']),
  });

  const event: BoardEntityChangeEvent = {
    kind: 'placed',
    changedCoords: [{ row: 3, col: 1 }],
    requiresPredictionRefresh: true,
  };

  refresher.handleEntityChange(event);
  assert.equal(rendererState.rebuildEntityLayerCalls.length, 0);
  assert.equal(rendererState.renderPredictionPathCalls.length, 0);

  refresher.flushPendingPresentationRefreshes();
  assert.equal(rendererState.rebuildEntityLayerCalls.length, 1);
  assert.equal(rendererState.renderPredictionPathCalls.length, 1);

  refresher.flushPendingPresentationRefreshes();
  assert.equal(rendererState.rebuildEntityLayerCalls.length, 1);
  assert.equal(rendererState.renderPredictionPathCalls.length, 1);
});

test('BoardPresentationRefresher refreshBoardPresentation rebuilds layout and refreshIdleBallPresentation only syncs balls', () => {
  const { runtime } = createRefresherRuntimeStub();
  const { renderer, rendererState } = createRefresherRendererStub();
  const refresher = new BoardPresentationRefresher({
    runtime: runtime as never,
    renderer: renderer as never,
    getActiveBallIds: () => new Set(['ball-1']),
  });

  refresher.refreshBoardPresentation();
  assert.equal(rendererState.rebuildEntityLayerCalls.length, 1);
  assert.equal(rendererState.renderPredictionPathCalls.length, 1);
  assert.equal(rendererState.syncBallNodesCalls.length, 1);
  assert.deepEqual(rendererState.syncIdleBallNodesCalls[0]?.activeBallIds, ['ball-1']);

  refresher.refreshIdleBallPresentation();
  assert.equal(rendererState.rebuildEntityLayerCalls.length, 1);
  assert.equal(rendererState.renderPredictionPathCalls.length, 1);
  assert.equal(rendererState.syncBallNodesCalls.length, 2);
  assert.equal(rendererState.syncIdleBallNodesCalls.length, 2);
});

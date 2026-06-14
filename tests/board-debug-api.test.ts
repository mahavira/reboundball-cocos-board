import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBoardDebugApi,
  formatBoardDebugStatus,
  type BoardDebugHost,
} from '../assets/scripts/board-debug/board-debug-api.ts';
import { createBoardPreset } from '../assets/scripts/board-runtime/BoardRuntime.ts';

function createHostSpy(): BoardDebugHost & {
  calls: string[];
  nodeTreeText: string;
} {
  const preset = createBoardPreset();
  const calls: string[] = [];
  const nodeTreeText = '|-- GameRoot\n|---- BoardLayerNode\n';

  return {
    calls,
    nodeTreeText,
    getState: () => {
      calls.push('getState');
      return {
        ...preset,
        balls: [],
      };
    },
    getBalls: () => {
      calls.push('getBalls');
      return [];
    },
    getEntities: () => {
      calls.push('getEntities');
      return [];
    },
    placeEntity: () => {
      calls.push('placeEntity');
    },
    removeEntity: () => {
      calls.push('removeEntity');
    },
    rotateEntity: () => {
      calls.push('rotateEntity');
      return null;
    },
    upgradeEntity: () => {
      calls.push('upgradeEntity');
      return null;
    },
    spawnBall: () => {
      calls.push('spawnBall');
      return {
        ballId: 'ball-1',
        cell: { row: 3, col: 0 },
        direction: 'right',
        isFast: false,
        speedMultiplier: 1,
      };
    },
    spawnFastBall: () => {
      calls.push('spawnFastBall');
      return {
        ballId: 'fast-ball-1',
        cell: { row: 3, col: 0 },
        direction: 'right',
        isFast: true,
        speedMultiplier: 1,
      };
    },
    clearBalls: () => {
      calls.push('clearBalls');
    },
    pause: () => {
      calls.push('pause');
    },
    resume: () => {
      calls.push('resume');
    },
    resetBoard: () => {
      calls.push('resetBoard');
    },
    driveBallStepOnce: () => {
      calls.push('driveBallStepOnce');
    },
    isPaused: () => {
      calls.push('isPaused');
      return true;
    },
    getNodeTreeText: () => {
      calls.push('getNodeTreeText');
      return nodeTreeText;
    },
    onBallProgress: () => {
      calls.push('onBallProgress');
      return () => undefined;
    },
  };
}

test('createBoardDebugApi delegates debug commands through host boundary', () => {
  const host = createHostSpy();
  const logs: string[] = [];
  const api = createBoardDebugApi(host, {
    writeLine: (line) => {
      logs.push(line);
    },
  });

  const ball = api.spawnFastBall();
  api.pause();
  api.tickStep();
  api.nodeTree();

  assert.equal(ball.ballId, 'fast-ball-1');
  assert.deepEqual(logs, [host.nodeTreeText]);
  assert.deepEqual(host.calls, ['spawnFastBall', 'pause', 'driveBallStepOnce', 'getNodeTreeText']);
});

test('formatBoardDebugStatus renders entry and console path outside main board component', () => {
  const status = formatBoardDebugStatus({
    ballsCount: 2,
    paused: false,
    entryCoord: { row: 3, col: 0 },
    consolePath: 'globalThis.boardDebug',
  });

  assert.equal(
    status,
    ['Balls: 2', 'Paused: no', 'Entry: (3, 0)', 'Console: globalThis.boardDebug'].join('\n'),
  );
});

test('formatBoardDebugStatus still renders pause state without selected cell text', () => {
  const status = formatBoardDebugStatus({
    ballsCount: 1,
    paused: true,
    entryCoord: { row: 3, col: 0 },
    consolePath: 'globalThis.boardDebug',
  });

  assert.match(status, /Paused: yes/);
});

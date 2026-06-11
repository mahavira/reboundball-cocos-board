import type {
  BoardDebugApi,
  BoardDebugApiOptions,
  BoardDebugHost,
  BoardDebugStatusOptions,
} from '../shared/types.ts';

/** 生成调试控制台 API，所有命令都通过 host 边界委托给主棋盘组件。 */
export function createBoardDebugApi(host: BoardDebugHost, options?: BoardDebugApiOptions): BoardDebugApi {
  const writeLine = options?.writeLine ?? ((line: string) => console.log(line));

  return {
    getState: () => host.getState(),
    getBalls: () => host.getBalls(),
    getEntities: () => host.getEntities(),
    placeEntity: (spec) => {
      host.placeEntity(spec);
    },
    removeEntity: (coord) => {
      host.removeEntity(coord);
    },
    rotateEntity: (coord) => host.rotateEntity(coord),
    upgradeEntity: (coord) => host.upgradeEntity(coord),
    spawnBall: () => host.spawnBall(),
    spawnFastBall: () => host.spawnFastBall(),
    clearBalls: () => {
      host.clearBalls();
    },
    pause: () => {
      host.pause();
    },
    resume: () => {
      host.resume();
    },
    resetBoard: () => {
      host.resetBoard();
    },
    tickStep: () => {
      host.driveBallStepOnce();
    },
    nodeTree: () => {
      writeLine(host.getNodeTreeText());
    },
    onBallProgress: (listener) => host.onBallProgress(listener),
  };
}

/** 调试状态文案由独立模块生成，避免主棋盘组件持有调试 UI 拼装逻辑。 */
export function formatBoardDebugStatus(options: BoardDebugStatusOptions): string {
  return [
    `Balls: ${options.ballsCount}`,
    `Paused: ${options.paused ? 'yes' : 'no'}`,
    `Entry: (${options.entryCoord.row}, ${options.entryCoord.col})`,
    `Console: ${options.consolePath}`,
  ].join('\n');
}

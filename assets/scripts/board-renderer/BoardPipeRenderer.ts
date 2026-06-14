import { instantiate, Node, Prefab, resources } from 'cc';

import type { BoardCoordinateMapper } from './BoardCoordinateMapper.ts';
import { buildPipePath } from '../board-runtime/board-runtime-rules.ts';
import { BOARD_SIZE, DEFAULT_ENTRY } from '../board-runtime/constants.ts';
import type { GridCoord } from '../shared/types.ts';

const PIPE_NODE_PREFAB_PATH = 'prefabs/PipeNode';
const PIPE_BEND_PREFAB_PATH = 'prefabs/PipeBend';

type BoardPipeRendererOptions = {
  getPipeLayerNode: () => Node;
  coordinateMapper: BoardCoordinateMapper;
};

/** 加载并绘制外圈 pipe prefab，保持 board-prediction/runtime 之外的纯表现职责。 */
export class BoardPipeRenderer {
  private readonly getPipeLayerNode: () => Node;
  private readonly coordinateMapper: BoardCoordinateMapper;
  private pipeNodePrefab: Prefab | null = null;
  private pipeBendPrefab: Prefab | null = null;
  private isPipePrefabLoadStarted = false;

  constructor(options: BoardPipeRendererOptions) {
    this.getPipeLayerNode = options.getPipeLayerNode;
    this.coordinateMapper = options.coordinateMapper;
  }

  render(): void {
    if (this.isPipePrefabLoadStarted) {
      return;
    }

    this.isPipePrefabLoadStarted = true;
    resources.load(PIPE_NODE_PREFAB_PATH, Prefab, (nodeError, pipeNodePrefab) => {
      if (nodeError) {
        console.warn(`Failed to load ${PIPE_NODE_PREFAB_PATH}`, nodeError);
        return;
      }

      this.pipeNodePrefab = pipeNodePrefab;
      this.tryRenderPipePrefabLayer();
    });

    resources.load(PIPE_BEND_PREFAB_PATH, Prefab, (bendError, pipeBendPrefab) => {
      if (bendError) {
        console.warn(`Failed to load ${PIPE_BEND_PREFAB_PATH}`, bendError);
        return;
      }

      this.pipeBendPrefab = pipeBendPrefab;
      this.tryRenderPipePrefabLayer();
    });
  }

  private tryRenderPipePrefabLayer(): void {
    if (!this.pipeNodePrefab || !this.pipeBendPrefab) {
      return;
    }

    const pipeLayerNode = this.getPipeLayerNode();
    pipeLayerNode.destroyAllChildren();

    const pipePath = buildPipePath(BOARD_SIZE, DEFAULT_ENTRY);
    for (let index = 0; index < pipePath.length; index += 1) {
      const coord = pipePath[index];
      const previousCoord = pipePath[(index - 1 + pipePath.length) % pipePath.length];
      const nextCoord = pipePath[(index + 1) % pipePath.length];
      const segment = resolvePipePrefabSegment(previousCoord, coord, nextCoord);
      const pipeNode = instantiate(segment.isBend ? this.pipeBendPrefab : this.pipeNodePrefab);

      pipeNode.name = `Pipe-${coord.row}-${coord.col}`;
      pipeNode.setParent(pipeLayerNode);
      pipeNode.setPosition(this.coordinateMapper.getCachedGridPosition(coord));
      pipeNode.setRotationFromEuler(0, 0, segment.rotationZ);
    }
  }
}

type PipeStepDirection = 'up' | 'down' | 'left' | 'right';

interface PipePrefabSegment {
  isBend: boolean;
  rotationZ: number;
}

function resolvePipePrefabSegment(previousCoord: GridCoord, coord: GridCoord, nextCoord: GridCoord): PipePrefabSegment {
  const incomingDirection = resolveStepDirection(coord, previousCoord);
  const outgoingDirection = resolveStepDirection(coord, nextCoord);

  if (isOppositePipeDirection(incomingDirection, outgoingDirection)) {
    let rotationZ = 0;
    if (incomingDirection === 'up') rotationZ = 90;
    if (incomingDirection === 'down') rotationZ = -90;
    if (incomingDirection === 'left') rotationZ = 180;
    return {
      isBend: false,
      rotationZ,
    };
  }

  return {
    isBend: true,
    rotationZ: resolvePipeBendRotation(incomingDirection, outgoingDirection),
  };
}

function resolveStepDirection(fromCoord: GridCoord, toCoord: GridCoord): PipeStepDirection {
  if (toCoord.row < fromCoord.row) {
    return 'up';
  }
  if (toCoord.row > fromCoord.row) {
    return 'down';
  }
  if (toCoord.col < fromCoord.col) {
    return 'left';
  }
  return 'right';
}

function isOppositePipeDirection(firstDirection: PipeStepDirection, secondDirection: PipeStepDirection): boolean {
  return (
    (firstDirection === 'up' && secondDirection === 'down')
    || (firstDirection === 'down' && secondDirection === 'up')
    || (firstDirection === 'left' && secondDirection === 'right')
    || (firstDirection === 'right' && secondDirection === 'left')
  );
}

function resolvePipeBendRotation(
  incomingDirection: PipeStepDirection,
  outgoingDirection: PipeStepDirection,
): number {
  const directionPairKey = `${incomingDirection}-${outgoingDirection}`;
  switch (directionPairKey) {
    case 'right-down':
    case 'down-right':
      return 0;
    case 'down-left':
    case 'left-down':
      return -90;
    case 'left-up':
    case 'up-left':
      return 180;
    case 'up-right':
    case 'right-up':
      return 90;
    default:
      return 0;
  }
}

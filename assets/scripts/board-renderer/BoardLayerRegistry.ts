import { Node } from 'cc';

import { BOARD_SIZE_PX } from './board-renderer-constants.ts';
import { createChild, setNodeSize } from './board-renderer-node-utils.ts';

const BOARD_LAYER_NAME = 'BoardLayerNode';

const RENDER_LAYERS = {
  grid: 'BoardGridLayer',
  pipe: 'BoardPipeLayer',
  entity: 'BoardEntityLayer',
  prediction: 'BoardPredictionLayer',
  dragHighlight: 'BoardDragHighlightLayer',
  ball: 'BoardBallLayer',
} as const;

/** 只管理棋盘渲染层级，不承载任何具体绘制逻辑。 */
export class BoardLayerRegistry {
  private readonly rootNode: Node;
  private boardLayerNodeValue!: Node;
  private gridLayerNodeValue!: Node;
  private pipeLayerNodeValue!: Node;
  private entityLayerNodeValue!: Node;
  private predictionLayerNodeValue!: Node;
  private dragHighlightLayerNodeValue!: Node;
  private ballLayerNodeValue!: Node;

  constructor(rootNode: Node) {
    this.rootNode = rootNode;
  }

  initialize(): void {
    this.boardLayerNodeValue = this.rootNode.getChildByName(BOARD_LAYER_NAME)
      ?? createChild(this.rootNode, BOARD_LAYER_NAME);
    setNodeSize(this.rootNode, BOARD_SIZE_PX, BOARD_SIZE_PX);
    setNodeSize(this.boardLayerNodeValue, BOARD_SIZE_PX, BOARD_SIZE_PX);

    this.gridLayerNodeValue = this.ensureLayer(RENDER_LAYERS.grid);
    this.pipeLayerNodeValue = this.ensureLayer(RENDER_LAYERS.pipe);
    this.entityLayerNodeValue = this.ensureLayer(RENDER_LAYERS.entity);
    this.predictionLayerNodeValue = this.ensureLayer(RENDER_LAYERS.prediction);
    this.dragHighlightLayerNodeValue = this.ensureLayer(RENDER_LAYERS.dragHighlight);
    this.ballLayerNodeValue = this.ensureLayer(RENDER_LAYERS.ball);
  }

  get boardLayerNode(): Node {
    return this.boardLayerNodeValue;
  }

  get gridLayerNode(): Node {
    return this.gridLayerNodeValue;
  }

  get pipeLayerNode(): Node {
    return this.pipeLayerNodeValue;
  }

  get entityLayerNode(): Node {
    return this.entityLayerNodeValue;
  }

  get predictionLayerNode(): Node {
    return this.predictionLayerNodeValue;
  }

  get dragHighlightLayerNode(): Node {
    return this.dragHighlightLayerNodeValue;
  }

  get ballLayerNode(): Node {
    return this.ballLayerNodeValue;
  }

  private ensureLayer(layerName: string): Node {
    const layerNode = this.boardLayerNodeValue.getChildByName(layerName)
      ?? createChild(this.boardLayerNodeValue, layerName);
    setNodeSize(layerNode, BOARD_SIZE_PX, BOARD_SIZE_PX);
    return layerNode;
  }
}

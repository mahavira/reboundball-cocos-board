import { Color, Graphics, Node } from 'cc';

import type { BoardCoordinateMapper } from './BoardCoordinateMapper.ts';
import { createChild } from './board-renderer-node-utils.ts';
import { createDashedPredictionPolylines } from '../board-prediction/board-prediction-render-utils.ts';
import type { PredictionPathResult } from '../shared/types.ts';

type BoardPredictionPathRendererOptions = {
  getPredictionLayerNode: () => Node;
  coordinateMapper: BoardCoordinateMapper;
};

/** 只消费预测结果并绘制路径，不参与路径推演。 */
export class BoardPredictionPathRenderer {
  private readonly getPredictionLayerNode: () => Node;
  private readonly coordinateMapper: BoardCoordinateMapper;
  private predictionPathNode: Node | null = null;
  private predictionPathGraphics: Graphics | null = null;

  constructor(options: BoardPredictionPathRendererOptions) {
    this.getPredictionLayerNode = options.getPredictionLayerNode;
    this.coordinateMapper = options.coordinateMapper;
  }

  clear(): void {
    const graphics = this.ensurePredictionPathGraphics();
    graphics.clear();
    if (this.predictionPathNode) {
      this.predictionPathNode.active = false;
    }
  }

  render(prediction: PredictionPathResult): void {
    const graphics = this.ensurePredictionPathGraphics();
    graphics.clear();

    if (prediction.isEmpty || prediction.segments.length === 0) {
      if (this.predictionPathNode) {
        this.predictionPathNode.active = false;
      }
      return;
    }

    if (this.predictionPathNode) {
      this.predictionPathNode.active = true;
    }

    graphics.strokeColor = new Color(251, 191, 36, 220);
    graphics.lineWidth = 2;
    graphics.lineCap = Graphics.LineCap.BUTT;
    graphics.lineJoin = Graphics.LineJoin.ROUND;

    const pathPoints = [
      this.coordinateMapper.getCachedGridPosition(prediction.segments[0].from),
      ...prediction.segments.map((segment) => this.coordinateMapper.getCachedGridPosition(segment.to)),
    ];

    for (const dashedPolyline of createDashedPredictionPolylines(pathPoints)) {
      if (dashedPolyline.length === 0) {
        continue;
      }

      graphics.moveTo(dashedPolyline[0].x, dashedPolyline[0].y);
      for (let index = 1; index < dashedPolyline.length; index += 1) {
        graphics.lineTo(dashedPolyline[index].x, dashedPolyline[index].y);
      }
    }
    graphics.stroke();
  }

  private ensurePredictionPathGraphics(): Graphics {
    if (this.predictionPathGraphics && this.predictionPathNode?.isValid) {
      return this.predictionPathGraphics;
    }

    this.predictionPathNode = createChild(this.getPredictionLayerNode(), 'PredictionPathNode');
    this.predictionPathNode.active = false;
    this.predictionPathGraphics = this.predictionPathNode.addComponent(Graphics);
    return this.predictionPathGraphics;
  }
}

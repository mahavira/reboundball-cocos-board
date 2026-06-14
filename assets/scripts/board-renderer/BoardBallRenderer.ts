import { Node, resources, Sprite, SpriteFrame } from 'cc';

import type { BoardCoordinateMapper } from './BoardCoordinateMapper.ts';
import { BALL_RADIUS, BALL_SPRITE_FRAME_PATH } from './board-renderer-constants.ts';
import { createChild, setNodeSize } from './board-renderer-node-utils.ts';
import type { BallRenderState, GridCoord } from '../shared/types.ts';

type BoardBallRendererOptions = {
  getBallLayerNode: () => Node;
  coordinateMapper: BoardCoordinateMapper;
};

/** 管理弹球节点集合、sprite 加载和位置/旋转同步。 */
export class BoardBallRenderer {
  private readonly getBallLayerNode: () => Node;
  private readonly coordinateMapper: BoardCoordinateMapper;
  private readonly ballNodeMap = new Map<string, Node>();
  private readonly currentBallIds = new Set<string>();
  private ballSpriteFrame: SpriteFrame | null = null;
  private isBallSpriteLoadStarted = false;

  constructor(options: BoardBallRendererOptions) {
    this.getBallLayerNode = options.getBallLayerNode;
    this.coordinateMapper = options.coordinateMapper;
  }

  syncBallNodes(ballStates: BallRenderState[]): void {
    this.removeStaleBallNodes(ballStates);
    this.createMissingBallNodes(ballStates);
  }

  syncIdleBallNodes(ballStates: BallRenderState[], activeBallIds: ReadonlySet<string>): void {
    for (const ball of ballStates) {
      if (activeBallIds.has(ball.ballId)) {
        continue;
      }
      this.setBallPosition(ball.ballId, ball.cell);
    }
  }

  setBallPosition(ballId: string, coord: GridCoord): boolean {
    const ballNode = this.ballNodeMap.get(ballId);
    if (!ballNode) {
      return false;
    }
    ballNode.setPosition(this.coordinateMapper.resolveGridPosition(coord));
    return true;
  }

  rotateBall(ballId: string, rotationDeltaDegrees: number): boolean {
    const ballNode = this.ballNodeMap.get(ballId);
    if (!ballNode) {
      return false;
    }

    const currentEuler = ballNode.eulerAngles;
    ballNode.setRotationFromEuler(currentEuler.x, currentEuler.y, currentEuler.z + rotationDeltaDegrees);
    return true;
  }

  private removeStaleBallNodes(ballStates: BallRenderState[]): void {
    this.currentBallIds.clear();
    for (const ball of ballStates) {
      this.currentBallIds.add(ball.ballId);
    }

    for (const [ballId, node] of this.ballNodeMap.entries()) {
      if (this.currentBallIds.has(ballId)) {
        continue;
      }
      node.destroy();
      this.ballNodeMap.delete(ballId);
    }
  }

  private createMissingBallNodes(ballStates: BallRenderState[]): void {
    for (const ball of ballStates) {
      if (this.ballNodeMap.has(ball.ballId)) {
        continue;
      }

      const ballNode = this.createBallNode(ball);
      this.ballNodeMap.set(ball.ballId, ballNode);
    }
  }

  private createBallNode(ball: BallRenderState): Node {
    const ballNode = createChild(this.getBallLayerNode(), `Ball-${ball.ballId}`);
    setNodeSize(ballNode, BALL_RADIUS * 2, BALL_RADIUS * 2);
    const sprite = ballNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.applyBallSpriteFrame(sprite);
    this.loadBallSpriteFrame();
    return ballNode;
  }

  private loadBallSpriteFrame(): void {
    if (this.ballSpriteFrame || this.isBallSpriteLoadStarted) {
      return;
    }

    this.isBallSpriteLoadStarted = true;
    resources.load(BALL_SPRITE_FRAME_PATH, SpriteFrame, (error, spriteFrame) => {
      if (error) {
        console.warn(`Failed to load ${BALL_SPRITE_FRAME_PATH}`, error);
        return;
      }

      this.ballSpriteFrame = spriteFrame;
      this.applyBallSpriteFrameToExistingBalls();
    });
  }

  private applyBallSpriteFrameToExistingBalls(): void {
    for (const ballNode of this.ballNodeMap.values()) {
      const sprite = ballNode.getComponent(Sprite);
      if (sprite) {
        this.applyBallSpriteFrame(sprite);
      }
    }
  }

  private applyBallSpriteFrame(sprite: Sprite): void {
    if (!this.ballSpriteFrame) {
      return;
    }

    sprite.spriteFrame = this.ballSpriteFrame;
  }
}

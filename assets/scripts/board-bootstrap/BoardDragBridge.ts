import { Color, EventTouch, Label, Node, Sprite, UITransform, Vec3 } from 'cc';

import { BoardRenderer } from '../board-renderer/BoardRenderer.ts';
import { BoardRuntime } from '../board-runtime/BoardRuntime.ts';
import { cloneCoord } from '../shared/helpers.ts';
import { ShopDragController } from '../shop/ShopDragController.ts';
import { ShopDragPreviewRenderer } from '../shop/ShopDragPreviewRenderer.ts';
import {
  getEntityRecycleGoldRefund,
  INITIAL_GOLD_BALANCE,
} from '../shop/shop-gold-rules.ts';
import { canDragEntityFromBoard, canRecycleEntityFromBoard } from '../shared/entity-registry.ts';
import type {
  BoardPlacementSource,
  BoardShopHost,
  EntityState,
  UiPoint,
} from '../shared/types.ts';

interface BoardDragBridgeOptions {
  rootNode: Node;
  runtime: BoardRuntime;
  renderer: BoardRenderer;
}

/**
 * 把棋盘上的实体拖拽交互从场景引导组件中剥离出来。
 *
 * 事件绑定在稳定的 rootNode 上，而不是绑定在会被重建的实体节点上。
 */
export class BoardDragBridge {
  private readonly rootNode: Node;
  private readonly runtime: BoardRuntime;
  private readonly renderer: BoardRenderer;
  private readonly dragController: ShopDragController;
  private readonly recoveryNode: Node | null;
  private readonly recoveryDefaultColor: Color | null;
  private recoveryRefundLabelNode: Node | null = null;
  private recoveryRefundLabel: Label | null = null;
  private goldBalance = INITIAL_GOLD_BALANCE;
  private readonly goldBalanceListeners = new Set<(balance: number) => void>();

  constructor(options: BoardDragBridgeOptions) {
    this.rootNode = options.rootNode;
    this.runtime = options.runtime;
    this.renderer = options.renderer;
    this.recoveryNode = this.rootNode.getChildByName('Recovery');
    this.recoveryDefaultColor = this.recoveryNode?.getComponent(Sprite)?.color.clone() ?? null;
    this.dragController = new ShopDragController({
      host: this.getShopHost(),
      onPlacementSuccess: () => undefined,
    });
  }

  bind(): void {
    this.rootNode.on(Node.EventType.TOUCH_START, this.handleBoardTouchStart, this);
    this.rootNode.on(Node.EventType.TOUCH_MOVE, this.handleBoardTouchMove, this);
    this.rootNode.on(Node.EventType.TOUCH_END, this.handleBoardTouchEnd, this);
    this.rootNode.on(Node.EventType.TOUCH_CANCEL, this.handleBoardTouchCancel, this);
  }

  unbind(): void {
    this.rootNode.off(Node.EventType.TOUCH_START, this.handleBoardTouchStart, this);
    this.rootNode.off(Node.EventType.TOUCH_MOVE, this.handleBoardTouchMove, this);
    this.rootNode.off(Node.EventType.TOUCH_END, this.handleBoardTouchEnd, this);
    this.rootNode.off(Node.EventType.TOUCH_CANCEL, this.handleBoardTouchCancel, this);
  }

  /** 向商店模块暴露最小 host 契约，避免 UI 逻辑直接依赖 runtime/renderer 私有字段。 */
  getShopHost(): BoardShopHost {
    return {
      resolveGridCoordFromUiPoint: (uiPoint) => this.renderer.resolveGridCoordFromUiPoint(uiPoint),
      getEntityAt: (coord) => this.runtime.getEntityAt(coord),
      removeEntity: (coord) => {
        this.runtime.removeEntity(coord);
      },
      placeEntity: (spec, changeKind = 'placed') => {
        this.runtime.placeEntity(spec, changeKind);
      },
      isRecycleUiPoint: (uiPoint) => this.isRecycleUiPoint(uiPoint),
      canRecyclePlacedEntity: (source) => canRecycleEntityFromBoard(source.entity),
      recyclePlacedEntity: (source) => {
        this.runtime.removeEntity(source.coord);
        this.addGold(getEntityRecycleGoldRefund(source.entity));
      },
      showRecycleFeedback: (refundGold) => this.showRecycleFeedback(refundGold),
      clearRecycleFeedback: () => this.clearRecycleFeedback(),
      spawnBall: () => {
        this.runtime.spawnBall({ isFast: false });
      },
      showPlacementHighlight: (coord, state) => {
        this.renderer.showPlacementHighlight(coord, state);
      },
      clearPlacementHighlight: () => {
        this.renderer.clearPlacementHighlight();
      },
      createDragPreview: (item) => ShopDragPreviewRenderer.createDragPreviewNode(this.rootNode, item),
      updateDragPreviewPosition: (previewHandle, uiPoint) => {
        this.updateDragPreviewNodePosition(previewHandle, uiPoint);
      },
      destroyDragPreview: (previewHandle) => {
        if (previewHandle instanceof Node && previewHandle.isValid) {
          previewHandle.destroy();
        }
      },
      getGoldBalance: () => this.goldBalance,
      trySpendGold: (amount) => this.trySpendGold(amount),
      addGold: (amount) => this.addGold(amount),
      getRecycleRefund: (entity) => this.getRecycleRefund(entity),
      onGoldBalanceChanged: (listener) => this.onGoldBalanceChanged(listener),
    };
  }

  private trySpendGold(amount: number): boolean {
    if (amount <= 0) {
      return true;
    }

    if (this.goldBalance < amount) {
      return false;
    }

    this.setGoldBalance(this.goldBalance - amount);
    return true;
  }

  private addGold(amount: number): void {
    if (amount <= 0) {
      return;
    }

    this.setGoldBalance(this.goldBalance + amount);
  }

  private getRecycleRefund(entity: EntityState): number {
    return canRecycleEntityFromBoard(entity)
      ? getEntityRecycleGoldRefund(entity)
      : 0;
  }

  private onGoldBalanceChanged(listener: (balance: number) => void): () => void {
    this.goldBalanceListeners.add(listener);
    listener(this.goldBalance);
    return () => {
      this.goldBalanceListeners.delete(listener);
    };
  }

  private setGoldBalance(nextBalance: number): void {
    if (nextBalance === this.goldBalance) {
      return;
    }

    this.goldBalance = nextBalance;
    this.goldBalanceListeners.forEach((listener) => listener(this.goldBalance));
  }

  /** 回收区是场景静态节点，动态金额标签只作为拖拽期间的临时反馈。 */
  private showRecycleFeedback(refundGold: number): void {
    if (!this.recoveryNode) {
      return;
    }

    const recoverySprite = this.recoveryNode.getComponent(Sprite);
    if (recoverySprite) {
      recoverySprite.color = new Color(250, 204, 21, 255);
    }

    const refundLabel = this.ensureRecoveryRefundLabel();
    if (!refundLabel) {
      return;
    }

    refundLabel.node.active = true;
    refundLabel.string = `+${refundGold}`;
  }

  private clearRecycleFeedback(): void {
    if (this.recoveryNode && this.recoveryDefaultColor) {
      const recoverySprite = this.recoveryNode.getComponent(Sprite);
      if (recoverySprite) {
        recoverySprite.color = this.recoveryDefaultColor;
      }
    }

    if (this.recoveryRefundLabelNode) {
      this.recoveryRefundLabelNode.active = false;
    }
  }

  private ensureRecoveryRefundLabel(): Label | null {
    if (!this.recoveryNode) {
      return null;
    }

    if (this.recoveryRefundLabel?.isValid) {
      return this.recoveryRefundLabel;
    }

    this.recoveryRefundLabelNode =
      this.recoveryNode.getChildByName('RecoveryRefundLabelNode') ?? new Node('RecoveryRefundLabelNode');
    if (!this.recoveryRefundLabelNode.parent) {
      this.recoveryNode.addChild(this.recoveryRefundLabelNode);
    }

    const labelTransform = this.recoveryRefundLabelNode.getComponent(UITransform)
      ?? this.recoveryRefundLabelNode.addComponent(UITransform);
    labelTransform.setContentSize(90, 28);
    this.recoveryRefundLabelNode.setPosition(new Vec3(0, -58, 0));

    this.recoveryRefundLabel = this.recoveryRefundLabelNode.getComponent(Label)
      ?? this.recoveryRefundLabelNode.addComponent(Label);
    this.recoveryRefundLabel.fontSize = 22;
    this.recoveryRefundLabel.lineHeight = 24;
    this.recoveryRefundLabel.color = new Color(250, 204, 21, 255);
    this.recoveryRefundLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.recoveryRefundLabel.verticalAlign = Label.VerticalAlign.CENTER;

    return this.recoveryRefundLabel;
  }

  /** 把全局 UI 坐标映射回 GameRootNode 本地坐标，供拖拽预览自由跟随。 */
  private updateDragPreviewNodePosition(previewHandle: unknown, uiPoint: UiPoint): void {
    if (!(previewHandle instanceof Node)) {
      return;
    }

    const rootTransform = this.rootNode.getComponent(UITransform);
    if (!rootTransform) {
      return;
    }

    const localPoint = rootTransform.convertToNodeSpaceAR(new Vec3(uiPoint.x, uiPoint.y, 0));
    previewHandle.setPosition(localPoint);
  }

  /** 回收店是场景静态节点；这里只做命中判断，不把删除逻辑散落到 UI 组件里。 */
  private isRecycleUiPoint(uiPoint: UiPoint): boolean {
    if (!this.recoveryNode) {
      return false;
    }

    const recoveryTransform = this.recoveryNode.getComponent(UITransform);
    if (!recoveryTransform) {
      return false;
    }

    const localPoint = recoveryTransform.convertToNodeSpaceAR(new Vec3(uiPoint.x, uiPoint.y, 0));
    const width = recoveryTransform.contentSize.width;
    const height = recoveryTransform.contentSize.height;
    return (
      localPoint.x >= -width / 2
      && localPoint.x <= width / 2
      && localPoint.y >= -height / 2
      && localPoint.y <= height / 2
    );
  }

  private handleBoardTouchStart(eventTouch: EventTouch): void {
    const uiPoint = eventTouch.getUILocation();
    const coord = this.renderer.resolveGridCoordFromUiPoint(uiPoint);
    if (!coord) {
      return;
    }

    const entity = this.runtime.getEntityAt(coord);
    if (!entity || !canDragEntityFromBoard(entity)) {
      return;
    }

    const source: BoardPlacementSource = {
      coord: cloneCoord(entity.coord),
      entity: structuredClone(entity),
    };

    this.dragController.startDrag(
      -1,
      structuredClone(entity),
      uiPoint,
      source,
    );
  }

  private handleBoardTouchMove(eventTouch: EventTouch): void {
    this.dragController.updateActiveDrag(eventTouch);
  }

  private handleBoardTouchEnd(eventTouch: EventTouch): void {
    this.dragController.finishActiveDrag(eventTouch);
  }

  private handleBoardTouchCancel(eventTouch: EventTouch): void {
    this.dragController.finishActiveDrag(eventTouch);
  }
}

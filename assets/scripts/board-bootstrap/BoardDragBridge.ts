import { EventTouch, Node, UITransform, Vec3 } from 'cc';

import { BoardRenderer } from '../board-renderer/BoardRenderer.ts';
import { BoardRuntime } from '../board-runtime/BoardRuntime.ts';
import { cloneCoord } from '../shared/helpers.ts';
import { ShopDragController } from '../shop/ShopDragController.ts';
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
  private goldBalance = INITIAL_GOLD_BALANCE;
  private readonly goldBalanceListeners = new Set<(balance: number) => void>();

  constructor(options: BoardDragBridgeOptions) {
    this.rootNode = options.rootNode;
    this.runtime = options.runtime;
    this.renderer = options.renderer;
    this.recoveryNode = this.rootNode.getChildByName('Recovery');
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
      spawnBall: () => {
        this.runtime.spawnBall({ isFast: false });
      },
      showPlacementHighlight: (coord, state) => {
        this.renderer.showPlacementHighlight(coord, state);
      },
      clearPlacementHighlight: () => {
        this.renderer.clearPlacementHighlight();
      },
      createDragPreview: (item) => BoardRenderer.createDragPreviewNode(this.rootNode, item),
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

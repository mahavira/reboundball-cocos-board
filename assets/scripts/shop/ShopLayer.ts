import { _decorator, Color, Component, EventTouch, Node, Sprite } from 'cc';

import { BoardBootstrap } from '../board-bootstrap/BoardBootstrap.ts';
import { BoardRenderer } from '../board-renderer/BoardRenderer.ts';
import { createRandomShopItems } from './ShopItemFactory.ts';
import { ShopDragController } from './ShopDragController.ts';
import type {
  BoardShopHost,
  ShopItemDefinition,
} from '../shared/types.ts';

const { ccclass, property } = _decorator;

type ShopSlotContext = {
  slotNode: Node;
  entityNode: Node;
  item: ShopItemDefinition | null;
};

/**
 * 商店层只负责现有 UI 节点绑定、商品刷新和拖拽入口。
 * 棋盘规则依然由 BoardPlacementService 与 runtime host 负责，避免把放置逻辑塞回 UI 组件。
 */
@ccclass('ShopLayer')
export class ShopLayer extends Component {
  @property(Node)
  refreshButtonNode: Node | null = null;

  @property(Node)
  spawnBallButtonNode: Node | null = null;

  @property(Node)
  shopItemListNode: Node | null = null;

  @property(Node)
  slotNodes: Node[] = [];

  private readonly slotContexts: ShopSlotContext[] = [];
  private dragController: ShopDragController | null = null;

  onLoad(): void {
    const boardBootstrap = this.node.parent?.getComponent(BoardBootstrap);
    if (!boardBootstrap) {
      throw new Error('ShopLayer requires BoardBootstrap on the parent GameRootNode');
    }

    const host = boardBootstrap.getShopHost();
    this.initializeSlotContexts();
    this.dragController = new ShopDragController({
      host,
      onPlacementSuccess: (slotIndex) => this.consumeSlot(slotIndex),
    });
    this.bindStaticEvents(host);
    this.refreshShopItems();
  }

  onDestroy(): void {
    this.dragController?.cancelActiveDrag();
    this.dragController = null;

    // 显式解绑 bindStaticEvents 中注册的全部事件，避免节点被动态移除时残留监听
    this.refreshButtonNode?.off(Node.EventType.TOUCH_END);
    this.spawnBallButtonNode?.off(Node.EventType.TOUCH_END);

    this.slotContexts.forEach((ctx) => {
      ctx.slotNode.off(Node.EventType.TOUCH_START);
      ctx.slotNode.off(Node.EventType.TOUCH_MOVE);
      ctx.slotNode.off(Node.EventType.TOUCH_END);
      ctx.slotNode.off(Node.EventType.TOUCH_CANCEL);
    });
  }

  /** 刷新只替换槽位数据和图标，不重建节点，也不重复绑定事件。 */
  private refreshShopItems(): void {
    const items = createRandomShopItems(this.slotContexts.length);
    this.slotContexts.forEach((slotContext, index) => {
      this.setSlotItem(index, items[index] ?? null);
    });
  }

  private consumeSlot(slotIndex: number): void {
    this.setSlotItem(slotIndex, null);
    if (this.slotContexts.every((slotContext) => slotContext.item === null)) {
      this.refreshShopItems();
    }
  }

  private setSlotItem(slotIndex: number, item: ShopItemDefinition | null): void {
    const slotContext = this.slotContexts[slotIndex];
    slotContext.item = item;
    BoardRenderer.renderShopItemIcon(slotContext.entityNode, item);
    this.updateSlotVisualState(slotContext);
  }

  private initializeSlotContexts(): void {
    this.slotNodes.forEach((slotNode, index) => {
      if (!slotNode) {
        throw new Error(`ShopLayer slot node ${index + 1} is not bound`);
      }

      const entityNode = slotNode.getChildByName('Entity');
      if (!entityNode) {
        throw new Error(`Shop slot ${slotNode.name} is missing its Entity child node`);
      }

      this.slotContexts.push({
        slotNode,
        entityNode,
        item: null,
      });
    });
  }

  private bindStaticEvents(host: BoardShopHost): void {
    if (!this.refreshButtonNode || !this.spawnBallButtonNode || !this.shopItemListNode) {
      throw new Error('ShopLayer button/list references must be bound in the editor');
    }

    this.refreshButtonNode.on(Node.EventType.TOUCH_END, this.handleRefreshTouched, this);
    this.spawnBallButtonNode.on(Node.EventType.TOUCH_END, () => {
      host.spawnBall();
    });

    this.slotContexts.forEach((slotContext, index) => {
      slotContext.slotNode.on(Node.EventType.TOUCH_START, (eventTouch: EventTouch) => {
        this.handleSlotTouchStart(index, eventTouch);
      });
      slotContext.slotNode.on(Node.EventType.TOUCH_MOVE, (eventTouch: EventTouch) => {
        this.handleSlotTouchMove(eventTouch);
      });
      slotContext.slotNode.on(Node.EventType.TOUCH_END, (eventTouch: EventTouch) => {
        this.handleSlotTouchEnd(eventTouch);
      });
      slotContext.slotNode.on(Node.EventType.TOUCH_CANCEL, (eventTouch: EventTouch) => {
        this.handleSlotTouchCancel(eventTouch);
      });
    });
  }

  private handleRefreshTouched(): void {
    this.dragController?.cancelActiveDrag();
    this.refreshShopItems();
  }

  /** 只有槽位里存在商品时才进入拖拽态，避免空槽位产生残留预览。 */
  private handleSlotTouchStart(slotIndex: number, eventTouch: EventTouch): void {
    const slotContext = this.slotContexts[slotIndex];
    if (!slotContext.item || !this.dragController) {
      return;
    }

    this.dragController.startDrag(slotIndex, slotContext.item, eventTouch.getUILocation());
  }

  private handleSlotTouchMove(eventTouch: EventTouch): void {
    this.dragController?.updateActiveDrag(eventTouch);
  }

  private handleSlotTouchEnd(eventTouch: EventTouch): void {
    this.dragController?.finishActiveDrag(eventTouch);
  }

  private handleSlotTouchCancel(eventTouch: EventTouch): void {
    this.dragController?.finishActiveDrag(eventTouch);
  }

  private updateSlotVisualState(slotContext: ShopSlotContext): void {
    const backgroundSprite = slotContext.slotNode.getComponent(Sprite);
    if (!backgroundSprite) {
      return;
    }

    backgroundSprite.color = slotContext.item
      ? new Color(255, 255, 255, 255)
      : new Color(180, 180, 180, 180);
  }
}

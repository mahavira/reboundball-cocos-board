import { _decorator, Color, Component, EventTouch, Label, Node, Sprite } from 'cc';

import { BoardBootstrap } from '../board-bootstrap/BoardBootstrap.ts';
import { BoardRenderer } from '../board-renderer/BoardRenderer.ts';
import { createRandomShopItems } from './ShopItemFactory.ts';
import { ShopDragController } from './ShopDragController.ts';
import { SHOP_REFRESH_GOLD_COST } from './shop-gold-rules.ts';
import type {
  BoardShopHost,
  ShopItemDefinition,
} from '../shared/types.ts';

const { ccclass, property } = _decorator;

type ShopSlotContext = {
  slotNode: Node;
  entityNode: Node;
  priceLabel: Label | null;
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
  private shopHost: BoardShopHost | null = null;
  private goldLabel: Label | null = null;
  private goldLabelDefaultColor: Color | null = null;
  private unsubscribeGoldBalance: (() => void) | null = null;

  onLoad(): void {
    const boardBootstrap = this.node.parent?.getComponent(BoardBootstrap);
    if (!boardBootstrap) {
      throw new Error('ShopLayer requires BoardBootstrap on the parent GameRootNode');
    }

    const host = boardBootstrap.getShopHost();
    this.shopHost = host;
    this.goldLabel = this.resolveGoldLabel();
    this.goldLabelDefaultColor = this.goldLabel ? this.goldLabel.color.clone() : null;
    this.unsubscribeGoldBalance = host.onGoldBalanceChanged((balance) => this.updateGoldLabel(balance));
    this.initializeSlotContexts();
    this.dragController = new ShopDragController({
      host,
      onPlacementSuccess: (slotIndex) => this.consumeSlot(slotIndex),
      onPurchaseBlocked: () => this.showInsufficientGoldFeedback(),
    });
    this.bindStaticEvents(host);
    this.refreshShopItems();
  }

  onDestroy(): void {
    this.dragController?.cancelActiveDrag();
    this.dragController = null;
    this.unsubscribeGoldBalance?.();
    this.unsubscribeGoldBalance = null;

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
    this.updateSlotPriceLabel(slotContext);
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
        priceLabel: slotNode.getChildByName('Label')?.getComponent(Label) ?? null,
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
    if (!this.shopHost?.trySpendGold(SHOP_REFRESH_GOLD_COST)) {
      this.showInsufficientGoldFeedback();
      return;
    }

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

  private updateGoldLabel(balance: number): void {
    if (!this.goldLabel) {
      return;
    }

    this.goldLabel.string = `${balance}`;
  }

  private updateSlotPriceLabel(slotContext: ShopSlotContext): void {
    if (!slotContext.priceLabel) {
      return;
    }

    slotContext.priceLabel.string = slotContext.item ? `${slotContext.item.price}` : '';
  }

  /** 余额不足先反馈到金币 HUD，避免经济规则失败时静默吞掉玩家操作。 */
  private showInsufficientGoldFeedback(): void {
    if (this.goldLabel) {
      const goldLabel = this.goldLabel;
      goldLabel.color = new Color(220, 38, 38, 255);
      this.scheduleOnce(() => {
        if (goldLabel.isValid && this.goldLabelDefaultColor) {
          goldLabel.color = this.goldLabelDefaultColor;
        }
      }, 0.2);
    }

    console.warn('Not enough gold');
  }

  private resolveGoldLabel(): Label | null {
    const sceneRootNode = this.findSceneRootNode();
    return this.findDescendantByName(sceneRootNode, 'GoldCoinNumber')?.getComponent(Label) ?? null;
  }

  private findSceneRootNode(): Node {
    let currentNode = this.node;
    while (currentNode.parent) {
      currentNode = currentNode.parent;
    }

    return currentNode;
  }

  private findDescendantByName(rootNode: Node | null | undefined, nodeName: string): Node | null {
    if (!rootNode) {
      return null;
    }

    if (rootNode.name === nodeName) {
      return rootNode;
    }

    for (const childNode of rootNode.children) {
      const result = this.findDescendantByName(childNode, nodeName);
      if (result) {
        return result;
      }
    }

    return null;
  }
}

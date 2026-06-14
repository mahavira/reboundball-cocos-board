import { EventTouch } from 'cc';

import { BoardPlacementService } from '../board-placement/BoardPlacementService.ts';
import type {
  BoardDragItemDefinition,
  BoardPlacementSource,
  BoardPlacementPreview,
  BoardShopHost,
  ShopItemDefinition,
  UiPoint,
} from '../shared/types.ts';

const HIDDEN_PREVIEW_KEY = 'hidden';

type ActiveDragContext = {
  slotIndex: number;
  item: BoardDragItemDefinition;
  previewHandle: unknown;
  source: BoardPlacementSource | null;
};

type ShopDragControllerOptions = {
  host: BoardShopHost;
  onPlacementSuccess: (slotIndex: number) => void;
  onPurchaseBlocked?: (slotIndex: number, item: ShopItemDefinition) => void;
};

/**
 * 统一管理一次商品拖拽的完整生命周期。
 * 它只负责预览节点、高亮反馈和结束清理；棋盘放置规则全部委托给 BoardPlacementService。
 */
export class ShopDragController {
  private readonly host: BoardShopHost;
  private readonly placementService: BoardPlacementService;
  private readonly onPlacementSuccess: (slotIndex: number) => void;
  private readonly onPurchaseBlocked: ((slotIndex: number, item: ShopItemDefinition) => void) | null;
  private activeDragContext: ActiveDragContext | null = null;
  private lastPreviewFeedbackKey: string | null = null;

  constructor(options: ShopDragControllerOptions) {
    this.host = options.host;
    this.placementService = new BoardPlacementService(options.host);
    this.onPlacementSuccess = options.onPlacementSuccess;
    this.onPurchaseBlocked = options.onPurchaseBlocked ?? null;
  }

  startDrag(
    slotIndex: number,
    item: BoardDragItemDefinition,
    uiPoint: UiPoint,
    source: BoardPlacementSource | null = null,
  ): void {
    this.cancelActiveDrag();

    const previewHandle = this.host.createDragPreview(item);
    this.activeDragContext = {
      slotIndex,
      item,
      previewHandle,
      source,
    };
    this.lastPreviewFeedbackKey = null;

    this.host.updateDragPreviewPosition(previewHandle, uiPoint);
    this.updatePreviewFeedback(item, uiPoint);
  }

  cancelActiveDrag(): void {
    if (!this.activeDragContext) {
      return;
    }

    this.teardownActiveDrag();
  }

  updateActiveDrag(event: EventTouch): void {
    if (!this.activeDragContext) {
      return;
    }

    const uiPoint = event.getUILocation();
    this.host.updateDragPreviewPosition(this.activeDragContext.previewHandle, uiPoint);
    this.updatePreviewFeedback(this.activeDragContext.item, uiPoint);
  }

  finishActiveDrag(event: EventTouch): void {
    if (!this.activeDragContext) {
      return;
    }

    const uiPoint = event.getUILocation();
    if (
      this.activeDragContext.source
      && this.host.isRecycleUiPoint(uiPoint)
      && this.host.canRecyclePlacedEntity(this.activeDragContext.source)
    ) {
      this.host.clearRecycleFeedback();
      this.host.recyclePlacedEntity(this.activeDragContext.source);
      this.teardownActiveDrag();
      return;
    }

    const activeDragContext = this.activeDragContext;
    let spentGold = 0;
    if (!activeDragContext.source && this.isShopItem(activeDragContext.item)) {
      const preview = this.placementService.previewPlacement(activeDragContext.item, uiPoint);
      if (preview.coord && (preview.state === 'placeable' || preview.state === 'mergeable')) {
        const purchaseSucceeded = this.host.trySpendGold(activeDragContext.item.price);
        if (!purchaseSucceeded) {
          this.onPurchaseBlocked?.(activeDragContext.slotIndex, activeDragContext.item);
          this.teardownActiveDrag();
          return;
        }

        spentGold = activeDragContext.item.price;
      }
    }

    const placementResult = this.placementService.placeAtUiPoint(
      activeDragContext.item,
      uiPoint,
      activeDragContext.source ?? undefined,
    );
    const consumedSlotIndex = placementResult.success ? activeDragContext.slotIndex : null;
    if (!placementResult.success && spentGold > 0) {
      this.host.addGold(spentGold);
    }

    this.teardownActiveDrag();

    if (consumedSlotIndex !== null) {
      this.onPlacementSuccess(consumedSlotIndex);
    }
  }

  /** 预判与最终落子共用同一套服务，避免颜色反馈与真正结果分叉。 */
  private updatePreviewFeedback(item: BoardDragItemDefinition, uiPoint: UiPoint): void {
    if (
      this.activeDragContext?.source
      && this.host.isRecycleUiPoint(uiPoint)
      && this.host.canRecyclePlacedEntity(this.activeDragContext.source)
    ) {
      this.clearPreviewFeedback();
      this.host.showRecycleFeedback(this.host.getRecycleRefund(this.activeDragContext.source.entity));
      return;
    }

    this.host.clearRecycleFeedback();
    const preview = this.placementService.previewPlacement(
      item,
      uiPoint,
      this.activeDragContext?.source ?? undefined,
    );
    this.applyPreviewFeedback(preview);
  }

  private applyPreviewFeedback(preview: BoardPlacementPreview): void {
    const feedbackKey = this.createPreviewFeedbackKey(preview);
    if (feedbackKey === this.lastPreviewFeedbackKey) {
      return;
    }

    this.lastPreviewFeedbackKey = feedbackKey;

    if (!preview.coord || preview.state === 'outside') {
      this.host.clearPlacementHighlight();
      return;
    }

    if (preview.state === 'blocked') {
      this.host.showPlacementHighlight(preview.coord, 'blocked');
      return;
    }

    this.host.showPlacementHighlight(preview.coord, preview.state);
  }

  private clearPreviewFeedback(): void {
    if (this.lastPreviewFeedbackKey === HIDDEN_PREVIEW_KEY) {
      return;
    }

    this.host.clearPlacementHighlight();
    this.lastPreviewFeedbackKey = HIDDEN_PREVIEW_KEY;
  }

  private createPreviewFeedbackKey(preview: BoardPlacementPreview): string {
    if (!preview.coord || preview.state === 'outside') {
      return HIDDEN_PREVIEW_KEY;
    }

    return `${preview.coord.row},${preview.coord.col}:${preview.state}`;
  }

  private isShopItem(item: BoardDragItemDefinition): item is ShopItemDefinition {
    return 'itemId' in item;
  }

  private teardownActiveDrag(): void {
    if (!this.activeDragContext) {
      return;
    }

    this.host.destroyDragPreview(this.activeDragContext.previewHandle);
    this.clearPreviewFeedback();
    this.host.clearRecycleFeedback();
    this.lastPreviewFeedbackKey = null;
    this.activeDragContext = null;
  }
}

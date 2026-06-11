import { isInnerBoardCoord } from '../shared/helpers.ts';
import {
  buildMergedEntitySpec,
  buildPlacedEntitySpec,
  getMergePreview,
} from './MergeRule.ts';
import { createPlacementSpecFromEntity } from '../shop/ShopItemFactory.ts';
import { sameCoord } from '../shared/helpers.ts';
import { canSwapEntityOnBoard } from '../shared/entity-registry.ts';
import type {
  BoardDragItemDefinition,
  BoardPlacementPreview,
  BoardPlacementResult,
  BoardPlacementSource,
  BoardShopHost,
  EntitySpec,
  GridCoord,
  ShopItemDefinition,
  UiPoint,
} from '../shared/types.ts';

type PlacementResolution =
  | {
      kind: 'reject';
      previewState: Extract<BoardPlacementPreview['state'], 'outside' | 'blocked'>;
      coord: GridCoord | null;
    }
  | {
      kind: 'noop';
      previewState: 'placeable';
      coord: GridCoord;
    }
  | {
      kind: 'place';
      previewState: 'placeable';
      coord: GridCoord;
      nextSpec: EntitySpec;
      sourceCoord: GridCoord | null;
    }
  | {
      kind: 'swap';
      previewState: 'placeable';
      coord: GridCoord;
      sourceSpec: EntitySpec;
      targetSpec: EntitySpec;
    }
  | {
      kind: 'merge';
      previewState: 'mergeable';
      coord: GridCoord;
      nextSpec: EntitySpec;
      sourceCoord: GridCoord | null;
    };

/**
 * 商店到棋盘的落子服务。
 * 它统一处理坐标命中、空格放置与同类合并，供拖拽预览和最终落子共用同一条规则链路。
 */
export class BoardPlacementService {
  private readonly host: BoardShopHost;

  constructor(host: BoardShopHost) {
    this.host = host;
  }

  previewPlacement(
    item: BoardDragItemDefinition,
    uiPoint: UiPoint,
    source?: BoardPlacementSource,
  ): BoardPlacementPreview {
    const resolution = this.resolvePlacement(item, uiPoint, source);
    return {
      state: resolution.previewState,
      coord: resolution.coord,
    };
  }

  placeAtUiPoint(
    item: BoardDragItemDefinition,
    uiPoint: UiPoint,
    source?: BoardPlacementSource,
  ): BoardPlacementResult {
    const resolution = this.resolvePlacement(item, uiPoint, source);
    return this.applyPlacementResolution(resolution);
  }

  private resolveInnerBoardCoord(uiPoint: UiPoint) {
    const coord = this.host.resolveGridCoordFromUiPoint(uiPoint);
    if (!coord) {
      return null;
    }

    return isInnerBoardCoord(coord, 1, 5) ? coord : null;
  }

  /**
   * 先把拖拽命中结果收敛成单一动作，再由下游统一执行。
   * 这样 UI 层只关心“本次落子会发生什么”，而不是在一个函数里混读规则判断和副作用。
   */
  private resolvePlacement(
    item: BoardDragItemDefinition,
    uiPoint: UiPoint,
    source?: BoardPlacementSource,
  ): PlacementResolution {
    const coord = this.resolveInnerBoardCoord(uiPoint);
    if (!coord) {
      return {
        kind: 'reject',
        previewState: 'outside',
        coord: null,
      };
    }

    if (source && sameCoord(coord, source.coord)) {
      return {
        kind: 'noop',
        previewState: 'placeable',
        coord,
      };
    }

    const targetEntity = this.host.getEntityAt(coord);
    if (!targetEntity) {
      return {
        kind: 'place',
        previewState: 'placeable',
        coord,
        nextSpec: source
          ? createPlacementSpecFromEntity(source.entity, coord)
          : buildPlacedEntitySpec(this.requireShopItem(item), coord),
        sourceCoord: source?.coord ?? null,
      };
    }

    const mergePreview = getMergePreview(item, targetEntity);
    if (mergePreview === 'mergeable') {
      return {
        kind: 'merge',
        previewState: 'mergeable',
        coord,
        nextSpec: buildMergedEntitySpec(item, targetEntity),
        sourceCoord: source?.coord ?? null,
      };
    }

    if (source && canSwapEntityOnBoard(targetEntity)) {
      return {
        kind: 'swap',
        previewState: 'placeable',
        coord,
        sourceSpec: createPlacementSpecFromEntity(source.entity, coord),
        targetSpec: createPlacementSpecFromEntity(targetEntity, source.coord),
      };
    }

    return {
      kind: 'reject',
      previewState: 'blocked',
      coord,
    };
  }

  private applyPlacementResolution(resolution: PlacementResolution): BoardPlacementResult {
    if (resolution.kind === 'reject') {
      return {
        success: false,
        coord: resolution.coord,
        state: resolution.previewState,
      };
    }

    if (resolution.kind === 'noop') {
      return {
        success: true,
        coord: resolution.coord,
        state: resolution.previewState,
      };
    }

    if (resolution.kind === 'swap') {
      /**
       * 棋盘内拖拽命中另一枚可拖拽实体且又不满足合并时，按交换处理。
       * 这样不需要在 UI 层区分“移动”和“互换”，最终规则仍统一收口在放置服务里。
       */
      this.host.placeEntity(resolution.sourceSpec, 'placed');
      this.host.placeEntity(resolution.targetSpec, 'placed');
      return {
        success: true,
        coord: resolution.coord,
        state: resolution.previewState,
      };
    }

    this.host.placeEntity(
      resolution.nextSpec,
      resolution.kind === 'merge' ? 'upgraded' : 'placed',
    );
    if (resolution.sourceCoord) {
      this.host.removeEntity(resolution.sourceCoord);
    }
    return {
      success: true,
      coord: resolution.coord,
      state: resolution.previewState,
    };
  }

  private requireShopItem(item: BoardDragItemDefinition): ShopItemDefinition {
    if ('itemId' in item) {
      return item;
    }

    throw new Error('BoardPlacementService requires a shop item when placing without a board source');
  }
}

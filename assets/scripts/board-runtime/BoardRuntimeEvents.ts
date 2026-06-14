import { cloneCoord } from '../shared/helpers.ts';
import type { BoardEntityChangeEvent, GridCoord } from '../shared/types.ts';

export type EntityChangeKind = BoardEntityChangeEvent['kind'];

/** 统一管理实体变更事件，避免事件结构散落在规则代码中。 */
export class BoardRuntimeEvents {
  private readonly entityChangeListeners = new Set<(event: BoardEntityChangeEvent) => void>();

  addEntityChangeListener(listener: (event: BoardEntityChangeEvent) => void): () => void {
    this.entityChangeListeners.add(listener);
    return () => {
      this.entityChangeListeners.delete(listener);
    };
  }

  emitReset(): void {
    this.emitEntityChange({
      kind: 'reset',
      changedCoords: [],
      requiresPredictionRefresh: true,
    });
  }

  emitCoordChange(
    kind: EntityChangeKind,
    coord: GridCoord,
    requiresPredictionRefresh: boolean,
  ): void {
    this.emitEntityChange({
      kind,
      changedCoords: [cloneCoord(coord)],
      requiresPredictionRefresh,
    });
  }

  emitWeaponTailCharge(weaponCoord: GridCoord, tailCoord: GridCoord): void {
    this.emitEntityChange({
      kind: 'state-changed',
      changedCoords: [cloneCoord(weaponCoord)],
      requiresPredictionRefresh: false,
      tailFeedbacks: [
        {
          weaponCoord: cloneCoord(weaponCoord),
          tailCoord: cloneCoord(tailCoord),
        },
      ],
    });
  }

  emitEntityChange(event: BoardEntityChangeEvent): void {
    this.entityChangeListeners.forEach((listener) => listener(event));
  }
}

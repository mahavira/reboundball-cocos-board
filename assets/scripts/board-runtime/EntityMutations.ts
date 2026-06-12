import { rotateFacingClockwise, rotateVariantClockwise } from './board-runtime-rules.ts';
import type { EntitySpec, EntityState, GridCoord } from '../shared/types.ts';
import type { EntityChangeKind } from './BoardRuntimeEvents.ts';
import { BoardRuntimeEvents } from './BoardRuntimeEvents.ts';
import { EntityStore } from './EntityStore.ts';

/** 玩家或系统主动改变实体的操作：放置、移除、旋转、升级。 */
export class EntityMutations {
  private readonly entities: EntityStore;
  private readonly events: BoardRuntimeEvents;

  constructor(entities: EntityStore, events: BoardRuntimeEvents) {
    this.entities = entities;
    this.events = events;
  }

  placeEntity(spec: EntitySpec, changeKind: EntityChangeKind = 'placed'): void {
    this.entities.setFromSpec(spec);
    this.events.emitCoordChange(changeKind, spec.coord, true);
  }

  removeEntity(coord: GridCoord): void {
    this.entities.delete(coord);
    this.events.emitCoordChange('removed', coord, true);
  }

  rotateEntity(coord: GridCoord): EntityState | null {
    const entity = this.entities.getMutable(coord);
    if (!entity) {
      return null;
    }

    if (this.rotateEntityInPlace(entity)) {
      this.entities.markChanged();
      this.events.emitCoordChange('rotated', coord, true);
    }

    return structuredClone(entity);
  }

  upgradeEntity(coord: GridCoord): EntityState | null {
    const entity = this.entities.getMutable(coord);
    if (!entity) {
      return null;
    }

    if ('level' in entity) {
      entity.level = entity.level >= 5 ? 1 : entity.level + 1;
      this.entities.markChanged();
      this.events.emitCoordChange('upgraded', coord, true);
    }

    return structuredClone(entity);
  }

  private rotateEntityInPlace(entity: EntityState): boolean {
    if ('variant' in entity) {
      entity.variant = rotateVariantClockwise(entity.variant);
      return true;
    }

    if (entity.kind !== 'weapon') {
      return false;
    }

    entity.facing = rotateFacingClockwise(entity.facing);
    entity.tailDirections = [entity.facing];
    return true;
  }
}

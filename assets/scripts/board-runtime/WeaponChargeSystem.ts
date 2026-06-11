import { cloneCoord, sameCoord } from '../shared/helpers.ts';
import { getWeaponChargeLimit, getWeaponTailCells } from './board-runtime-rules.ts';
import type { EntityState, GridCoord, WeaponEvent } from '../shared/types.ts';
import { BoardRuntimeEvents } from './BoardRuntimeEvents.ts';
import { EntityStore } from './EntityStore.ts';
import { canUseWeaponTailCharge } from '../shared/entity-registry.ts';

/** 负责武器尾巴触发、充能和开火事件生成。 */
export class WeaponChargeSystem {
  private readonly entities: EntityStore;
  private readonly events: BoardRuntimeEvents;

  constructor(entities: EntityStore, events: BoardRuntimeEvents) {
    this.entities = entities;
    this.events = events;
  }

  handleTailCharge(centerCell: GridCoord): WeaponEvent[] {
    const weaponEvents: WeaponEvent[] = [];

    // 仅遍历具备尾部充能能力的武器实体，避免遍历全部实体
    for (const entity of this.entities.filterMutable((e) => canUseWeaponTailCharge(e))) {
      if (!this.isWeaponTailTriggered(entity, centerCell)) {
        continue;
      }

      entity.charge += 1;
      this.events.emitCoordChange('state-changed', entity.coord, false);

      if (entity.charge >= getWeaponChargeLimit(entity)) {
        entity.charge = 0;
        weaponEvents.push(this.createWeaponFiredEvent(entity));
      }
    }

    return weaponEvents;
  }

  private isWeaponTailTriggered(
    entity: EntityState,
    centerCell: GridCoord,
  ): entity is EntityState & { kind: 'weapon' } {
    return getWeaponTailCells(entity).some((coord) => sameCoord(coord, centerCell));
  }

  private createWeaponFiredEvent(entity: EntityState & { kind: 'weapon' }): WeaponEvent {
    return {
      type: 'weapon-fired',
      weaponId: entity.id,
      weaponType: entity.weaponType,
      coord: cloneCoord(entity.coord),
    };
  }
}

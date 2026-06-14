import { cloneCoord, coordKey } from '../shared/helpers.ts';
import { getWeaponChargeLimit, getWeaponTailCells } from './board-runtime-rules.ts';
import type { EntityState, GridCoord, WeaponEvent } from '../shared/types.ts';
import { BoardRuntimeEvents } from './BoardRuntimeEvents.ts';
import { EntityStore } from './EntityStore.ts';
import { canUseWeaponTailCharge } from '../shared/entity-registry.ts';
import { SupportAuraSystem } from './SupportAuraSystem.ts';
import type { WeaponModifiers } from '../shared/types.ts';

type WeaponEntity = Extract<EntityState, { kind: 'weapon' }>;

/** 负责武器尾巴触发、充能和开火事件生成。 */
export class WeaponChargeSystem {
  private readonly entities: EntityStore;
  private readonly events: BoardRuntimeEvents;
  private readonly supportAuraSystem: SupportAuraSystem;
  private readonly tailIndex = new Map<string, WeaponEntity[]>();
  private indexedEntityVersion = -1;

  constructor(
    entities: EntityStore,
    events: BoardRuntimeEvents,
    supportAuraSystem: SupportAuraSystem = new SupportAuraSystem(entities),
  ) {
    this.entities = entities;
    this.events = events;
    this.supportAuraSystem = supportAuraSystem;
  }

  handleTailCharge(centerCell: GridCoord): WeaponEvent[] {
    const weaponEvents: WeaponEvent[] = [];
    const triggeredWeapons = this.getWeaponsAtTailCell(centerCell);

    for (const entity of triggeredWeapons) {
      const modifiers = this.supportAuraSystem.getWeaponModifiers(entity);
      entity.charge += modifiers.chargeGainMultiplier;
      this.events.emitWeaponTailCharge(entity.coord, centerCell);

      if (entity.charge >= getWeaponChargeLimit(entity)) {
        entity.charge -= getWeaponChargeLimit(entity);
        weaponEvents.push(this.createWeaponFiredEvent(entity, modifiers));
      }
    }

    return weaponEvents;
  }

  private getWeaponsAtTailCell(centerCell: GridCoord): WeaponEntity[] {
    this.ensureTailIndexFresh();
    return this.tailIndex.get(coordKey(centerCell)) ?? [];
  }

  private ensureTailIndexFresh(): void {
    const currentVersion = this.entities.getVersion();
    if (this.indexedEntityVersion === currentVersion) {
      return;
    }

    this.rebuildTailIndex();
    this.indexedEntityVersion = currentVersion;
  }

  private rebuildTailIndex(): void {
    this.tailIndex.clear();

    for (const entity of this.entities.getAllMutable()) {
      if (!canUseWeaponTailCharge(entity)) {
        continue;
      }

      for (const tailCell of getWeaponTailCells(entity)) {
        const key = coordKey(tailCell);
        const weapons = this.tailIndex.get(key) ?? [];
        weapons.push(entity);
        this.tailIndex.set(key, weapons);
      }
    }
  }

  private createWeaponFiredEvent(entity: WeaponEntity, modifiers: WeaponModifiers): WeaponEvent {
    return {
      type: 'weapon-fired',
      weaponId: entity.id,
      weaponType: entity.weaponType,
      coord: cloneCoord(entity.coord),
      modifiers,
    };
  }
}

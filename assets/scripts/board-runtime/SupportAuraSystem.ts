import { getSupportLevelIndex, SUPPORT_EFFECTS_BY_TYPE } from '../shared/entity-definitions.ts';
import { moveCoord } from '../shared/helpers.ts';
import type { Direction, EntityState, WeaponModifiers } from '../shared/types.ts';
import { EntityStore } from './EntityStore.ts';

type WeaponEntity = Extract<EntityState, { kind: 'weapon' }>;
type SupportEntity = Extract<EntityState, { kind: 'support' }>;

const SUPPORT_AURA_DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left'];

const DEFAULT_WEAPON_MODIFIERS: WeaponModifiers = {
  damageMultiplier: 1,
  critChanceBonus: 0,
  chargeGainMultiplier: 1,
  onKillGoldBonus: 0,
};

/** 汇总武器四向相邻辅助实体的光环效果，不修改任何运行时状态。 */
export class SupportAuraSystem {
  private readonly entities: EntityStore;

  constructor(entities: EntityStore) {
    this.entities = entities;
  }

  getWeaponModifiers(weapon: WeaponEntity): WeaponModifiers {
    const modifiers = { ...DEFAULT_WEAPON_MODIFIERS };

    for (const direction of SUPPORT_AURA_DIRECTIONS) {
      const neighborCoord = moveCoord(weapon.coord, direction);
      const entity = this.entities.getMutable(neighborCoord);
      if (entity?.kind !== 'support') {
        continue;
      }

      this.applySupportEffect(modifiers, entity);
    }

    return modifiers;
  }

  private applySupportEffect(modifiers: WeaponModifiers, support: SupportEntity): void {
    const levelIndex = getSupportLevelIndex(support.level);

    switch (support.supportType) {
      case 'damage-booster':
        modifiers.damageMultiplier += SUPPORT_EFFECTS_BY_TYPE['damage-booster']
          .damageMultiplierBonusByLevel[levelIndex];
        return;
      case 'gold-booster':
        modifiers.onKillGoldBonus += SUPPORT_EFFECTS_BY_TYPE['gold-booster']
          .onKillGoldBonusByLevel[levelIndex];
        return;
      case 'crit-booster':
        modifiers.critChanceBonus += SUPPORT_EFFECTS_BY_TYPE['crit-booster']
          .critChanceBonusByLevel[levelIndex];
        return;
      case 'charge-booster':
        modifiers.chargeGainMultiplier += SUPPORT_EFFECTS_BY_TYPE['charge-booster']
          .chargeGainMultiplierBonusByLevel[levelIndex];
        return;
    }
  }
}

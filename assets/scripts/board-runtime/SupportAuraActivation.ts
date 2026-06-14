import { coordKey, moveCoord } from '../shared/helpers.ts';
import type { Direction, EntityState, GridCoord } from '../shared/types.ts';

export type ActiveSupportAuraState = {
  activeWeaponCoordKeys: ReadonlySet<string>;
  activeSupportCoordKeys: ReadonlySet<string>;
  activeWeaponDirectionByCoordKey: ReadonlyMap<string, Direction>;
  activeSupportDirectionByCoordKey: ReadonlyMap<string, Direction>;
  activeLightDirectionsByCoordKey: ReadonlyMap<string, readonly Direction[]>;
};

const SUPPORT_AURA_DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left'];
const OPPOSITE_AURA_DIRECTION: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

/** 派生当前 support 与 weapon 的相邻链接状态，不把表现状态写回 EntityState。 */
export function collectActiveSupportAuraState(
  entities: Iterable<EntityState>,
): ActiveSupportAuraState {
  const entityByCoordKey = new Map<string, EntityState>();
  const weapons: Array<Extract<EntityState, { kind: 'weapon' }>> = [];
  const activeWeaponCoordKeys = new Set<string>();
  const activeSupportCoordKeys = new Set<string>();
  const activeWeaponDirectionByCoordKey = new Map<string, Direction>();
  const activeSupportDirectionByCoordKey = new Map<string, Direction>();
  const activeLightDirectionsByCoordKey = new Map<string, Direction[]>();

  for (const entity of entities) {
    entityByCoordKey.set(coordKey(entity.coord), entity);
    if (entity.kind === 'weapon') {
      weapons.push(entity);
    }
  }

  for (const weapon of weapons) {
    collectActiveAdjacentSupports(
      weapon.coord,
      entityByCoordKey,
      activeWeaponCoordKeys,
      activeSupportCoordKeys,
      activeWeaponDirectionByCoordKey,
      activeSupportDirectionByCoordKey,
      activeLightDirectionsByCoordKey,
    );
  }

  return {
    activeWeaponCoordKeys,
    activeSupportCoordKeys,
    activeWeaponDirectionByCoordKey,
    activeSupportDirectionByCoordKey,
    activeLightDirectionsByCoordKey,
  };
}

function collectActiveAdjacentSupports(
  weaponCoord: GridCoord,
  entityByCoordKey: ReadonlyMap<string, EntityState>,
  activeWeaponCoordKeys: Set<string>,
  activeSupportCoordKeys: Set<string>,
  activeWeaponDirectionByCoordKey: Map<string, Direction>,
  activeSupportDirectionByCoordKey: Map<string, Direction>,
  activeLightDirectionsByCoordKey: Map<string, Direction[]>,
): void {
  const weaponCoordKey = coordKey(weaponCoord);

  for (const direction of SUPPORT_AURA_DIRECTIONS) {
    const neighborCoord = moveCoord(weaponCoord, direction);
    const neighbor = entityByCoordKey.get(coordKey(neighborCoord));
    if (neighbor?.kind !== 'support') {
      continue;
    }

    activeWeaponCoordKeys.add(weaponCoordKey);
    if (!activeWeaponDirectionByCoordKey.has(weaponCoordKey)) {
      activeWeaponDirectionByCoordKey.set(weaponCoordKey, direction);
    }
    collectAuraLightDirection(activeLightDirectionsByCoordKey, weaponCoordKey, direction);

    const supportCoordKey = coordKey(neighbor.coord);
    activeSupportCoordKeys.add(supportCoordKey);
    if (!activeSupportDirectionByCoordKey.has(supportCoordKey)) {
      activeSupportDirectionByCoordKey.set(supportCoordKey, OPPOSITE_AURA_DIRECTION[direction]);
    }
  }
}

function collectAuraLightDirection(
  activeLightDirectionsByCoordKey: Map<string, Direction[]>,
  coordKey: string,
  direction: Direction,
): void {
  const directions = activeLightDirectionsByCoordKey.get(coordKey);
  if (!directions) {
    activeLightDirectionsByCoordKey.set(coordKey, [direction]);
    return;
  }
  if (!directions.includes(direction)) {
    directions.push(direction);
  }
}

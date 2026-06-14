import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canDragEntityFromBoard,
  canMergePlacementItemWithEntity,
  canRecycleEntityFromBoard,
  canSwapEntityOnBoard,
  canUseWeaponTailCharge,
  getEntityDefinition,
  RANDOM_SHOP_ENTITY_KINDS,
} from '../assets/scripts/shared/entity-registry.ts';
import type { EntityState, ShopItemDefinition } from '../assets/scripts/shared/types.ts';

test('entity registry keeps current placement, shop, and charge ownership explicit', () => {
  assert.deepEqual(RANDOM_SHOP_ENTITY_KINDS, ['turner', 'weapon', 'support']);
  assert.equal(getEntityDefinition('turner').canDragFromBoard, true);
  assert.equal(getEntityDefinition('weapon').canChargeFromTail, true);
  assert.equal(getEntityDefinition('support').canChargeFromTail, false);
  assert.equal(getEntityDefinition('support').canAppearInRandomShop, true);
  assert.equal(getEntityDefinition('support').canRecycleFromBoard, true);
  assert.equal(getEntityDefinition('stone').canMergeFromPlacement, false);
  assert.equal(getEntityDefinition('rotator').canRecycleFromBoard, false);
});

test('entity registry helpers expose current draggable and mergeable entities', () => {
  const turner: EntityState = {
    kind: 'turner',
    coord: { row: 1, col: 1 },
    variant: 'left-up',
    level: 1,
  };
  const stone: EntityState = {
    kind: 'stone',
    coord: { row: 2, col: 2 },
  };
  const item: ShopItemDefinition = {
    itemId: 'shop-turner',
    kind: 'turner',
    variant: 'left-up',
    level: 1,
  };

  assert.equal(canDragEntityFromBoard(turner), true);
  assert.equal(canSwapEntityOnBoard(turner), true);
  assert.equal(canDragEntityFromBoard(stone), false);
  assert.equal(canMergePlacementItemWithEntity(item, turner), true);
  assert.equal(canMergePlacementItemWithEntity(item, stone), false);
});

test('registry allows rotator and center-effect entities to move and swap but not recycle', () => {
  const entities: EntityState[] = [
    {
      kind: 'rotator',
      coord: { row: 1, col: 1 },
      variant: 'left-up',
      level: 1,
    },
    {
      kind: 'chaos-gate',
      coord: { row: 2, col: 2 },
    },
    {
      kind: 'black-hole',
      coord: { row: 3, col: 3 },
    },
  ];

  entities.forEach((entity) => {
    assert.equal(canDragEntityFromBoard(entity), true);
    assert.equal(canSwapEntityOnBoard(entity), true);
    assert.equal(canRecycleEntityFromBoard(entity), false);
  });
});

test('entity registry helper exposes weapon charge capability', () => {
  const weapon: EntityState = {
    kind: 'weapon',
    id: 'weapon-1',
    coord: { row: 3, col: 3 },
    weaponType: 'pistol',
    level: 1,
    facing: 'up',
    tailDirections: ['up'],
    charge: 0,
  };

  assert.equal(canUseWeaponTailCharge(weapon), true);
});

test('entity registry helper keeps support out of weapon tail charge', () => {
  const support: EntityState = {
    kind: 'support',
    coord: { row: 3, col: 3 },
    supportType: 'charge-booster',
    level: 1,
  };

  assert.equal(canDragEntityFromBoard(support), true);
  assert.equal(canSwapEntityOnBoard(support), true);
  assert.equal(canRecycleEntityFromBoard(support), true);
  assert.equal(canUseWeaponTailCharge(support), false);
});

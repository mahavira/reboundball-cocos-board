import test from 'node:test';
import assert from 'node:assert/strict';

import { collectActiveSupportAuraState } from '../assets/scripts/board-runtime/SupportAuraActivation.ts';
import type { EntityState } from '../assets/scripts/shared/types.ts';

test('support aura activation marks adjacent weapons and supports only once', () => {
  const entities: EntityState[] = [
    {
      kind: 'weapon',
      id: 'weapon-1',
      coord: { row: 3, col: 3 },
      weaponType: 'pistol',
      level: 1,
      facing: 'left',
      tailDirections: ['left'],
      charge: 0,
    },
    {
      kind: 'support',
      coord: { row: 3, col: 2 },
      supportType: 'damage-booster',
      level: 1,
    },
    {
      kind: 'support',
      coord: { row: 2, col: 3 },
      supportType: 'charge-booster',
      level: 1,
    },
  ];

  const auraState = collectActiveSupportAuraState(entities);

  assert.deepEqual(Array.from(auraState.activeWeaponCoordKeys), ['3,3']);
  assert.deepEqual(new Set(auraState.activeSupportCoordKeys), new Set(['3,2', '2,3']));
  assert.equal(auraState.activeWeaponDirectionByCoordKey.get('3,3'), 'up');
  assert.equal(auraState.activeSupportDirectionByCoordKey.get('2,3'), 'down');
  assert.equal(auraState.activeSupportDirectionByCoordKey.get('3,2'), 'right');
  assert.deepEqual(auraState.activeLightDirectionsByCoordKey.get('3,3'), ['up', 'left']);
  assert.equal(auraState.activeLightDirectionsByCoordKey.get('2,3'), undefined);
  assert.equal(auraState.activeLightDirectionsByCoordKey.get('3,2'), undefined);
});

test('support aura activation ignores diagonal and non linked entities', () => {
  const entities: EntityState[] = [
    {
      kind: 'weapon',
      id: 'weapon-1',
      coord: { row: 3, col: 3 },
      weaponType: 'pistol',
      level: 1,
      facing: 'left',
      tailDirections: ['left'],
      charge: 0,
    },
    {
      kind: 'support',
      coord: { row: 2, col: 2 },
      supportType: 'damage-booster',
      level: 1,
    },
    {
      kind: 'support',
      coord: { row: 5, col: 5 },
      supportType: 'gold-booster',
      level: 1,
    },
  ];

  const auraState = collectActiveSupportAuraState(entities);

  assert.equal(auraState.activeWeaponCoordKeys.size, 0);
  assert.equal(auraState.activeSupportCoordKeys.size, 0);
  assert.equal(auraState.activeWeaponDirectionByCoordKey.size, 0);
  assert.equal(auraState.activeSupportDirectionByCoordKey.size, 0);
  assert.equal(auraState.activeLightDirectionsByCoordKey.size, 0);
});

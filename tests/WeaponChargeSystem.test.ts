import test from 'node:test';
import assert from 'node:assert/strict';

import { EntityStore } from '../assets/scripts/board-runtime/EntityStore.ts';
import { BoardRuntimeEvents } from '../assets/scripts/board-runtime/BoardRuntimeEvents.ts';
import { WeaponChargeSystem } from '../assets/scripts/board-runtime/WeaponChargeSystem.ts';

test('weapon tail index refreshes after weapon rotation changes tail cell', () => {
  const entities = new EntityStore();
  const events = new BoardRuntimeEvents();
  const weaponChargeSystem = new WeaponChargeSystem(entities, events);

  entities.loadEntities([
    {
      kind: 'weapon',
      coord: { row: 3, col: 2 },
      weaponType: 'pistol',
      facing: 'left',
    },
  ]);

  weaponChargeSystem.handleTailCharge({ row: 3, col: 1 });
  let weapon = entities.getMutable({ row: 3, col: 2 });
  assert.equal(weapon?.kind === 'weapon' ? weapon.charge : null, 1);

  if (weapon?.kind !== 'weapon') {
    assert.fail('Expected weapon entity');
  }

  weapon.facing = 'up';
  weapon.tailDirections = ['up'];
  entities.markChanged();

  weaponChargeSystem.handleTailCharge({ row: 3, col: 1 });
  assert.equal(weapon.charge, 1);

  weaponChargeSystem.handleTailCharge({ row: 2, col: 2 });
  assert.equal(weapon.charge, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRandomShopItems,
  createShopPlacementSpec,
} from '../assets/scripts/shop/ShopItemFactory.ts';

test('refresh creates a fixed first turner and then random weapon or turner items', () => {
  const values = [0.2, 0.4, 0.7, 0.9, 0.6, 0.1];
  let index = 0;
  const items = createRandomShopItems(3, () => values[index++]);

  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((item) => item.kind),
    ['turner', 'weapon', 'turner'],
  );
});

test('turner items are always level 1 and weapon items convert facing into tailDirections', () => {
  const turner = createRandomShopItems(1, () => 0.1)[0];
  const weaponValues = [0.1, 0.4, 0.25, 0.6];
  let weaponValueIndex = 0;
  const weapon = createRandomShopItems(2, () => weaponValues[weaponValueIndex++])[1];

  assert.equal(turner.kind, 'turner');
  assert.equal(turner.level, 1);
  assert.equal(turner.price, 5);

  assert.equal(weapon.kind, 'weapon');
  assert.equal(weapon.level, 1);
  assert.equal(weapon.price, 16);
  assert.deepEqual(createShopPlacementSpec(weapon, { row: 1, col: 2 }), {
    kind: 'weapon',
    coord: { row: 1, col: 2 },
    weaponType: weapon.weaponType,
    facing: weapon.facing,
    tailDirections: [weapon.facing],
    level: 1,
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMergedEntitySpec,
  getMergePreview,
} from '../assets/scripts/board-placement/MergeRule.ts';
import type {
  EntityState,
  SupportShopItemDefinition,
  TurnerShopItemDefinition,
  WeaponShopItemDefinition,
} from '../assets/scripts/shared/types.ts';

test('turner with same variant and level can merge to next level', () => {
  const item: TurnerShopItemDefinition = {
    itemId: 'turner-1',
    kind: 'turner',
    variant: 'left-up',
    level: 1,
  };
  const target: EntityState = {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 1,
  };

  assert.equal(getMergePreview(item, target), 'mergeable');
  assert.deepEqual(buildMergedEntitySpec(item, target), {
    kind: 'turner',
    coord: { row: 2, col: 2 },
    variant: 'left-up',
    level: 2,
  });
});

test('turner with different variant or level cannot merge', () => {
  const item: TurnerShopItemDefinition = {
    itemId: 'turner-1',
    kind: 'turner',
    variant: 'left-up',
    level: 1,
  };

  assert.equal(
    getMergePreview(item, {
      kind: 'turner',
      coord: { row: 2, col: 2 },
      variant: 'right-up',
      level: 1,
    }),
    'blocked',
  );

  assert.equal(
    getMergePreview(item, {
      kind: 'turner',
      coord: { row: 2, col: 2 },
      variant: 'left-up',
      level: 2,
    }),
    'blocked',
  );
});

test('weapon with same type and level can merge while preserving facing and combining unique tails', () => {
  const item: WeaponShopItemDefinition = {
    itemId: 'weapon-1',
    kind: 'weapon',
    weaponType: 'bomb',
    facing: 'left',
    tailDirections: ['left'],
    level: 1,
  };
  const target: EntityState = {
    kind: 'weapon',
    id: 'weapon-runtime',
    coord: { row: 4, col: 4 },
    weaponType: 'bomb',
    level: 1,
    facing: 'up',
    tailDirections: ['up'],
    charge: 2,
  };

  assert.equal(getMergePreview(item, target), 'mergeable');
  assert.deepEqual(buildMergedEntitySpec(item, target), {
    kind: 'weapon',
    coord: { row: 4, col: 4 },
    weaponType: 'bomb',
    level: 2,
    facing: 'up',
    tailDirections: ['up', 'left'],
    charge: 2,
  });
});

test('weapon merge deduplicates repeated tail directions', () => {
  const item: WeaponShopItemDefinition = {
    itemId: 'weapon-1',
    kind: 'weapon',
    weaponType: 'bomb',
    facing: 'up',
    tailDirections: ['up'],
    level: 1,
  };
  const target: EntityState = {
    kind: 'weapon',
    id: 'weapon-runtime',
    coord: { row: 4, col: 4 },
    weaponType: 'bomb',
    level: 1,
    facing: 'up',
    tailDirections: ['up'],
    charge: 0,
  };

  assert.deepEqual(buildMergedEntitySpec(item, target), {
    kind: 'weapon',
    coord: { row: 4, col: 4 },
    weaponType: 'bomb',
    level: 2,
    facing: 'up',
    tailDirections: ['up'],
    charge: 0,
  });
});

test('weapon with different type or level cannot merge', () => {
  const item: WeaponShopItemDefinition = {
    itemId: 'weapon-1',
    kind: 'weapon',
    weaponType: 'bomb',
    facing: 'left',
    level: 1,
  };

  assert.equal(
    getMergePreview(item, {
      kind: 'weapon',
      id: 'weapon-runtime',
      coord: { row: 4, col: 4 },
      weaponType: 'laser',
      level: 1,
      facing: 'up',
      tailDirections: ['up'],
      charge: 0,
    }),
    'blocked',
  );

  assert.equal(
    getMergePreview(item, {
      kind: 'weapon',
      id: 'weapon-runtime',
      coord: { row: 4, col: 4 },
      weaponType: 'bomb',
      level: 2,
      facing: 'up',
      tailDirections: ['up'],
      charge: 0,
    }),
    'blocked',
  );
});

test('support with same type and level can merge up to level cap', () => {
  const item: SupportShopItemDefinition = {
    itemId: 'support-1',
    kind: 'support',
    supportType: 'charge-booster',
    level: 4,
    price: 15,
  };
  const target: EntityState = {
    kind: 'support',
    coord: { row: 2, col: 2 },
    supportType: 'charge-booster',
    level: 4,
  };

  assert.equal(getMergePreview(item, target), 'mergeable');
  assert.deepEqual(buildMergedEntitySpec(item, target), {
    kind: 'support',
    coord: { row: 2, col: 2 },
    supportType: 'charge-booster',
    level: 5,
  });

  assert.deepEqual(buildMergedEntitySpec({ ...item, level: 5 }, { ...target, level: 5 }), {
    kind: 'support',
    coord: { row: 2, col: 2 },
    supportType: 'charge-booster',
    level: 5,
  });
});

test('support with different type or level cannot merge', () => {
  const item: SupportShopItemDefinition = {
    itemId: 'support-1',
    kind: 'support',
    supportType: 'damage-booster',
    level: 1,
    price: 15,
  };

  assert.equal(
    getMergePreview(item, {
      kind: 'support',
      coord: { row: 2, col: 2 },
      supportType: 'gold-booster',
      level: 1,
    }),
    'blocked',
  );

  assert.equal(
    getMergePreview(item, {
      kind: 'support',
      coord: { row: 2, col: 2 },
      supportType: 'damage-booster',
      level: 2,
    }),
    'blocked',
  );
});

test('non matching entity kinds cannot merge', () => {
  const item: WeaponShopItemDefinition = {
    itemId: 'weapon-1',
    kind: 'weapon',
    weaponType: 'bomb',
    facing: 'left',
    level: 1,
  };

  assert.equal(
    getMergePreview(item, {
      kind: 'stone',
      coord: { row: 4, col: 4 },
    }),
    'blocked',
  );
});

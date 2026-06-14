import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEntityRecycleGoldRefund,
  getShopItemGoldPrice,
} from '../assets/scripts/shop/shop-gold-rules.ts';
import type {
  EntityState,
  SupportShopItemDefinition,
} from '../assets/scripts/shared/types.ts';

test('support shop price and recycle refund use support type pricing', () => {
  const item: SupportShopItemDefinition = {
    itemId: 'support-1',
    kind: 'support',
    supportType: 'charge-booster',
    level: 1,
    price: 15,
  };
  const entity: EntityState = {
    kind: 'support',
    coord: { row: 2, col: 2 },
    supportType: 'charge-booster',
    level: 3,
  };

  assert.equal(getShopItemGoldPrice(item), 15);
  assert.equal(getEntityRecycleGoldRefund(entity), 22);
});

import type {
  EntityState,
  ShopItemDefinition,
  WeaponType,
} from '../shared/types.ts';

export const INITIAL_GOLD_BALANCE = 200;
export const SHOP_REFRESH_GOLD_COST = 5;
export const TURNER_GOLD_PRICE = 5;

export const WEAPON_GOLD_PRICES: Readonly<Record<WeaponType, number>> = {
  pistol: 10,
  bomb: 16,
  lightning: 18,
  laser: 14,
};

/** 商品价格只描述静态售卖定义，不参与运行时实体状态。 */
export function getShopItemGoldPrice(item: ShopItemDefinition): number {
  if (item.kind === 'turner') {
    return TURNER_GOLD_PRICE;
  }

  return WEAPON_GOLD_PRICES[item.weaponType];
}

/** 回收价格来自基础售价和当前等级，保持与商店刷新/购买同一套经济规则。 */
export function getEntityRecycleGoldRefund(entity: EntityState): number {
  if (entity.kind === 'turner') {
    return Math.floor(TURNER_GOLD_PRICE * entity.level / 2);
  }

  if (entity.kind === 'weapon') {
    return Math.floor(WEAPON_GOLD_PRICES[entity.weaponType] * entity.level / 2);
  }

  return 0;
}

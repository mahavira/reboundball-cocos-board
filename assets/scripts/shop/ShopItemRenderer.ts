import { Node } from 'cc';

import { SHOP_ICON_SCALE } from '../entity-visual/entity-visual-constants.ts';
import { mountEntityVisual } from '../entity-visual/EntityVisual.ts';
import { createShopPlacementSpec } from './ShopItemFactory.ts';
import type { ShopItemDefinition } from '../shared/types.ts';

/** 商店槽位图标渲染只属于 shop presentation，实体内部视觉复用 EntityVisual。 */
export class ShopItemRenderer {
  static renderShopItemIcon(targetNode: Node, item: ShopItemDefinition | null): void {
    targetNode.destroyAllChildren();
    if (!item) {
      return;
    }

    const iconNode = new Node('ShopItemIcon');
    iconNode.setParent(targetNode);
    iconNode.setScale(SHOP_ICON_SCALE, SHOP_ICON_SCALE, 1);
    mountEntityVisual(iconNode, createShopPlacementSpec(item, { row: 0, col: 0 }));
  }
}

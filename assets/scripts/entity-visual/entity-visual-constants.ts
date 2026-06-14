import { Color } from 'cc';

/** Entity visual 尺寸只服务表现层，不进入 runtime 规则配置。 */
export const ENTITY_BODY_SIZE = 84;
export const ENTITY_HALF_BODY = ENTITY_BODY_SIZE / 2;
export const ENTITY_CORNER_RADIUS = 10;
export const ENTITY_LARGE_CORNER_RADIUS = 12;

export const WEAPON_BODY_SIZE = ENTITY_BODY_SIZE;
export const WEAPON_HALF_BODY = ENTITY_BODY_SIZE / 2;
export const WEAPON_TAIL_RADIUS = 12;
export const WEAPON_TAIL_IMAGE_WIDTH = 27;
export const WEAPON_TAIL_IMAGE_HEIGHT = 62;
/** weapon-tail.png 内齿轮中心相对整图中心的 Y 偏移，缩放到当前显示尺寸后使用。 */
export const WEAPON_TAIL_GEAR_CENTER_OFFSET_Y = 17;
export const WEAPON_TAIL_GEAR_IMAGE_SIZE = 31;
export const WEAPON_TAIL_GEAR_RAW_SIZE = 114;
/** 武器尾巴图片资源路径，指向 resources/images/entity/weapon-tail.png 的 SpriteFrame。 */
export const WEAPON_TAIL_SPRITE_FRAME_PATH = 'images/entity/weapon-tail/spriteFrame';

export const SHOP_ICON_SCALE = 1;

export const LEVEL_COLORS: readonly Color[] = [
  new Color(255, 255, 255, 255),
  new Color(74, 222, 128, 255),
  new Color(96, 165, 250, 255),
  new Color(251, 146, 60, 255),
  new Color(239, 68, 68, 255),
];

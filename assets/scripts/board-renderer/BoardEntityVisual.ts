import {
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Node,
  Vec3,
  VerticalTextAlignment,
} from 'cc';

import {
  ENTITY_BODY_SIZE,
  ENTITY_CORNER_RADIUS,
  ENTITY_HALF_BODY,
  ENTITY_LARGE_CORNER_RADIUS,
  LEVEL_COLORS,
  WEAPON_BODY_SIZE,
  WEAPON_HALF_BODY,
  WEAPON_TAIL_RADIUS,
  WEAPON_TAIL_SIZE,
} from './board-renderer-constants.ts';
import { directionToOffset, setNodeSize } from './board-renderer-node-utils.ts';
import { formatWeaponName, getTurnerGlyphPath } from './board-renderer-style.ts';
import type {
  EntitySpec,
  EntityState,
  TurnerVariant,
  WeaponType,
} from '../shared/types.ts';

/** 在指定容器中绘制完整实体视觉，可被棋盘本体、商店图标和拖拽预览复用。 */
export function mountEntityVisual(targetNode: Node, entity: EntitySpec | EntityState): void {
  const renderableEntity = toRenderableEntity(entity);
  const bodyNode = new Node('EntityBodyNode');
  bodyNode.setParent(targetNode);
  setNodeSize(bodyNode, ENTITY_BODY_SIZE, ENTITY_BODY_SIZE);

  const graphics = bodyNode.addComponent(Graphics);
  drawEntity(graphics, renderableEntity);
  mountEntityText(bodyNode, renderableEntity);

  if (renderableEntity.kind !== 'weapon') {
    return;
  }

  renderableEntity.tailDirections.forEach((direction, index) => {
    const tailNode = new Node(`EntityTailNode-${index}`);
    tailNode.setParent(targetNode);
    tailNode.setPosition(directionToOffset(direction));
    setNodeSize(tailNode, WEAPON_TAIL_SIZE, WEAPON_TAIL_SIZE);

    const tailGraphics = tailNode.addComponent(Graphics);
    tailGraphics.fillColor = new Color(255, 214, 102, 220);
    tailGraphics.circle(0, 0, WEAPON_TAIL_RADIUS);
    tailGraphics.fill();
  });
}

function drawEntity(graphics: Graphics, entity: EntityState): void {
  graphics.clear();
  graphics.lineWidth = 2;

  if (entity.kind === 'turner' || entity.kind === 'rotator') {
    drawTurnerLikeEntity(graphics, entity);
    return;
  }

  if (entity.kind === 'weapon') {
    drawWeaponEntity(graphics, entity);
    return;
  }

  switch (entity.kind) {
    case 'slow-zone':
      drawSlowZoneEntity(graphics);
      return;
    case 'chaos-gate':
      drawChaosGateEntity(graphics);
      return;
    case 'black-hole':
      drawBlackHoleEntity(graphics);
      return;
    case 'wreckage':
      drawWreckageEntity(graphics);
      return;
    case 'ice-block':
      drawIceBlockEntity(graphics);
      return;
    case 'stone':
      drawStoneEntity(graphics);
      return;
  }
}

function mountEntityText(targetNode: Node, entity: EntityState): void {
  if (entity.kind === 'weapon') {
    mountWeaponNameLabel(targetNode, entity.weaponType);
    return;
  }

  if (entity.kind === 'turner' || entity.kind === 'rotator') {
    mountLevelLabel(targetNode, entity.level);
  }
}

/** 武器直接显示名称，避免仅靠箭头图形表达，降低商店与棋盘中的识别成本。 */
function mountWeaponNameLabel(targetNode: Node, weaponType: WeaponType): void {
  const labelNode = new Node('WeaponNameLabelNode');
  labelNode.setParent(targetNode);
  setNodeSize(labelNode, WEAPON_BODY_SIZE - 8, 28);

  const label = labelNode.addComponent(Label);
  label.string = formatWeaponName(weaponType);
  label.fontSize = 14;
  label.lineHeight = 20;
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.color = new Color(15, 23, 42, 255);
}

function mountLevelLabel(targetNode: Node, level: number): void {
  const labelNode = new Node('EntityLevelLabelNode');
  labelNode.setParent(targetNode);
  labelNode.setPosition(new Vec3(0, -24, 0));
  setNodeSize(labelNode, 40, 18);

  const label = labelNode.addComponent(Label);
  label.string = `Lv${level}`;
  label.fontSize = 12;
  label.lineHeight = 14;
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.color = level <= 1 ? new Color(15, 23, 42, 255) : new Color(255, 255, 255, 255);
}

function drawDirectionGlyph(graphics: Graphics, variant: TurnerVariant): void {
  const glyphPath = getTurnerGlyphPath(variant);
  if (glyphPath.length === 0) {
    return;
  }

  graphics.strokeColor = new Color(0, 0, 0, 255);
  graphics.lineWidth = 5;
  graphics.moveTo(glyphPath[0][0], glyphPath[0][1]);
  glyphPath.slice(1).forEach(([x, y]) => {
    graphics.lineTo(x, y);
  });
  graphics.stroke();
}

function toRenderableEntity(entity: EntitySpec | EntityState): EntityState {
  switch (entity.kind) {
    case 'turner':
      return {
        kind: 'turner',
        coord: { ...entity.coord },
        variant: entity.variant,
        level: entity.level,
      };
    case 'rotator':
      return {
        kind: 'rotator',
        coord: { ...entity.coord },
        variant: entity.variant,
        level: entity.level,
      };
    case 'weapon':
      return {
        kind: 'weapon',
        id: getRenderableWeaponId(entity),
        coord: { ...entity.coord },
        weaponType: entity.weaponType,
        level: getRenderableWeaponLevel(entity),
        facing: entity.facing,
        tailDirections: getRenderableWeaponTailDirections(entity),
        charge: getRenderableWeaponCharge(entity),
      };
    case 'ice-block':
      return {
        kind: 'ice-block',
        coord: { ...entity.coord },
        durability: entity.durability,
      };
    case 'slow-zone':
      return {
        kind: 'slow-zone',
        coord: { ...entity.coord },
      };
    case 'chaos-gate':
      return {
        kind: 'chaos-gate',
        coord: { ...entity.coord },
      };
    case 'black-hole':
      return {
        kind: 'black-hole',
        coord: { ...entity.coord },
      };
    case 'wreckage':
      return {
        kind: 'wreckage',
        coord: { ...entity.coord },
      };
    case 'stone':
      return {
        kind: 'stone',
        coord: { ...entity.coord },
      };
  }
}


function getRenderableWeaponId(entity: Extract<EntitySpec | EntityState, { kind: 'weapon' }>): string {
  return 'id' in entity && typeof entity.id === 'string' ? entity.id : 'preview-weapon';
}

function getRenderableWeaponLevel(entity: Extract<EntitySpec | EntityState, { kind: 'weapon' }>): number {
  return 'level' in entity && typeof entity.level === 'number' ? entity.level : 1;
}

function getRenderableWeaponTailDirections(
  entity: Extract<EntitySpec | EntityState, { kind: 'weapon' }>,
): Extract<EntityState, { kind: 'weapon' }>['tailDirections'] {
  return 'tailDirections' in entity && entity.tailDirections
    ? [...entity.tailDirections]
    : [entity.facing];
}

function getRenderableWeaponCharge(entity: Extract<EntitySpec | EntityState, { kind: 'weapon' }>): number {
  return 'charge' in entity && typeof entity.charge === 'number' ? entity.charge : 0;
}

function getLevelColor(level: number): Color {
  const clampedLevelIndex = Math.min(LEVEL_COLORS.length, Math.max(1, level)) - 1;
  const color = LEVEL_COLORS[clampedLevelIndex];
  return new Color(color.r, color.g, color.b, color.a);
}

function getEntityStrokeColor(level: number): Color {
  return level <= 1 ? new Color(148, 163, 184, 255) : new Color(255, 255, 255, 220);
}

function drawTurnerLikeEntity(
  graphics: Graphics,
  entity: Extract<EntityState, { kind: 'turner' | 'rotator' }>,
): void {
  graphics.fillColor = entity.kind === 'rotator'
    ? new Color(45, 212, 191, 255)
    : getLevelColor(entity.level);
  graphics.strokeColor = getEntityStrokeColor(entity.kind === 'rotator' ? 0 : entity.level);
  drawRoundedEntityBody(graphics, ENTITY_CORNER_RADIUS);
  drawDirectionGlyph(graphics, entity.variant);
}

function drawSlowZoneEntity(graphics: Graphics): void {
  graphics.fillColor = new Color(250, 204, 21, 255);
  drawRoundedEntityFill(graphics, ENTITY_LARGE_CORNER_RADIUS);
}

function drawChaosGateEntity(graphics: Graphics): void {
  graphics.fillColor = new Color(168, 85, 247, 255);
  graphics.circle(0, 0, 28);
  graphics.fill();
}

function drawBlackHoleEntity(graphics: Graphics): void {
  graphics.fillColor = new Color(15, 23, 42, 255);
  graphics.strokeColor = new Color(125, 211, 252, 255);
  graphics.circle(0, 0, 30);
  graphics.fill();
  graphics.stroke();
}

function drawWreckageEntity(graphics: Graphics): void {
  graphics.fillColor = new Color(148, 163, 184, 255);
  graphics.moveTo(-24, -24);
  graphics.lineTo(24, 24);
  graphics.lineTo(12, 28);
  graphics.lineTo(-28, -12);
  graphics.close();
  graphics.fill();
}

function drawIceBlockEntity(graphics: Graphics): void {
  graphics.fillColor = new Color(125, 211, 252, 255);
  drawRoundedEntityFill(graphics, ENTITY_CORNER_RADIUS);
}

function drawStoneEntity(graphics: Graphics): void {
  graphics.fillColor = new Color(100, 116, 139, 255);
  drawRoundedEntityFill(graphics, ENTITY_LARGE_CORNER_RADIUS);
}

function drawWeaponEntity(
  graphics: Graphics,
  entity: Extract<EntityState, { kind: 'weapon' }>,
): void {
  graphics.fillColor = getLevelColor(entity.level);
  graphics.strokeColor = getEntityStrokeColor(entity.level);
  graphics.lineWidth = 2;
  graphics.roundRect(-WEAPON_HALF_BODY, -WEAPON_HALF_BODY, WEAPON_BODY_SIZE, WEAPON_BODY_SIZE, 8);
  graphics.fill();
  graphics.stroke();
}

function drawRoundedEntityBody(graphics: Graphics, cornerRadius: number): void {
  graphics.roundRect(
    -ENTITY_HALF_BODY,
    -ENTITY_HALF_BODY,
    ENTITY_HALF_BODY * 2,
    ENTITY_HALF_BODY * 2,
    cornerRadius,
  );
  graphics.fill();
  graphics.stroke();
}

function drawRoundedEntityFill(graphics: Graphics, cornerRadius: number): void {
  graphics.roundRect(
    -ENTITY_HALF_BODY,
    -ENTITY_HALF_BODY,
    ENTITY_HALF_BODY * 2,
    ENTITY_HALF_BODY * 2,
    cornerRadius,
  );
  graphics.fill();
}

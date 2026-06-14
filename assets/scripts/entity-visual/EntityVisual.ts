import {
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Node,
  Rect,
  resources,
  Sprite,
  SpriteFrame,
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
  WEAPON_TAIL_GEAR_CENTER_OFFSET_Y,
  WEAPON_TAIL_GEAR_IMAGE_SIZE,
  WEAPON_TAIL_GEAR_RAW_SIZE,
  WEAPON_TAIL_IMAGE_HEIGHT,
  WEAPON_TAIL_IMAGE_WIDTH,
  WEAPON_TAIL_RADIUS,
  WEAPON_TAIL_SPRITE_FRAME_PATH,
} from './entity-visual-constants.ts';
import { setEntityVisualNodeSize } from './entity-visual-node-utils.ts';
import { formatSupportName, getTurnerGlyphPath } from './entity-visual-style.ts';
import type {
  Direction,
  EntitySpec,
  EntityState,
  TurnerVariant,
} from '../shared/types.ts';

type EntityIconKey =
  | 'black-hole'
  | 'bomb'
  | 'chaos-gate'
  | 'ice-block'
  | 'laser'
  | 'lightning'
  | 'pistol'
  | 'rotator'
  | 'slow-zone'
  | 'stone'
  | 'turner'
  | 'wreckage'
  | 'damage-booster'
  | 'gold-booster'
  | 'crit-booster'
  | 'charge-booster';

interface PendingEntityIconHost {
  hostNode: Node;
  entity: EntityState;
}

interface PendingWeaponTailHost {
  hostNode: Node;
  direction: Direction;
}

const entityIconSpriteFrameByKey = new Map<EntityIconKey, SpriteFrame>();
const loadingEntityIconKeys = new Set<EntityIconKey>();
const pendingEntityIconHosts = new Map<EntityIconKey, Set<PendingEntityIconHost>>();

let weaponTailSpriteFrame: SpriteFrame | null = null;
let weaponTailGearSpriteFrame: SpriteFrame | null = null;
let isWeaponTailSpriteFrameLoadStarted = false;
const pendingWeaponTailHosts = new Set<PendingWeaponTailHost>();

/** 在指定容器中绘制完整实体视觉，可被棋盘本体、商店图标和拖拽预览复用。 */
export function mountEntityVisual(targetNode: Node, entity: EntitySpec | EntityState): void {
  const renderableEntity = toRenderableEntity(entity);
  const bodyNode = new Node('EntityBodyNode');
  bodyNode.setParent(targetNode);
  setEntityVisualNodeSize(bodyNode, ENTITY_BODY_SIZE, ENTITY_BODY_SIZE);

  mountEntityIconVisual(bodyNode, renderableEntity);
  mountEntityText(bodyNode, renderableEntity);

  if (renderableEntity.kind !== 'weapon') {
    return;
  }

  renderableEntity.tailDirections.forEach((direction, index) => {
    const tailCoord = getWeaponTailCoord(renderableEntity, direction);
    const tailNode = new Node(`EntityTailNode-${tailCoord.row}-${tailCoord.col}-${index}`);
    tailNode.setParent(targetNode);
    tailNode.setPosition(getWeaponTailPivotOffset(direction));
    setEntityVisualNodeSize(tailNode, WEAPON_TAIL_IMAGE_WIDTH, WEAPON_TAIL_IMAGE_HEIGHT);
    mountWeaponTailVisual(tailNode, direction);
  });
}

function getWeaponTailCoord(entity: Extract<EntityState, { kind: 'weapon' }>, direction: Direction) {
  switch (direction) {
    case 'up':
      return { row: entity.coord.row - 1, col: entity.coord.col };
    case 'down':
      return { row: entity.coord.row + 1, col: entity.coord.col };
    case 'left':
      return { row: entity.coord.row, col: entity.coord.col - 1 };
    case 'right':
      return { row: entity.coord.row, col: entity.coord.col + 1 };
  }
}

function mountEntityIconVisual(hostNode: Node, entity: EntityState): void {
  const iconKey = getEntityIconKey(entity);
  const spriteFrame = entityIconSpriteFrameByKey.get(iconKey);
  if (spriteFrame) {
    mountEntityIconSprite(hostNode, entity, spriteFrame);
    return;
  }

  mountEntityIconFallback(hostNode, entity);
  addPendingEntityIconHost(iconKey, hostNode, entity);
  loadEntityIconSpriteFrame(iconKey);
}

function mountEntityIconSprite(hostNode: Node, entity: EntityState, spriteFrame: SpriteFrame): void {
  hostNode.destroyAllChildren();
  hostNode.getComponent(Graphics)?.clear();

  const spriteNode = new Node('EntityIconSpriteNode');
  spriteNode.setParent(hostNode);
  spriteNode.setRotationFromEuler(0, 0, getEntityIconRotation(entity));
  setEntityVisualNodeSize(spriteNode, ENTITY_BODY_SIZE, ENTITY_BODY_SIZE);

  const sprite = spriteNode.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = spriteFrame;
}

function mountEntityIconFallback(hostNode: Node, entity: EntityState): void {
  const graphics = hostNode.addComponent(Graphics);
  drawEntity(graphics, entity);
}

function addPendingEntityIconHost(iconKey: EntityIconKey, hostNode: Node, entity: EntityState): void {
  const pendingHosts = pendingEntityIconHosts.get(iconKey) ?? new Set<PendingEntityIconHost>();
  pendingHosts.add({
    hostNode,
    entity,
  });
  pendingEntityIconHosts.set(iconKey, pendingHosts);
}

function loadEntityIconSpriteFrame(iconKey: EntityIconKey): void {
  if (entityIconSpriteFrameByKey.has(iconKey) || loadingEntityIconKeys.has(iconKey)) {
    return;
  }

  loadingEntityIconKeys.add(iconKey);
  const path = `images/entity/${iconKey}/spriteFrame`;
  resources.load(path, SpriteFrame, (error, spriteFrame) => {
    loadingEntityIconKeys.delete(iconKey);
    if (error) {
      console.warn(`Failed to load ${path}`, error);
      prunePendingEntityIconHosts(iconKey);
      return;
    }

    entityIconSpriteFrameByKey.set(iconKey, spriteFrame);
    flushPendingEntityIconHosts(iconKey, spriteFrame);
  });
}

function flushPendingEntityIconHosts(iconKey: EntityIconKey, spriteFrame: SpriteFrame): void {
  const pendingHosts = pendingEntityIconHosts.get(iconKey);
  if (!pendingHosts) {
    return;
  }

  for (const pendingHost of pendingHosts) {
    if (pendingHost.hostNode.isValid) {
      mountEntityIconSprite(pendingHost.hostNode, pendingHost.entity, spriteFrame);
    }
  }
  pendingEntityIconHosts.delete(iconKey);
}

function prunePendingEntityIconHosts(iconKey: EntityIconKey): void {
  const pendingHosts = pendingEntityIconHosts.get(iconKey);
  if (!pendingHosts) {
    return;
  }

  for (const pendingHost of pendingHosts) {
    if (!pendingHost.hostNode.isValid) {
      pendingHosts.delete(pendingHost);
    }
  }

  if (pendingHosts.size === 0) {
    pendingEntityIconHosts.delete(iconKey);
  }
}

function mountWeaponTailVisual(hostNode: Node, direction: Direction): void {
  if (weaponTailSpriteFrame) {
    mountWeaponTailSprite(hostNode, direction);
    return;
  }

  mountWeaponTailFallback(hostNode, direction);
  pendingWeaponTailHosts.add({
    hostNode,
    direction,
  });
  loadWeaponTailSpriteFrame();
}

function loadWeaponTailSpriteFrame(): void {
  if (weaponTailSpriteFrame || isWeaponTailSpriteFrameLoadStarted) {
    return;
  }

  isWeaponTailSpriteFrameLoadStarted = true;
  resources.load(WEAPON_TAIL_SPRITE_FRAME_PATH, SpriteFrame, (error, spriteFrame) => {
    if (error) {
      console.warn(`Failed to load ${WEAPON_TAIL_SPRITE_FRAME_PATH}`, error);
      isWeaponTailSpriteFrameLoadStarted = false;
      prunePendingWeaponTailHosts();
      return;
    }

    weaponTailSpriteFrame = spriteFrame;
    weaponTailGearSpriteFrame = createWeaponTailGearSpriteFrame(spriteFrame);
    flushPendingWeaponTailHosts();
  });
}

function flushPendingWeaponTailHosts(): void {
  for (const pendingHost of pendingWeaponTailHosts) {
    if (pendingHost.hostNode.isValid) {
      mountWeaponTailSprite(pendingHost.hostNode, pendingHost.direction);
    }
  }
  pendingWeaponTailHosts.clear();
}

function prunePendingWeaponTailHosts(): void {
  for (const pendingHost of pendingWeaponTailHosts) {
    if (!pendingHost.hostNode.isValid) {
      pendingWeaponTailHosts.delete(pendingHost);
    }
  }
}

function mountWeaponTailSprite(hostNode: Node, direction: Direction): void {
  if (!weaponTailSpriteFrame) {
    return;
  }

  hostNode.destroyAllChildren();
  hostNode.getComponent(Graphics)?.clear();

  const spriteNode = new Node('WeaponTailSpriteNode');
  spriteNode.setParent(hostNode);
  spriteNode.setPosition(getWeaponTailSpriteOffset(direction));
  spriteNode.setRotationFromEuler(0, 0, getWeaponTailSpriteRotation(direction));
  setEntityVisualNodeSize(spriteNode, WEAPON_TAIL_IMAGE_WIDTH, WEAPON_TAIL_IMAGE_HEIGHT);

  const sprite = spriteNode.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = weaponTailSpriteFrame;

  mountWeaponTailGearSprite(hostNode, direction);
}

function mountWeaponTailGearSprite(hostNode: Node, direction: Direction): void {
  if (!weaponTailGearSpriteFrame) {
    return;
  }

  const gearNode = new Node('WeaponTailGearNode');
  gearNode.setParent(hostNode);
  gearNode.setPosition(getWeaponTailGearOffsetFromPivot(direction));
  setEntityVisualNodeSize(gearNode, WEAPON_TAIL_GEAR_IMAGE_SIZE, WEAPON_TAIL_GEAR_IMAGE_SIZE);

  const gearSprite = gearNode.addComponent(Sprite);
  gearSprite.sizeMode = Sprite.SizeMode.CUSTOM;
  gearSprite.spriteFrame = weaponTailGearSpriteFrame;
}

function createWeaponTailGearSpriteFrame(sourceSpriteFrame: SpriteFrame): SpriteFrame {
  const gearSpriteFrame = sourceSpriteFrame.clone();
  gearSpriteFrame.rect = new Rect(0, 0, WEAPON_TAIL_GEAR_RAW_SIZE, WEAPON_TAIL_GEAR_RAW_SIZE);
  return gearSpriteFrame;
}

function mountWeaponTailFallback(hostNode: Node, direction: Direction): void {
  const tailGraphics = hostNode.addComponent(Graphics);
  tailGraphics.fillColor = new Color(255, 214, 102, 220);
  const gearOffset = getWeaponTailGearOffsetFromPivot(direction);
  tailGraphics.circle(gearOffset.x, gearOffset.y, WEAPON_TAIL_RADIUS);
  tailGraphics.fill();
}

function getWeaponTailGearCenterOffset(direction: Direction): Vec3 {
  switch (direction) {
    case 'up':
      return new Vec3(0, ENTITY_BODY_SIZE, 0);
    case 'down':
      return new Vec3(0, -ENTITY_BODY_SIZE, 0);
    case 'left':
      return new Vec3(-ENTITY_BODY_SIZE, 0, 0);
    case 'right':
      return new Vec3(ENTITY_BODY_SIZE, 0, 0);
  }
}

function getWeaponTailPivotOffset(direction: Direction): Vec3 {
  const gearCenterOffset = getWeaponTailGearCenterOffset(direction);
  const gearOffsetFromPivot = getWeaponTailGearOffsetFromPivot(direction);
  return new Vec3(
    gearCenterOffset.x - gearOffsetFromPivot.x,
    gearCenterOffset.y - gearOffsetFromPivot.y,
    0,
  );
}

function getWeaponTailSpriteRotation(direction: Direction): number {
  switch (direction) {
    case 'up':
      return 0;
    case 'down':
      return 180;
    case 'left':
      return 90;
    case 'right':
      return -90;
  }
}

function getWeaponTailSpriteOffset(direction: Direction): Vec3 {
  return rotateLocalUpOffset(direction, WEAPON_TAIL_IMAGE_HEIGHT / 2);
}

function getWeaponTailGearOffsetFromPivot(direction: Direction): Vec3 {
  return rotateLocalUpOffset(
    direction,
    WEAPON_TAIL_GEAR_CENTER_OFFSET_Y + WEAPON_TAIL_IMAGE_HEIGHT / 2,
  );
}

function rotateLocalUpOffset(direction: Direction, offsetY: number): Vec3 {
  switch (direction) {
    case 'up':
      return new Vec3(0, offsetY, 0);
    case 'down':
      return new Vec3(0, -offsetY, 0);
    case 'left':
      return new Vec3(-offsetY, 0, 0);
    case 'right':
      return new Vec3(offsetY, 0, 0);
  }
}

function drawEntity(graphics: Graphics, entity: EntityState): void {
  graphics.clear();
  graphics.lineWidth = 2;

  if (entity.kind === 'rotator') {
    drawTurnerLikeEntity(graphics, entity);
    return;
  }

  if (entity.kind === 'weapon') {
    drawWeaponEntity(graphics, entity);
    return;
  }

  if (entity.kind === 'support') {
    drawSupportEntity(graphics, entity);
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
  if (entity.kind === 'turner' || entity.kind === 'rotator') {
    mountLevelLabel(targetNode, entity.level);
  }

  if (entity.kind === 'support') {
    mountSupportLabel(targetNode, entity);
  }
}

function mountSupportLabel(targetNode: Node, entity: Extract<EntityState, { kind: 'support' }>): void {
  const labelNode = new Node('EntitySupportLabelNode');
  labelNode.setParent(targetNode);
  labelNode.setPosition(new Vec3(0, 0, 0));
  setEntityVisualNodeSize(labelNode, 50, 18);

  const label = labelNode.addComponent(Label);
  label.string = formatSupportName(entity.supportType);
  label.fontSize = 12;
  label.lineHeight = 14;
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.color = new Color(15, 23, 42, 255);

  mountLevelLabel(targetNode, entity.level);
}

function mountLevelLabel(targetNode: Node, level: number): void {
  const labelNode = new Node('EntityLevelLabelNode');
  labelNode.setParent(targetNode);
  labelNode.setPosition(new Vec3(0, -24, 0));
  setEntityVisualNodeSize(labelNode, 40, 18);

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

function getEntityIconKey(entity: EntityState): EntityIconKey {
  if (entity.kind === 'weapon') {
    return entity.weaponType;
  }
  if (entity.kind === 'support') {
    return entity.supportType;
  }
  return entity.kind;
}

function getEntityIconRotation(entity: EntityState): number {
  if (entity.kind === 'turner' || entity.kind === 'rotator') {
    return getTurnerIconRotation(entity.variant);
  }

  return 0;
}

function getTurnerIconRotation(variant: TurnerVariant): number {
  switch (variant) {
    case 'left-up':
      return 0;
    case 'left-down':
      return 90;
    case 'right-down':
      return 180;
    case 'right-up':
      return -90;
  }
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
    case 'support':
      return {
        kind: 'support',
        coord: { ...entity.coord },
        supportType: entity.supportType,
        level: 'level' in entity && typeof entity.level === 'number' ? entity.level : 1,
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

function drawSupportEntity(
  graphics: Graphics,
  entity: Extract<EntityState, { kind: 'support' }>,
): void {
  graphics.fillColor = getLevelColor(entity.level);
  graphics.strokeColor = getEntityStrokeColor(entity.level);
  graphics.lineWidth = 2;
  drawRoundedEntityBody(graphics, ENTITY_CORNER_RADIUS);
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

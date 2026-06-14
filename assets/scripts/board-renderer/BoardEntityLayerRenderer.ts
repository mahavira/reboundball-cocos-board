import { Color, Graphics, Node, tween, Tween, Vec3 } from 'cc';

import type { BoardCoordinateMapper } from './BoardCoordinateMapper.ts';
import { CELL_SIZE } from './board-renderer-constants.ts';
import { createChild, setNodeSize } from './board-renderer-node-utils.ts';
import { mountEntityVisual } from '../entity-visual/EntityVisual.ts';
import {
  collectActiveSupportAuraState,
  type ActiveSupportAuraState,
} from '../board-runtime/SupportAuraActivation.ts';
import { coordKey } from '../shared/helpers.ts';
import type { Direction, EntityState, GridCoord } from '../shared/types.ts';

type BoardEntityLayerRendererOptions = {
  getEntityLayerNode: () => Node;
  coordinateMapper: BoardCoordinateMapper;
};

/** 管理棋盘 entity 节点在哪一格、何时创建销毁；内部视觉交给 EntityVisual。 */
export class BoardEntityLayerRenderer {
  private readonly getEntityLayerNode: () => Node;
  private readonly coordinateMapper: BoardCoordinateMapper;
  private readonly entityNodeMap = new Map<string, Node>();

  constructor(options: BoardEntityLayerRendererOptions) {
    this.getEntityLayerNode = options.getEntityLayerNode;
    this.coordinateMapper = options.coordinateMapper;
  }

  rebuild(entities: EntityState[]): void {
    this.getEntityLayerNode().destroyAllChildren();
    this.entityNodeMap.clear();

    const activeSupportAuraState = collectActiveSupportAuraState(entities);
    for (const entity of entities) {
      this.createPlacedEntityNode(entity, getEntitySupportAuraLightDirection(entity, activeSupportAuraState));
    }
  }

  update(coord: GridCoord, entity: EntityState | null): void {
    const key = coordKey(coord);
    const oldNode = this.entityNodeMap.get(key);
    if (oldNode) {
      oldNode.destroy();
      this.entityNodeMap.delete(key);
    }

    if (!entity) {
      return;
    }

    this.createPlacedEntityNode(entity, null);
  }

  playWeaponTailChargeFeedback(weaponCoord: GridCoord, tailCoord: GridCoord): void {
    const entityNode = this.entityNodeMap.get(coordKey(weaponCoord));
    if (!entityNode) {
      return;
    }

    const tailNodeNamePrefix = `EntityTailNode-${tailCoord.row}-${tailCoord.col}-`;
    for (const tailNode of entityNode.children.filter((child) => child.name.startsWith(tailNodeNamePrefix))) {
      Tween.stopAllByTarget(tailNode);
      tailNode.setRotationFromEuler(0, 0, 0);
      tween(tailNode)
        .to(0.05, { eulerAngles: new Vec3(0, 0, 7) })
        .to(0.08, { eulerAngles: new Vec3(0, 0, -6) })
        .to(0.06, { eulerAngles: new Vec3(0, 0, 3) })
        .to(0.05, { eulerAngles: new Vec3(0, 0, 0) })
        .start();
      this.playWeaponTailGearChargeFeedback(tailNode);
    }
  }

  private playWeaponTailGearChargeFeedback(tailNode: Node): void {
    const gearNode = tailNode.getChildByName('WeaponTailGearNode');
    if (!gearNode) {
      return;
    }

    Tween.stopAllByTarget(gearNode);
    gearNode.setRotationFromEuler(0, 0, 0);
    tween(gearNode)
      .by(0.07, { eulerAngles: new Vec3(0, 0, -180) })
      .by(0.12, { eulerAngles: new Vec3(0, 0, -130) })
      .by(0.18, { eulerAngles: new Vec3(0, 0, -70) })
      .by(0.22, { eulerAngles: new Vec3(0, 0, -30) })
      .start();
  }

  private createPlacedEntityNode(entity: EntityState, supportAuraLightDirection: Direction | null): void {
    const entityRootNode = createChild(
      this.getEntityLayerNode(),
      `Entity-${entity.coord.row}-${entity.coord.col}`,
    );
    /**
     * 已放置实体支持直接拖拽。Cocos 指针命中检测要求挂事件的节点本身具备 UITransform。
     */
    setNodeSize(entityRootNode, CELL_SIZE, CELL_SIZE);
    entityRootNode.setPosition(this.coordinateMapper.getCachedGridPosition(entity.coord));
    mountEntityVisual(entityRootNode, entity);
    if (supportAuraLightDirection) {
      mountSupportAuraActiveLight(entityRootNode, supportAuraLightDirection);
    }
    this.entityNodeMap.set(coordKey(entity.coord), entityRootNode);
  }
}

function getEntitySupportAuraLightDirection(
  entity: EntityState,
  auraState: ActiveSupportAuraState,
): Direction | null {
  const key = coordKey(entity.coord);
  if (entity.kind === 'weapon') {
    return auraState.activeWeaponDirectionByCoordKey.get(key) ?? null;
  }
  if (entity.kind === 'support') {
    return auraState.activeSupportDirectionByCoordKey.get(key) ?? null;
  }
  return null;
}

function mountSupportAuraActiveLight(targetNode: Node, direction: Direction): void {
  const lightNode = createChild(targetNode, 'SupportAuraActiveLightNode');
  lightNode.setPosition(getSupportAuraLightPosition(direction));
  setNodeSize(lightNode, 14, 14);

  const graphics = lightNode.addComponent(Graphics);
  graphics.fillColor = new Color(34, 197, 94, 255);
  graphics.strokeColor = new Color(220, 252, 231, 255);
  graphics.lineWidth = 2;
  graphics.circle(0, 0, 6);
  graphics.fill();
  graphics.stroke();
}

function getSupportAuraLightPosition(direction: Direction): Vec3 {
  const edgeOffset = CELL_SIZE / 2;
  switch (direction) {
    case 'up':
      return new Vec3(0, edgeOffset, 0);
    case 'right':
      return new Vec3(edgeOffset, 0, 0);
    case 'down':
      return new Vec3(0, -edgeOffset, 0);
    case 'left':
      return new Vec3(-edgeOffset, 0, 0);
  }
}

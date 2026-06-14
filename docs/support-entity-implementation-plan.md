# Support 辅助 Entity 实施设计文档

## 1. 当前代码状态

本文件基于当前仓库代码重新整理，适用于在 Codex 中执行实现。

当前代码结构要点：

- `WEAPON_TYPES` 仍只包含主动武器：`pistol / bomb / laser / lightning`。
- `WeaponEvent` 当前只包含 `type / weaponId / weaponType / coord`，还没有 modifier 字段。
- `EntitySpec` 和 `EntityState` 当前还没有 `support`。
- `ShopItemDefinition` 当前只包含 `turner / weapon`。
- 随机商店实体来自 `ENTITY_DEFINITIONS` 中 `canAppearInRandomShop = true` 的实体。
- `WeaponChargeSystem` 当前固定 `charge += 1`，开火后直接 `charge = 0`。
- `BoardRuntime` 当前直接创建 `WeaponChargeSystem(this.entities, this.events)`。
- `BoardEntityVisual` 当前使用 `images/entity/<iconKey>/spriteFrame` 加载实体图标，失败时使用 fallback 绘制。
- 当前测试入口是 `npm test`，脚本为 `node --test tests/*.test.ts`。
- 当前 TypeScript 配置开启了 `strict: true`。

因此，本次改动应以“新增独立 support Entity”为主，不要把辅助单位塞进现有 weapon 模型。

---

## 2. 目标

新增一类无触发器的辅助 Entity：

```ts
kind: 'support'
```

保留 4 种辅助类型，全部使用功能型命名：

| supportType | 中文显示名 | 效果 |
|---|---|---|
| `damage-booster` | 攻击增幅器 | 附近武器攻击力提升 |
| `gold-booster` | 金币增幅器 | 附近武器击杀金币加成 |
| `crit-booster` | 暴击增幅器 | 附近武器暴击率提升 |
| `charge-booster` | 充能增幅器 | 附近武器充能速度提升 |

旧命名不再使用：

| 旧命名 | 替换为 |
|---|---|
| `battery` | `damage-booster` |
| `bounty` | `gold-booster` |
| `crit` | `crit-booster` |
| `coffee-generator` | `charge-booster` |
| `experience` | 移除 |

明确禁止：

- 不新增 `experience`。
- 不新增 `onKillExpBonus`。
- 不实现经验相关逻辑。
- 不使用 `battery / bounty / crit / coffee-generator` 作为最终代码类型名。
- `crit` 不能作为 supportType，必须使用 `crit-booster`。

---

## 3. 非目标

本阶段不实现以下内容：

- 敌人血量系统。
- 伤害最终结算。
- 暴击最终判定。
- 金币实际增加。
- 经验实际增加。
- 击杀事件结算。
- 一帧多次开火。
- support 专属正式美术资源制作。

本阶段只负责：

1. 新增 support 类型。
2. 让 support 进入商店、放置、拖拽、交换、回收、合并。
3. 让 support 光环效果汇总到 `WeaponEvent.modifiers`。
4. 让 `charge-booster` 真实影响武器充能速度。

---

## 4. 核心设计原则

### 4.1 不修改 WEAPON_TYPES 承载 support

禁止：

```ts
export const WEAPON_TYPES = [
  'pistol',
  'bomb',
  'laser',
  'lightning',
  'damage-booster',
  'gold-booster',
  'crit-booster',
  'charge-booster',
] as const;
```

原因：

- support 不是主动开火武器。
- support 不应该拥有 `facing`。
- support 不应该拥有 `tailDirections`。
- support 不应该拥有 `charge`。
- support 不应该进入武器尾巴充能索引。

---

### 4.2 support 是独立 Entity

新增类型：

```ts
export const SUPPORT_TYPES = [
  'damage-booster',
  'gold-booster',
  'crit-booster',
  'charge-booster',
] as const;

export type SupportType = (typeof SUPPORT_TYPES)[number];
```

Entity Spec：

```ts
export type SupportEntitySpec = BaseEntitySpec & {
  kind: 'support';
  supportType: SupportType;
  level?: number;
};
```

运行时状态：

```ts
{
  kind: 'support';
  coord: GridCoord;
  supportType: SupportType;
  level: number;
}
```

---

### 4.3 光环范围

第一版只影响上下左右 1 格，不包含斜角：

```txt
  X
X W X
  X
```

其中：

- `W` 是武器。
- `X` 是可生效的 support 位置。

不包含斜角：

```txt
X   X
  W
X   X
```

原因：

5×5 棋盘空间较小。如果斜角也生效，辅助覆盖范围过强，会削弱摆放策略。

---

## 5. 类型与配置改动

### 5.1 修改 `assets/scripts/shared/entity-definitions.ts`

新增：

```ts
export const SUPPORT_TYPES = [
  'damage-booster',
  'gold-booster',
  'crit-booster',
  'charge-booster',
] as const;
```

新增效果配置：

```ts
export const SUPPORT_EFFECTS_BY_TYPE = {
  'damage-booster': {
    damageMultiplierBonusByLevel: [0.2, 0.35, 0.5, 0.65, 0.8],
  },
  'gold-booster': {
    onKillGoldBonusByLevel: [1, 2, 3, 4, 5],
  },
  'crit-booster': {
    critChanceBonusByLevel: [0.1, 0.15, 0.2, 0.25, 0.3],
  },
  'charge-booster': {
    chargeGainMultiplierBonusByLevel: [0.2, 0.35, 0.5, 0.65, 0.8],
  },
} as const;
```

要求：

- level 从 1 开始。
- 读取数组时必须 clamp。
- level 超过 5 时按 5 级读取。
- 不允许访问越界数组。
- 不要把配置读取逻辑散落在多个文件里。

建议在同文件中新增通用读取函数：

```ts
export function getSupportLevelIndex(level: number): number {
  return Math.min(4, Math.max(0, Math.floor(level) - 1));
}
```

---

### 5.2 修改 `assets/scripts/shared/types.ts`

新增导入：

```ts
SUPPORT_TYPES
```

新增类型：

```ts
export type SupportType = (typeof SUPPORT_TYPES)[number];
```

新增 Entity Spec：

```ts
export type SupportEntitySpec = BaseEntitySpec & {
  kind: 'support';
  supportType: SupportType;
  level?: number;
};
```

把 `SupportEntitySpec` 加入 `EntitySpec` 联合类型。

新增运行时状态分支：

```ts
| {
    kind: 'support';
    coord: GridCoord;
    supportType: SupportType;
    level: number;
  }
```

新增商店商品类型：

```ts
export type SupportShopItemDefinition = {
  itemId: string;
  kind: 'support';
  supportType: SupportType;
  level: number;
};
```

修改：

```ts
export type ShopItemDefinition =
  | TurnerShopItemDefinition
  | WeaponShopItemDefinition
  | SupportShopItemDefinition;
```

新增武器 modifier：

```ts
export type WeaponModifiers = {
  damageMultiplier: number;
  critChanceBonus: number;
  chargeGainMultiplier: number;
  onKillGoldBonus: number;
};
```

修改 `WeaponEvent`：

```ts
export type WeaponEvent = {
  type: 'weapon-fired';
  weaponId: string;
  weaponType: WeaponType;
  coord: GridCoord;
  modifiers: WeaponModifiers;
};
```

---

## 6. Entity 注册表与商店

### 6.1 修改 `assets/scripts/shared/entity-registry.ts`

新增：

```ts
support: {
  kind: 'support',
  canDragFromBoard: true,
  canSwapOnBoard: true,
  canRecycleFromBoard: true,
  canMergeFromPlacement: true,
  canChargeFromTail: false,
  canAppearInRandomShop: true,
}
```

要求：

- `canChargeFromTail` 必须是 `false`。
- `support` 可以进入随机商店。
- `support` 可以合并。
- `support` 可以回收。
- `support` 不应进入 `canUseWeaponTailCharge`。

当前 `canUseWeaponTailCharge` 已经要求：

```ts
entity.kind === 'weapon'
```

所以只要不要把 support 加入 weapon，就不会污染尾巴充能系统。

---

### 6.2 修改 `assets/scripts/shop/ShopItemFactory.ts`

当前商店商品池只支持 `turner / weapon`，需要扩展 support。

新增导入：

```ts
SUPPORT_TYPES
```

新增类型导入：

```ts
SupportShopItemDefinition
```

新增：

```ts
function createSupportItem(
  itemId: string,
  randomFn: () => number,
): SupportShopItemDefinition {
  return {
    itemId,
    kind: 'support',
    supportType: SUPPORT_TYPES[getRandomIndex(SUPPORT_TYPES.length, randomFn)],
    level: 1,
  };
}
```

修改 `createRandomShopItem`：

```ts
switch (kind) {
  case 'turner':
    return createTurnerItem(itemId, randomFn);
  case 'weapon':
    return createWeaponItem(itemId, randomFn);
  case 'support':
    return createSupportItem(itemId, randomFn);
}
```

修改 `createShopPlacementSpec`：

```ts
if (item.kind === 'support') {
  return {
    kind: 'support',
    coord,
    supportType: item.supportType,
    level: item.level,
  };
}
```

修改 `createPlacementSpecFromEntity`：

```ts
case 'support':
  return {
    kind: 'support',
    coord,
    supportType: entity.supportType,
    level: entity.level,
  };
```

---

## 7. 放置、交换与合并

### 7.1 当前放置链路

`BoardPlacementService` 当前已经统一处理：

- 内部 5×5 棋盘命中。
- 空格放置。
- 同类合并。
- 棋盘内拖拽移动。
- 可交换实体互换。

因此 support 不需要新增单独放置服务，只需要补齐类型、注册表、商店转换和合并规则。

---

### 7.2 修改 `assets/scripts/board-placement/MergeRule.ts`

新增合并预览：

```ts
if (item.kind === 'support' && targetEntity.kind === 'support') {
  return item.supportType === targetEntity.supportType
    && item.level === targetEntity.level
      ? 'mergeable'
      : 'blocked';
}
```

新增合并结果：

```ts
if (item.kind === 'support' && targetEntity.kind === 'support') {
  return {
    kind: 'support',
    coord: targetEntity.coord,
    supportType: targetEntity.supportType,
    level: Math.min(targetEntity.level + 1, 5),
  };
}
```

规则：

- 同 `supportType` 才能合并。
- 同 `level` 才能合并。
- 合并后等级 +1。
- 最高 5 级。
- 不允许不同辅助类型合并。
- 不允许 support 与 weapon 合并。
- 不允许 support 与 turner 合并。

---

## 8. 运行时规则

### 8.1 修改 `assets/scripts/board-runtime/board-runtime-rules.ts`

#### `createEntityState`

新增：

```ts
case 'support':
  return {
    kind: 'support',
    coord: cloneCoord(spec.coord),
    supportType: spec.supportType,
    level: spec.level ?? 1,
  };
```

#### `canEnterEntity`

support 是棋盘占位实体，应阻挡弹球：

```ts
case 'support':
  return false;
```

#### `resolveCenterInteraction`

虽然 support 会阻挡弹球，正常不会进入中心，但为保证类型分支完整，仍应补：

```ts
case 'support':
  return {};
```

---

### 8.2 `EntityMutations.ts`

当前 `upgradeEntity` 对所有带 `level` 字段的实体生效，并在 `level >= 5` 时回到 1。

support 有 `level` 后会自动参与 `upgradeEntity`。

注意：

- 合并规则建议 `Math.min(level + 1, 5)`，不要循环回 1。
- 手动升级是否继续沿用当前循环逻辑，暂不改动。
- 如果后续需要统一上限行为，再单独重构 `upgradeEntity`。

---

## 9. SupportAuraSystem

新增文件：

```txt
assets/scripts/board-runtime/SupportAuraSystem.ts
```

职责：

- 根据武器坐标读取上下左右 1 格。
- 判断邻格是否为 support。
- 汇总 `WeaponModifiers`。
- 给 `WeaponChargeSystem` 使用。

建议接口：

```ts
export class SupportAuraSystem {
  constructor(entities: EntityStore) {}

  getWeaponModifiers(
    weapon: Extract<EntityState, { kind: 'weapon' }>,
  ): WeaponModifiers;
}
```

默认值：

```ts
const DEFAULT_WEAPON_MODIFIERS: WeaponModifiers = {
  damageMultiplier: 1,
  critChanceBonus: 0,
  chargeGainMultiplier: 1,
  onKillGoldBonus: 0,
};
```

邻格方向：

```ts
const SUPPORT_AURA_DIRECTIONS: Direction[] = [
  'up',
  'right',
  'down',
  'left',
];
```

查找方式：

```ts
for (const direction of SUPPORT_AURA_DIRECTIONS) {
  const neighbor = moveCoord(weapon.coord, direction);
  const entity = this.entities.getMutable(neighbor);

  if (entity?.kind !== 'support') {
    continue;
  }

  // apply support effect
}
```

效果叠加：

```ts
damageMultiplier += damageBoosterBonus
critChanceBonus += critBoosterBonus
chargeGainMultiplier += chargeBoosterBonus
onKillGoldBonus += goldBoosterBonus
```

要求：

- 不扫描全表。
- 不包含斜角。
- 不处理经验。
- 不返回 `onKillExpBonus`。
- 不修改实体状态。
- 只计算 modifier。

---

## 10. WeaponChargeSystem 与 BoardRuntime 接入

### 10.1 修改 `WeaponChargeSystem.ts`

当前逻辑：

```ts
entity.charge += 1;
```

改为：

```ts
const modifiers = this.supportAuraSystem.getWeaponModifiers(entity);
entity.charge += modifiers.chargeGainMultiplier;
```

创建事件时带 modifier：

```ts
weaponEvents.push(this.createWeaponFiredEvent(entity, modifiers));
```

修改事件创建函数：

```ts
private createWeaponFiredEvent(
  entity: WeaponEntity,
  modifiers: WeaponModifiers,
): WeaponEvent {
  return {
    type: 'weapon-fired',
    weaponId: entity.id,
    weaponType: entity.weaponType,
    coord: cloneCoord(entity.coord),
    modifiers,
  };
}
```

开火后保留溢出充能：

```ts
const chargeLimit = getWeaponChargeLimit(entity);

if (entity.charge >= chargeLimit) {
  entity.charge -= chargeLimit;
  weaponEvents.push(this.createWeaponFiredEvent(entity, modifiers));
}
```

禁止继续使用：

```ts
entity.charge = 0;
```

原因：

`charge-booster` 会让充能变成 `1.2`、`1.35` 等小数。直接归零会丢失溢出。

第一版不要写 `while`。  
一次 tick 最多开火一次，避免事件与动画系统还没准备好时产生多次开火。

---

### 10.2 修改 `BoardRuntime.ts`

新增：

```ts
private readonly supportAuraSystem = new SupportAuraSystem(this.entities);
```

修改：

```ts
private readonly weaponChargeSystem = new WeaponChargeSystem(
  this.entities,
  this.events,
  this.supportAuraSystem,
);
```

不要让 `BallStepper` 直接知道 support 规则。  
`BallStepper` 继续只调用：

```ts
this.weaponChargeSystem.handleTailCharge(currentCell)
```

---

## 11. 渲染接入

当前 `BoardEntityVisual` 通过 `EntityIconKey` 映射图标，并加载：

```txt
images/entity/<iconKey>/spriteFrame
```

support 应接入现有图标加载机制。

### 11.1 修改 `BoardEntityVisual.ts`

扩展 `EntityIconKey`：

```ts
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
```

修改 `getEntityIconKey`：

```ts
if (entity.kind === 'weapon') {
  return entity.weaponType;
}

if (entity.kind === 'support') {
  return entity.supportType;
}

return entity.kind;
```

修改 `drawEntity`，增加 fallback：

```ts
if (entity.kind === 'support') {
  drawSupportEntity(graphics, entity);
  return;
}
```

新增：

```ts
function drawSupportEntity(
  graphics: Graphics,
  entity: Extract<EntityState, { kind: 'support' }>,
): void {
  graphics.fillColor = getLevelColor(entity.level);
  graphics.strokeColor = getEntityStrokeColor(entity.level);
  graphics.lineWidth = 2;
  drawRoundedEntityBody(graphics, ENTITY_CORNER_RADIUS);
}
```

修改 `toRenderableEntity`，增加：

```ts
case 'support':
  return {
    kind: 'support',
    coord: { ...entity.coord },
    supportType: entity.supportType,
    level: 'level' in entity && typeof entity.level === 'number' ? entity.level : 1,
  };
```

### 11.2 修改 `board-renderer-style.ts`

新增支持名映射：

```ts
import type { SupportType } from '../shared/types.ts';

const SUPPORT_NAME_BY_TYPE: Record<SupportType, string> = {
  'damage-booster': 'ATK',
  'gold-booster': 'GOLD',
  'crit-booster': 'CRIT',
  'charge-booster': 'CHG',
};

export function formatSupportName(supportType: SupportType): string {
  return SUPPORT_NAME_BY_TYPE[supportType];
}
```

用途：

- fallback 文本。
- debug 文本。
- 后续 UI tooltip。
- 不要把 support 显示名散落在 `BoardEntityVisual.ts`。

### 11.3 图标资源说明

本项目已经为 4 个 support Entity 生成了图标资源。

4 个 supportType 与图标资源必须一一对应：

| supportType | 图标文件名 | 说明 |
|---|---|---|
| `damage-booster` | `damage-booster.png` | 攻击增幅器图标 |
| `gold-booster` | `gold-booster.png` | 金币增幅器图标 |
| `crit-booster` | `crit-booster.png` | 暴击增幅器图标 |
| `charge-booster` | `charge-booster.png` | 充能增幅器图标 |

图标应放入 Cocos Creator 的 resources 目录：

```txt
assets/resources/images/entity/damage-booster.png
assets/resources/images/entity/gold-booster.png
assets/resources/images/entity/crit-booster.png
assets/resources/images/entity/charge-booster.png

---

## 12. 测试与验收标准

### 12.1 修改 `tests/BoardRuntime.test.ts`

新增测试。

#### support 阻挡弹球

```ts
test('support entity blocks ball like weapon cell', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'support',
        coord: { row: 3, col: 2 },
        supportType: 'damage-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');

  assert.equal(step.outcome, 'blocked');
  assert.deepEqual(step.finalCell, { row: 3, col: 1 });
  assert.equal(step.finalDirection, 'left');
});
```

#### charge-booster 提升充能速度

```ts
test('charge-booster support increases adjacent weapon charge gain', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
      },
      {
        kind: 'support',
        coord: { row: 2, col: 2 },
        supportType: 'charge-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  runtime.tickBall('ball-1');

  const weapon = runtime.getEntityAt({ row: 3, col: 2 });

  assert.equal(weapon?.kind, 'weapon');
  assert.equal(weapon?.kind === 'weapon' ? weapon.charge : null, 1.2);
});
```

#### charge-booster 满充后保留溢出

```ts
test('charge-booster keeps overflow charge after weapon fires', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
        charge: 1,
      },
      {
        kind: 'support',
        coord: { row: 2, col: 2 },
        supportType: 'charge-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');

  const weapon = runtime.getEntityAt({ row: 3, col: 2 });

  assert.equal(step.weaponEvents.length, 1);
  assert.equal(step.weaponEvents[0].modifiers.chargeGainMultiplier, 1.2);
  assert.equal(weapon?.kind, 'weapon');
  assert.equal(weapon?.kind === 'weapon' ? weapon.charge : null, 0.2);
});
```

#### damage-booster / gold-booster / crit-booster modifier 输出

```ts
test('support aura adds weapon fire modifiers from adjacent supports', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
        charge: 1,
      },
      {
        kind: 'support',
        coord: { row: 2, col: 2 },
        supportType: 'damage-booster',
        level: 1,
      },
      {
        kind: 'support',
        coord: { row: 3, col: 3 },
        supportType: 'gold-booster',
        level: 1,
      },
      {
        kind: 'support',
        coord: { row: 4, col: 2 },
        supportType: 'crit-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');

  assert.equal(step.weaponEvents.length, 1);

  const modifiers = step.weaponEvents[0].modifiers;
  assert.equal(modifiers.damageMultiplier, 1.2);
  assert.equal(modifiers.onKillGoldBonus, 1);
  assert.equal(modifiers.critChanceBonus, 0.1);
  assert.equal(modifiers.chargeGainMultiplier, 1);
});
```

#### 斜角 support 不生效

```ts
test('diagonal support does not affect weapon modifiers', () => {
  const runtime = createRuntime({
    entities: [
      {
        kind: 'weapon',
        coord: { row: 3, col: 2 },
        weaponType: 'pistol',
        facing: 'left',
        charge: 1,
      },
      {
        kind: 'support',
        coord: { row: 2, col: 1 },
        supportType: 'damage-booster',
        level: 1,
      },
    ],
  });

  runtime.spawnBall({ ballId: 'ball-1', isFast: false });
  runtime.tickBall('ball-1');
  const step = runtime.tickBall('ball-1');

  assert.equal(step.weaponEvents.length, 1);
  assert.equal(step.weaponEvents[0].modifiers.damageMultiplier, 1);
});
```

---

### 12.2 执行测试

运行：

```bash
npm test
```

必须满足：

- 原有测试全部通过。
- 新增测试全部通过。
- `support` 不加入 `WEAPON_TYPES`。
- `support` 不包含 `facing`。
- `support` 不包含 `tailDirections`。
- `support` 不包含 `charge`。
- `support` 能进入随机商店。
- `support` 能放置到棋盘内部 5×5 区域。
- `support` 能拖拽、交换、回收。
- `support` 同类型同等级可以合并升级。
- `charge-booster` 能真实提高充能速度。
- `damage-booster / gold-booster / crit-booster` 只输出到 `WeaponEvent.modifiers`。
- 不实现最终金币、伤害、暴击结算。
- 不出现 `experience`。
- 不出现 `onKillExpBonus`。
- 不出现旧代码类型名：`battery / bounty / coffee-generator`。
- 不把旧的 `crit` 作为 supportType，必须使用 `crit-booster`。
- TypeScript strict 不报错。

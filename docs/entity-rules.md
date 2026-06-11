# Entity 规则体系

本文档说明当前棋盘 Entity 的规则归属和新增流程。目标是新增 Entity 时优先修改定义和明确扩展点，避免改动 runtime 主流程。

## 分类

| Entity | 分类 | 当前来源 | 主要规则归属 |
|---|---|---|---|
| `turner` | `redirector` | 商店、预设 | 放置、合并、弹球转向、等级速度、渲染 |
| `rotator` | `redirector` | 预设 | 棋盘拖拽/交换、不可回收、弹球转向、旋转变体、等级速度、渲染 |
| `weapon` | `weapon` | 商店、预设 | 放置、合并、阻挡、尾巴充能、渲染 |
| `slow-zone` | `terrain` | 预设 | 可通过、减速、渲染 |
| `chaos-gate` | `center-effect` | 预设 | 棋盘拖拽/交换、不可回收、到达中心后改向、预测终止、渲染 |
| `black-hole` | `center-effect` | 预设 | 棋盘拖拽/交换、不可回收、到达中心后传送、渲染 |
| `wreckage` | `terrain` | 预设 | 可通过、占格、渲染 |
| `ice-block` | `obstacle` | 预设 | 阻挡、耐久消耗、渲染 |
| `stone` | `obstacle` | 预设 | 阻挡、渲染 |

分类只用于本文档说明；跨模块能力开关集中在 `assets/scripts/shared/entity-registry.ts`。

## 基础字段

所有 Entity 都有：

- `kind`：Entity 类型标识。
- `coord`：棋盘坐标。

扩展字段：

- `turner` / `rotator`：`variant`、`level`。
- `weapon`：`weaponType`、`level`、`facing`、`tailDirections`、`charge`、运行时 `id`。
- `ice-block`：`durability`。

类型定义在 `assets/scripts/shared/types.ts`，方向、转向器变体、武器类型和基础静态映射定义在 `assets/scripts/shared/entity-definitions.ts`。

## 放置规则

统一入口：`assets/scripts/board-placement/BoardPlacementService.ts`。

当前规则：

- 只有内部 5x5 可放置区域接受放置。
- 空格：商店商品或棋盘拖拽源可放置。
- 原格：棋盘拖拽回原格是 no-op。
- 已占格：先交给 `MergeRule` 判断是否可合并。
- 不可合并且目标实体允许棋盘交换时，执行交换。
- `rotator`、`chaos-gate`、`black-hole` 可以从棋盘拖拽和交换，但不能拖到回收区删除。
- 其他情况为 blocked。

可拖拽、可交换、可回收能力由 `entity-registry.ts` 的直接能力字段决定。

## 合并规则

统一入口：`assets/scripts/board-placement/MergeRule.ts`。

当前规则：

- 只有 registry 标记 `canMergeFromPlacement = true` 的 Entity 才进入合并判断。
- `turner`：同变体、同等级可合并，等级 +1。
- `weapon`：同武器类型、同等级可合并，等级 +1，保留目标朝向和充能，合并尾巴方向。
- 其他 Entity 当前不可合并。

## 弹球交互规则

统一入口：`assets/scripts/board-runtime/board-runtime-rules.ts`。

当前规则归属：

- `canEnterEntity()`：进入/阻挡判断。
- `handleBlockedEntityHit()`：阻挡命中副作用，如冰块耐久。
- `resolveCenterInteraction()`：到达中心后的转向、传送、速度等效果。
- `resolveSegmentDurationMultiplier()`：单段移动时长倍率。

registry 不记录“看起来像规则但不参与运行”的弹球交互描述；具体行为只由 runtime rules 实现。

## 武器充能规则

统一入口：`assets/scripts/board-runtime/WeaponChargeSystem.ts`。

当前规则：

- 只有 registry 标记 `canChargeFromTail = true` 的 Entity 进入尾巴触发判断。
- 弹球经过武器尾巴格时充能 +1。
- 达到 `WEAPON_CHARGE_LIMITS[weaponType]` 后归零并生成 `weapon-fired` 事件。

武器充能上限定义在 `entity-definitions.ts`。

## 渲染规则

统一入口：`assets/scripts/board-renderer/BoardEntityVisual.ts`。

当前规则：

- renderer 直接按 `entity.kind` 选择展示分支。
- 图形、文字、颜色和尾巴节点仍由 renderer 负责。
- 商品图标和拖拽预览复用同一套 entity visual。

## 商店规则

统一入口：`assets/scripts/shop/ShopItemFactory.ts`。

当前规则：

- 随机商店池来自 registry 中 `canAppearInRandomShop = true` 的 Entity。
- 当前商店只生成 `turner` 和 `weapon`。
- 商店只生成商品定义和放置规格，不直接读写 runtime 内部状态。

## 当前规则分布问题

本次整理前的主要问题：

- 商店可售卖类型、方向、武器类型曾在 `ShopItemFactory` 本地重复定义。
- 可拖拽/可交换实体曾在 `BoardPlacementService` 和 `BoardDragBridge` 各自硬编码。
- 合并入口在 `MergeRule`，但缺少统一的“该 Entity 是否允许合并”开关。
- registry 曾包含 `category`、`ballInteraction`、`renderKey` 这类描述字段，但它们没有参与真实运行链路，容易被误解为规则来源。
- `createEntityState()` 曾通过映射表和 `spec as never` 绕过 TypeScript 收窄。

现在 `shared/entity-registry.ts` 只保留被实际代码读取的跨模块能力开关。

## 新增 Entity 标准流程

1. 在 `shared/types.ts` 增加新的 `EntitySpec` / `EntityState` 分支。
2. 在 `shared/entity-registry.ts` 增加新 Entity 的实际能力开关；不要加入不参与运行的描述字段。
3. 如需新增静态枚举或映射，放到 `shared/entity-definitions.ts`。
4. 如需运行时状态创建，扩展 `board-runtime/board-runtime-rules.ts` 的 `createEntityState()`。
5. 如需弹球交互，扩展 `canEnterEntity()`、`handleBlockedEntityHit()`、`resolveCenterInteraction()` 或移动时长规则。
6. 如需商店售卖，扩展 `ShopItemDefinition` 和 `shop/ShopItemFactory.ts` 的商品生成/规格转换。
7. 如需合并，扩展 `board-placement/MergeRule.ts`。
8. 如需武器尾巴充能，扩展 `WeaponChargeSystem` 或对应的武器规则函数。
9. 如需视觉展示，扩展 `board-renderer/BoardEntityVisual.ts` 和样式配置。
10. 补充或更新对应测试，至少覆盖 registry 分类、runtime 行为、placement/merge/shop/render 中受影响的链路。

# Codex Task: 拆分 Board Renderer，并抽离 EntityVisual

## 背景

当前 `BoardRenderer.ts` 职责过重，混合了：

- 棋盘根节点和各渲染层创建
- 7×7 grid 渲染
- 外圈 pipe prefab 加载和渲染
- entity layer 全量重建与局部刷新
- weapon tail charge feedback
- ball node 同步、位置更新、旋转
- prediction path Graphics 绘制
- placement highlight
- UI 坐标转 grid 坐标
- shop item icon 渲染
- drag preview 创建

当前 `BoardEntityVisual.ts` 也放在 `board-renderer` 下，但它不只被棋盘使用。商店商品图标、拖拽预览、棋盘实体都需要同一套 entity visual。  
因此这次重构不仅要拆薄 `BoardRenderer`，也要把 `EntityVisual` 从 `board-renderer` 中抽到中性模块。

---

## 总目标

重构后形成更清晰的依赖方向：

```txt
board-renderer   -> entity-visual
shop             -> entity-visual
board-bootstrap  -> board-renderer
board-prediction -> pure prediction logic
board-renderer   -> consumes prediction result and draws path
```

不要让：

```txt
board-renderer -> shop
shop -> board-renderer
entity-visual -> board-renderer
board-prediction -> Cocos Graphics / Node rendering
```

最终希望得到：

```txt
assets/scripts/entity-visual/
  EntityVisual.ts
  entity-visual-constants.ts
  entity-visual-style.ts
  entity-visual-node-utils.ts        # 如有必要

assets/scripts/board-renderer/
  BoardRenderer.ts                   # facade / composition root
  BoardLayerRegistry.ts
  BoardCoordinateMapper.ts
  BoardGridRenderer.ts
  BoardPipeRenderer.ts
  BoardEntityLayerRenderer.ts
  BoardBallRenderer.ts
  BoardPredictionPathRenderer.ts
  BoardPlacementHighlightRenderer.ts
  board-renderer-constants.ts
  board-renderer-node-utils.ts
  board-renderer-style.ts

assets/scripts/shop/
  ShopItemRenderer.ts
  ShopDragPreviewRenderer.ts         # 可选；也可以合并到 ShopItemRenderer
```

如果实际实现中发现更合理的文件名或边界，可以调整。重点不是机械满足目录名，而是让职责和依赖方向变清楚。

---

## 重要设计判断

### 1. EntityVisual 应该独立

`EntityVisual` 的职责是“某个 Entity 长什么样”，不是“棋盘如何渲染”。

它应该负责：

- mount entity body
- mount entity icon sprite
- icon fallback
- weapon tail visual
- weapon tail gear sprite
- level label
- support label
- entity visual 资源加载
- entity visual 尺寸、颜色、资源路径

它不应该负责：

- entity 放在哪个 grid
- entity node 属于哪个 board layer
- entity layer 何时全量重建
- entity layer 何时局部刷新
- board coordinate mapping

拆分后：

```txt
BoardEntityLayerRenderer:
  管理棋盘上的 Entity 节点在哪一层、哪一格、什么时候创建/销毁

EntityVisual:
  管理一个 Entity 节点内部具体长什么样
```

### 2. 商店渲染可以回到 shop 模块

商店商品图标、拖拽预览是 shop presentation，不应该挂在 `BoardRenderer` 上。

更合理的是：

```txt
shop/ShopItemRenderer.ts
  -> entity-visual/EntityVisual.ts
```

如果 `ShopDragController` 需要创建拖拽预览，应优先依赖 shop 侧 renderer，而不是依赖 `BoardRenderer.createDragPreviewNode()`。

可以保留一层兼容代理，逐步减少调用方改动，但最终方向应该是：

```txt
shop -> entity-visual
```

而不是：

```txt
shop -> board-renderer -> entity-visual
```

### 3. PredictionPathRenderer 不建议放进 board-prediction

`board-prediction` 应保持纯逻辑模块，负责计算路径，输出 `PredictionPathResult`。

真正使用 Cocos `Node` / `Graphics` / `Color` 绘制虚线路径的代码，仍然属于 presentation / renderer 层。

推荐：

```txt
assets/scripts/board-renderer/BoardPredictionPathRenderer.ts
```

或者如果项目已有更清晰的 presentation 层，也可以放到：

```txt
assets/scripts/board-presentation/BoardPredictionPathRenderer.ts
```

但不要把 Cocos 绘制代码放进：

```txt
assets/scripts/board-prediction/
```

因为那会污染纯预测逻辑。

---

## 建议重构后的依赖图

```txt
board-bootstrap/BoardBootstrap.ts
  -> board-renderer/BoardRenderer.ts
  -> board-runtime/BoardRuntime.ts
  -> board-bootstrap/BallStepAnimator.ts
  -> board-bootstrap/BoardPresentationRefresher.ts
  -> board-bootstrap/BoardDragBridge.ts

board-renderer/BoardRenderer.ts
  -> BoardLayerRegistry
  -> BoardCoordinateMapper
  -> BoardGridRenderer
  -> BoardPipeRenderer
  -> BoardEntityLayerRenderer
  -> BoardBallRenderer
  -> BoardPredictionPathRenderer
  -> BoardPlacementHighlightRenderer

board-renderer/BoardEntityLayerRenderer.ts
  -> entity-visual/EntityVisual.ts
  -> board-runtime/SupportAuraActivation.ts
  -> shared/helpers.ts
  -> shared/types.ts

shop/ShopItemRenderer.ts
  -> entity-visual/EntityVisual.ts
  -> shop/ShopItemFactory.ts
  -> shared/types.ts

shop/ShopDragPreviewRenderer.ts
  -> entity-visual/EntityVisual.ts
  -> shop/ShopItemFactory.ts
  -> shared/types.ts

entity-visual/EntityVisual.ts
  -> entity-visual/entity-visual-constants.ts
  -> entity-visual/entity-visual-style.ts
  -> shared/types.ts
  -> shared/helpers.ts if needed
```

---

## 期望拆分结果

### `BoardRenderer.ts`

重构后应变成较薄的 facade / composition root。

它可以继续对外提供旧 API，以降低调用方改动：

```ts
initialize(): void

rebuildEntityLayer(entities: EntityState[]): void
updateEntityNode(coord: GridCoord, entity: EntityState | null): void
playWeaponTailChargeFeedback(weaponCoord: GridCoord, tailCoord: GridCoord): void

syncBallNodes(ballStates: BallRenderState[]): void
syncIdleBallNodes(ballStates: BallRenderState[], activeBallIds: ReadonlySet<string>): void
setBallPosition(ballId: string, coord: GridCoord): boolean
rotateBall(ballId: string, rotationDeltaDegrees: number): boolean

clearPredictionPath(): void
renderPredictionPath(prediction: PredictionPathResult): void

resolveGridCoordFromUiPoint(uiPoint: UiPoint): GridCoord | null

showPlacementHighlight(coord: GridCoord, state: PlacementHighlightState): void
clearPlacementHighlight(): void
```

它主要负责：

- 创建子 renderer
- 初始化子 renderer
- 转发外部调用

它不应该继续包含：

- pipe segment 旋转判断
- grid cell 创建细节
- ball spriteFrame 加载细节
- prediction Graphics 绘制细节
- placement highlight Graphics 绘制细节
- entity visual fallback 绘制
- shop item icon 渲染
- drag preview 创建

如果这些还大量留在 `BoardRenderer.ts`，说明只是“搬了一部分”，没有真正拆薄。

---

## 具体模块建议

### 1. `BoardLayerRegistry.ts`

职责：管理棋盘根节点和渲染层。

负责：

- `BoardLayerNode`
- `BoardGridLayer`
- `BoardPipeLayer`
- `BoardEntityLayer`
- `BoardPredictionLayer`
- `BoardDragHighlightLayer`
- `BoardBallLayer`

建议 API：

```ts
export class BoardLayerRegistry {
  constructor(rootNode: Node)

  initialize(): void

  get boardLayerNode(): Node
  get gridLayerNode(): Node
  get pipeLayerNode(): Node
  get entityLayerNode(): Node
  get predictionLayerNode(): Node
  get dragHighlightLayerNode(): Node
  get ballLayerNode(): Node
}
```

注意：

- 只负责节点层级。
- 不负责绘制。
- 不负责资源加载。
- 每个 layer 节点都应该有合适的 `UITransform` 尺寸。

如果初始化顺序容易出错，子 renderer 可以接收 `() => Node` 作为 layer getter，而不是直接在 constructor 里读取尚未 initialize 的节点。

---

### 2. `BoardCoordinateMapper.ts`

职责：棋盘坐标转换。

负责：

- grid coord -> local position
- discrete grid coord position cache
- non-discrete animation coord -> local position
- UI point -> grid coord
- board boundary 判断

建议 API：

```ts
export class BoardCoordinateMapper {
  constructor(getBoardLayerNode: () => Node)

  getCachedGridPosition(coord: GridCoord): Vec3
  resolveGridPosition(coord: GridCoord): Vec3
  resolveGridCoordFromUiPoint(uiPoint: UiPoint): GridCoord | null
}
```

注意：

- 不依赖 runtime。
- 不依赖具体 renderer。
- `resolveGridCoordFromUiPoint()` 需要继续基于 `UITransform.convertToNodeSpaceAR()`。
- 动画中 ball 的 row/col 可能是小数，不能强制只支持整数格。

---

### 3. `BoardGridRenderer.ts`

职责：静态 7×7 grid 渲染。

负责：

- 创建 grid cell node
- 设置 grid cell 位置
- 绘制 grid cell background / stroke

建议 API：

```ts
export class BoardGridRenderer {
  constructor(options: {
    getGridLayerNode: () => Node;
    coordinateMapper: BoardCoordinateMapper;
  })

  render(): void
}
```

注意：

- 如果 grid layer 已经有 children，不要重复创建。
- 不要顺手触发 pipe renderer。
- grid 样式可以继续从 `board-renderer-style.ts` 获取。

---

### 4. `BoardPipeRenderer.ts`

职责：外圈 pipe prefab 加载和渲染。

负责：

- 加载 `prefabs/PipeNode`
- 加载 `prefabs/PipeBend`
- 两个 prefab 都加载完成后渲染 pipe layer
- 根据 `buildPipePath(BOARD_SIZE, DEFAULT_ENTRY)` 生成 pipe path
- 计算 pipe segment 使用直管还是弯管
- 计算 pipe prefab rotation

建议 API：

```ts
export class BoardPipeRenderer {
  constructor(options: {
    getPipeLayerNode: () => Node;
    coordinateMapper: BoardCoordinateMapper;
  })

  render(): void
}
```

注意：

- 不要依赖 `BoardRuntime` 实例。
- pipe path 规则可以继续用现有规则函数。
- pipe segment rotation helper 可以是本文件私有纯函数。
- 不要在 prefab 还没加载完整时清空 pipe layer，避免加载失败后旧画面消失。

---

### 5. `BoardEntityLayerRenderer.ts`

职责：棋盘上的 entity layer 节点管理。

负责：

- 全量重建 entity layer
- 单格 entity 更新
- entity node map
- support aura active light
- weapon tail charge feedback animation

建议 API：

```ts
export class BoardEntityLayerRenderer {
  constructor(options: {
    getEntityLayerNode: () => Node;
    coordinateMapper: BoardCoordinateMapper;
  })

  rebuild(entities: EntityState[]): void
  update(coord: GridCoord, entity: EntityState | null): void
  playWeaponTailChargeFeedback(weaponCoord: GridCoord, tailCoord: GridCoord): void
}
```

注意：

- 它只决定 entity 节点放在哪一格、在哪一层。
- 具体 entity 内部视觉必须交给 `entity-visual/EntityVisual.ts`。
- 不要把 fallback 绘制逻辑搬进来。
- 不要把 icon 资源加载逻辑搬进来。
- `update()` 删除旧节点后，如果 entity 为 null，直接返回。
- `rebuild()` 应该清空 entity layer 和 entity node map。

---

### 6. `BoardBallRenderer.ts`

职责：弹球表现。

负责：

- ball node map
- stale ball node 清理
- 缺失 ball node 创建
- ball spriteFrame 加载
- ball position update
- ball rotation update

建议 API：

```ts
export class BoardBallRenderer {
  constructor(options: {
    getBallLayerNode: () => Node;
    coordinateMapper: BoardCoordinateMapper;
  })

  syncBallNodes(ballStates: BallRenderState[]): void
  syncIdleBallNodes(ballStates: BallRenderState[], activeBallIds: ReadonlySet<string>): void
  setBallPosition(ballId: string, coord: GridCoord): boolean
  rotateBall(ballId: string, rotationDeltaDegrees: number): boolean
}
```

注意：

- 不要每帧重复创建已有 ballId 节点。
- 不要重复启动 spriteFrame 加载。
- `setBallPosition()` 找不到节点时返回 `false`。
- `rotateBall()` 找不到节点时返回 `false`。
- 这里是性能敏感模块，拆分后要重点检查是否引入额外分配或重复查找。

---

### 7. `BoardPredictionPathRenderer.ts`

职责：绘制预测路径。

负责：

- prediction path node
- prediction path graphics
- clear prediction path
- render prediction path

建议 API：

```ts
export class BoardPredictionPathRenderer {
  constructor(options: {
    getPredictionLayerNode: () => Node;
    coordinateMapper: BoardCoordinateMapper;
  })

  clear(): void
  render(prediction: PredictionPathResult): void
}
```

注意：

- 只消费 `PredictionPathResult`。
- 不做路径推演。
- 继续复用 `createDashedPredictionPolylines()`。
- 空路径时隐藏 prediction node。
- 不要把这个 renderer 放进 `board-prediction`，避免 prediction 逻辑模块依赖 Cocos rendering。

---

### 8. `BoardPlacementHighlightRenderer.ts`

职责：拖拽落点高亮。

负责：

- highlight node 懒创建
- show placement highlight
- clear placement highlight

建议 API：

```ts
export class BoardPlacementHighlightRenderer {
  constructor(options: {
    getDragHighlightLayerNode: () => Node;
    coordinateMapper: BoardCoordinateMapper;
  })

  show(coord: GridCoord, state: PlacementHighlightState): void
  clear(): void
}
```

注意：

- `clear()` 隐藏节点即可，不必销毁。
- 继续复用 `getPlacementHighlightPalette()`。
- 只处理表现，不判断是否可放置。是否可放置属于 shop drag / runtime 规则。

---

### 9. `entity-visual/EntityVisual.ts`

职责：中性的 entity visual 挂载。

从现有 `board-renderer/BoardEntityVisual.ts` 迁移并改名。

建议导出：

```ts
export function mountEntityVisual(targetNode: Node, entity: EntitySpec | EntityState): void
```

可以继续保留内部 helper，例如：

- `mountEntityIconVisual`
- `mountEntityIconSprite`
- `mountEntityIconFallback`
- `loadEntityIconSpriteFrame`
- `flushPendingEntityIconHosts`
- `mountWeaponTailVisual`
- `mountWeaponTailSprite`
- `mountWeaponTailGearSprite`
- `mountWeaponTailFallback`
- `toRenderableEntity`

但这些 helper 不一定需要导出。

### EntityVisual 常量迁移

现有 `BoardEntityVisual.ts` 依赖很多 board-renderer constants。迁出时不要让它继续反向依赖：

```txt
entity-visual/EntityVisual.ts
  -> ../board-renderer/board-renderer-constants.ts
```

这是假分离。

建议把 entity visual 专属常量迁到：

```txt
assets/scripts/entity-visual/entity-visual-constants.ts
```

可迁移内容包括：

- `ENTITY_BODY_SIZE`
- `ENTITY_HALF_BODY`
- `ENTITY_CORNER_RADIUS`
- `ENTITY_LARGE_CORNER_RADIUS`
- `WEAPON_BODY_SIZE`
- `WEAPON_HALF_BODY`
- `WEAPON_TAIL_RADIUS`
- `WEAPON_TAIL_SIZE`
- `WEAPON_TAIL_IMAGE_WIDTH`
- `WEAPON_TAIL_IMAGE_HEIGHT`
- `WEAPON_TAIL_GEAR_CENTER_OFFSET_Y`
- `WEAPON_TAIL_GEAR_IMAGE_SIZE`
- `WEAPON_TAIL_GEAR_RAW_SIZE`
- `WEAPON_TAIL_SPRITE_FRAME_PATH`
- `LEVEL_COLORS`

如果这些常量确实和 `CELL_SIZE` 强绑定，可以有两种处理方式：

方案 A：在 `entity-visual-constants.ts` 中继续 import 中性的 board size 常量，例如 `CELL_SIZE`。  
方案 B：把更基础的 `CELL_SIZE`、`BOARD_CELLS`、`BOARD_SIZE_PX` 抽到更中性的 board config 文件，例如：

```txt
assets/scripts/board-shared/board-layout-constants.ts
```

不要为了完美架构过度扩散。只要避免 `entity-visual` 直接依赖 `board-renderer` 即可。

### EntityVisual style 迁移

如果 `EntityVisual` 依赖这些样式函数：

- `formatSupportName`
- `getTurnerGlyphPath`
- entity fallback colors
- weapon/support display name

可以把它们迁到：

```txt
assets/scripts/entity-visual/entity-visual-style.ts
```

如果某些函数确实只服务 grid / placement highlight，则继续留在 `board-renderer-style.ts`。

判断标准：

```txt
用于画 Entity 自身      -> entity-visual-style.ts
用于画 Board grid/highlight -> board-renderer-style.ts
```

---

### 10. `shop/ShopItemRenderer.ts`

职责：商店商品图标渲染。

建议 API：

```ts
export class ShopItemRenderer {
  static renderItemIcon(targetNode: Node, item: ShopItemDefinition | null): void
}
```

内部可以：

- `targetNode.destroyAllChildren()`
- item 为 null 时直接返回
- 创建 `ShopItemIcon`
- 设置 scale
- 使用 `createShopPlacementSpec(item, { row: 0, col: 0 })`
- 调用 `mountEntityVisual()`

注意：

- 放在 `shop` 模块。
- 可以依赖 `ShopItemFactory.ts`。
- 可以依赖 `entity-visual/EntityVisual.ts`。
- 不要依赖 `BoardRenderer`。

---

### 11. `shop/ShopDragPreviewRenderer.ts`

职责：创建拖拽预览节点。

建议 API：

```ts
export class ShopDragPreviewRenderer {
  static createPreviewNode(parentNode: Node, item: BoardDragItemDefinition): Node
}
```

内部可以：

- 创建 preview node
- 设置 parent
- 根据 item 类型生成 preview entity spec
- 调用 `mountEntityVisual()`

如果觉得文件太碎，也可以把它合并进 `ShopItemRenderer.ts`：

```ts
ShopItemRenderer.renderItemIcon(...)
ShopItemRenderer.createDragPreviewNode(...)
```

重点是：这部分应归 shop，而不是 board-renderer。

---

## 需要同步调整的调用方

### `BoardRenderer.ts`

- 移除 shop icon / drag preview 的真实实现。
- 如果暂时为了兼容保留 static 方法，可以内部转发到 shop renderer。
- 更好的方向是逐步让 shop 调用方直接使用 `ShopItemRenderer` / `ShopDragPreviewRenderer`。

### `BoardDragBridge.ts`

当前如果通过 `BoardRenderer.createDragPreviewNode()` 创建拖拽预览，可以改成：

```ts
ShopDragPreviewRenderer.createPreviewNode(this.rootNode, item)
```

或者通过 shop host 注入：

```ts
createDragPreview: (item) => ShopDragPreviewRenderer.createPreviewNode(this.rootNode, item)
```

### 商店 UI 相关文件

如果当前调用：

```ts
BoardRenderer.renderShopItemIcon(...)
```

改成：

```ts
ShopItemRenderer.renderItemIcon(...)
```

### `BoardEntityLayerRenderer.ts`

使用：

```ts
import { mountEntityVisual } from '../entity-visual/EntityVisual.ts';
```

而不是：

```ts
import { mountEntityVisual } from './BoardEntityVisual.ts';
```

---

## 可以顺手改善的坏设计

这次不是机械搬文件。如果发现明显坏设计，可以一起修。

可以修：

- 初始化顺序不稳：constructor 里访问还未 initialize 的 layer。
- `BoardRenderer` 里仍残留大量 helper，导致 facade 只是名义 facade。
- `board-renderer` 依赖 `shop`。
- `shop` 依赖 `board-renderer`。
- `entity-visual` 依赖 `board-renderer`。
- grid 渲染和 pipe 渲染混在一个方法里。
- prediction 模块依赖 Cocos Node / Graphics。
- 资源加载状态散落导致重复 load。
- 命名和职责不一致，例如 `renderStaticGrid()` 同时加载 pipe。
- 子 renderer 做了 runtime 规则判断。

不要为了“保持最小 diff”保留明显错误的依赖方向。

---

## 不建议做的事

除非发现必须修，否则不要做：

- 不要重写 `BoardRuntime`。
- 不要改变实体合并、放置、金币、回收规则。
- 不要重做美术资源路径。
- 不要重做 Cocos prefab / scene。
- 不要引入抽象 renderer 基类。
- 不要引入事件总线。
- 不要引入全局 singleton。
- 不要把 prediction renderer 放进 `board-prediction`。
- 不要让 `entity-visual` 反向依赖 `board-renderer`。
- 不要删除 `assets/scripts/BoardRenderer.ts` 兼容导出。

---

## 重构完成后的检查目标

### 结构检查

完成后应满足：

```txt
BoardRenderer.ts 明显变薄
BoardRenderer.ts 主要负责组合和转发
BoardEntityVisual.ts 不再留在 board-renderer 内，或至少已改名迁移到 entity-visual
shop icon rendering 不再由 BoardRenderer 真实实现
drag preview rendering 不再由 BoardRenderer 真实实现
prediction path drawing 不污染 board-prediction
```

### 依赖检查

不应该出现：

```txt
entity-visual -> board-renderer
board-renderer -> shop
board-prediction -> cc Graphics / Node
```

可以接受：

```txt
board-renderer -> entity-visual
shop -> entity-visual
shop -> shared
board-renderer -> board-prediction render utils / prediction result types
```

### 行为检查

重构后检查：

- 棋盘初始化后 7×7 grid 正常显示。
- 外圈 pipe prefab 正常加载。
- 弹球能创建、移动、旋转。
- 多弹球不会重复创建相同节点。
- 删除弹球后旧 ball node 会清理。
- entity layer 全量刷新正常。
- 单格 entity 更新正常。
- weapon tail charge feedback 正常。
- support aura active light 正常。
- prediction path 显示、隐藏、清空正常。
- placement highlight 显示和清理正常。
- UI point 转 grid coord 正常。
- shop item icon 正常。
- drag preview 正常创建、跟随、销毁。
- Cocos 场景内原有交互不退化。

### 测试检查

执行现有测试：

```bash
npm test
```

如果测试覆盖不足，以 TypeScript 编译和 Cocos 场景手测为准，但不要忽略明显类型错误。

---

## 推荐实现顺序

虽然最后可以作为一次重构完成，但实现时建议按这个顺序做，降低出错概率：

1. 先抽 `entity-visual`，解决 `BoardEntityVisual.ts` 的中性化问题。
2. 把 shop item icon / drag preview 移到 `shop` 模块。
3. 抽 `BoardLayerRegistry`。
4. 抽 `BoardCoordinateMapper`。
5. 抽 `BoardGridRenderer`。
6. 抽 `BoardPipeRenderer`。
7. 抽 `BoardBallRenderer`。
8. 抽 `BoardEntityLayerRenderer`。
9. 抽 `BoardPredictionPathRenderer`。
10. 抽 `BoardPlacementHighlightRenderer`。
11. 回头清理 `BoardRenderer.ts`，让它只保留组合和转发。
12. 清理 import、命名、遗留兼容代理。

---

## 最终判断标准

这次重构不是为了“文件更多”，而是为了让每个模块的问题边界更清楚：

```txt
BoardRenderer:
  棋盘表现层总入口

BoardLayerRegistry:
  棋盘层级

BoardCoordinateMapper:
  坐标转换

BoardGridRenderer:
  静态 grid

BoardPipeRenderer:
  外圈 pipe

BoardEntityLayerRenderer:
  棋盘 entity 节点层

BoardBallRenderer:
  弹球表现

BoardPredictionPathRenderer:
  预测路径表现

BoardPlacementHighlightRenderer:
  放置高亮表现

EntityVisual:
  单个 Entity 长什么样

ShopItemRenderer:
  商店商品图标

ShopDragPreviewRenderer:
  商店拖拽预览
```

如果某个模块的名字和职责不一致，优先改名或继续拆分。  
如果为了拆分引入了更差的依赖方向，宁可少拆一点，也不要制造假解耦。

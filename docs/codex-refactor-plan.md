# Codex 修改任务：棋盘弹球项目设计缺陷、性能问题与可读性优化

仓库：`mahavira/reboundball-cocos-board`  
技术栈：Cocos Creator 3.8.8 + TypeScript  
目标：修复当前棋盘弹球项目中的明确设计缺陷、性能问题和可维护性风险。  
要求：优先做最小、安全、可测试的修改，不要大规模重写，不要改变现有玩法表现，除非本文件明确要求。

---

## 总体原则

1. **不要重构到失控**
   - 每次修改应有明确目标。
   - 不要为了“架构更优雅”而改动大量无关文件。
   - 优先修复确定性 bug，再做性能优化，最后做结构拆分。

2. **运行时规则和渲染表现必须分离**
   - `board-runtime` 只处理规则和状态。
   - `board-renderer` 只处理节点、Sprite、Graphics、动画表现。
   - 不要让 UI 或 Renderer 直接改 Runtime 内部数据。

3. **预测路径必须和真实运行逻辑一致**
   - 如果预测用于玩家决策，它必须模拟真实弹球路径。
   - 预测可以不写回真实 runtime，但内部模拟必须包含必要副作用。

4. **每个修复都要尽量补测试**
   - 优先使用已有 `node:test` 风格。
   - 对纯规则逻辑优先写单元测试。
   - 对 Cocos 节点逻辑可用 stub/mock 测试，不要依赖真实编辑器场景。

---

# P0：必须先修

## 1. `speedMultiplier` 语义错误：当前实际保存的是 duration multiplier

### 涉及文件

- `assets/scripts/shared/types.ts`
- `assets/scripts/board-runtime/board-runtime-rules.ts`
- `assets/scripts/board-runtime/BallStepper.ts`
- `assets/scripts/board-runtime/BoardRuntime.ts`
- `assets/scripts/board-prediction/BoardPathPredictor.ts`
- 相关测试文件

### 当前问题

`LEVEL_SPEED_MULTIPLIERS` 表示速度倍率：

```ts
1: 1.5,
2: 2.5,
3: 3.5,
4: 4.5,
5: 6,
```

但当前逻辑把它转成了 `1 / speedMultiplier` 后写进 `ball.speedMultiplier`。  
这会导致字段名和真实含义相反。后续做数值、调试 UI、预测、动画时都会被误导。

### 修改方向

保留 `speedMultiplier` 作为“真实速度倍率”。  
动画时长计算时再把速度倍率转换成 duration multiplier。

### 具体要求

1. `BallState.speedMultiplier` 和 `BallRenderState.speedMultiplier` 必须表示真实速度倍率。
2. `resolveCenterInteraction()` 返回的 `speedMultiplier` 应该直接是 `LEVEL_SPEED_MULTIPLIERS[level]`，不要取倒数。
3. `getSegmentDurationMs()` 内部负责换算速度对时长的影响。

建议将概念拆清楚：

- `speedMultiplier`：球的真实速度倍率，数值越大越快。
- `segmentDurationMultiplier` / `terrainDurationMultiplier`：地形或格子带来的时长倍率，数值越大越慢。
- `fastFactor`：快速球的额外时长缩放。

示例方向：

```ts
return (baseStepMs / 2) * segmentDurationMultiplier * fastFactor / ball.speedMultiplier;
```

4. `slow-zone` 这种减速区不要伪装成 `speedMultiplier`，应使用独立的 duration/terrain multiplier 语义。
5. 命名必须清楚，避免同时出现含义相反的 multiplier。

### 推荐命名

```ts
type SegmentDurationInput = {
  ball: BallState;
  terrainDurationMultiplier: number;
};
```

或：

```ts
getSegmentDurationMs(baseStepMs, ballSpeedMultiplier, segmentDurationMultiplier, isFast)
```

### 验收标准

- 通过转向器等级 5 后，`ball.speedMultiplier` 应为 `6`，而不是 `1 / 6`。
- 动画表现仍是等级越高移动越快。
- 减速区仍然能减慢移动。
- 测试覆盖：
  - turner level 1/5 的速度倍率。
  - slow-zone 的减速效果。
  - black-hole 重置速度倍率为 `1`。

---

# P1：高优先级

## 2. 预测路径必须模拟 `rotator` 副作用

### 涉及文件

- `assets/scripts/board-prediction/BoardPathPredictor.ts`
- `assets/scripts/board-runtime/BallStepper.ts`
- `assets/scripts/board-runtime/board-runtime-rules.ts`
- 相关测试文件

### 当前问题

真实 runtime 中，弹球经过 `rotator` 后会旋转当前 rotator：

```ts
currentEntity.variant = rotateVariantClockwise(currentEntity.variant);
```

但 `BoardPathPredictor` 只做静态预测，没有模拟 rotator 旋转。  
如果预测路径经过 rotator，预测结果可能和真实弹球路径不一致。

### 修改要求

1. `BoardPathPredictor` 内部可以继续使用自己的 `entityMap`，不要写回真实 runtime。
2. 预测过程中必须模拟 `rotator` 的旋转副作用。
3. 副作用只影响预测器内部快照。
4. 保留注释说明：预测不会影响真实 runtime，但会模拟必要规则副作用。

### 建议实现

在预测一步移动后，根据真实 runtime 的规则，在合适时机调用：

```ts
if (currentEntity?.kind === 'rotator') {
  currentEntity.variant = rotateVariantClockwise(currentEntity.variant);
}
```

注意要和 `BallStepper` 的触发时机保持一致：真实逻辑是在从当前格移动到目标格之后旋转当前 rotator。

### 验收标准

- 新增测试：构造一个路径会经过 rotator 的布局。
- 预测路径应与真实 `BallStepper` 连续执行结果一致。
- 预测不修改真实 runtime 的实体状态。

---

## 3. 武器尾巴充能不应重建整个实体节点

### 涉及文件

- `assets/scripts/board-runtime/BoardRuntimeEvents.ts`
- `assets/scripts/board-runtime/WeaponChargeSystem.ts`
- `assets/scripts/board-bootstrap/BoardPresentationRefresher.ts`
- `assets/scripts/board-renderer/BoardRenderer.ts`
- `assets/scripts/board-renderer/BoardEntityVisual.ts`

### 当前问题

武器尾巴充能时：

1. `WeaponChargeSystem.handleTailCharge()` 调用 `emitWeaponTailCharge()`
2. `emitWeaponTailCharge()` 发出 `state-changed`，并把 `weaponCoord` 放进 `changedCoords`
3. `BoardPresentationRefresher` 收到后调用 `updateEntityNode()`
4. `BoardRenderer.updateEntityNode()` 会 destroy 旧节点并重建实体节点
5. 然后再播放尾巴反馈动画

这是高频路径，不应该重建节点。

### 修改要求

把“状态变更”和“纯视觉反馈”分离。

### 推荐事件拆分

可以扩展事件类型，例如：

```ts
export type BoardEntityChangeEvent = {
  kind: BoardEntityChangeKind;
  changedCoords: GridCoord[];
  requiresPredictionRefresh: boolean;
  tailFeedbacks?: WeaponTailFeedback[];
  visualOnly?: boolean;
};
```

然后 `emitWeaponTailCharge()` 设置：

```ts
visualOnly: true,
changedCoords: [],
requiresPredictionRefresh: false,
tailFeedbacks: [...]
```

`BoardPresentationRefresher.handleEntityChange()` 中：

- `visualOnly` 不触发实体刷新。
- 只收集 `tailFeedbacks`。
- 如果以后需要显示 charge UI，单独做 `updateEntityChargeVisual()`，不要重建整个节点。

### 验收标准

- 弹球经过武器尾巴时不会调用 `BoardRenderer.updateEntityNode()`。
- 仍然播放尾巴反馈动画。
- 武器充能和开火逻辑不变。
- 测试覆盖：尾巴充能事件只触发反馈，不触发实体重建。

---

## 4. 资源加载失败后必须允许重试，并清理 pending 引用

### 涉及文件

- `assets/scripts/board-renderer/BoardEntityVisual.ts`
- `assets/scripts/board-renderer/BoardRenderer.ts`

### 当前问题

实体图标加载失败时：

```ts
loadingEntityIconKeys.add(iconKey);
resources.load(..., (error) => {
  if (error) {
    console.warn(...)
    return;
  }
})
```

失败后 `loadingEntityIconKeys` 不会移除。  
同类问题存在于武器尾巴加载：

```ts
isWeaponTailSpriteFrameLoadStarted = true;
```

失败后不会重置。

### 修改要求

1. 实体图标加载失败：
   - `loadingEntityIconKeys.delete(iconKey)`
   - 清理或标记 `pendingEntityIconHosts`
   - 不要永久锁死加载状态

2. 武器尾巴加载失败：
   - `isWeaponTailSpriteFrameLoadStarted = false`
   - 清理无效 pending host
   - 下次 mount 时允许重新加载

3. 可选：封装一个轻量资源加载缓存模块，统一处理：
   - loading
   - loaded
   - failed
   - pending hosts
   - retry

### 验收标准

- 模拟资源加载失败后，下一次调用仍可重试。
- pending host 不长期持有已销毁节点。
- 不改变成功加载时的视觉表现。

---

# P2：中优先级

## 5. `buildPipePath()` 不应硬编码 7×7 和入口位置

### 涉及文件

- `assets/scripts/board-runtime/board-runtime-rules.ts`
- `assets/scripts/board-runtime/constants.ts`
- `assets/scripts/board-runtime/BoardRuntime.ts`
- `assets/scripts/board-prediction/BoardPathPredictor.ts`
- `assets/scripts/board-renderer/BoardRenderer.ts`

### 当前问题

`buildPipePath()` 内部写死：

```ts
for (let row = 3; row <= 6; row += 1) ...
for (let col = 1; col <= 6; col += 1) ...
...
```

这只适用于当前 7×7、入口 `{ row: 3, col: 0 }` 的场景。

### 修改要求

改成参数化：

```ts
buildPipePath(boardSize: number, entryCoord: GridCoord): GridCoord[]
```

要求：

1. 使用 `BOARD_SIZE` 和 `DEFAULT_ENTRY` 调用。
2. 不要在路径构造里散落 `3 / 6 / 5 / 0` 这类魔法数字。
3. 保持当前路径结果不变。
4. 加测试确保新实现生成的路径和旧路径等价。

### 验收标准

- 当前 7×7 棋盘路径不变。
- `BoardRuntime` 和 `BoardPathPredictor` 使用同一套路径构建逻辑。
- 后续改棋盘大小时不会到处改数字。

---

## 6. 拆分 `BoardRenderer`，避免继续膨胀

### 涉及文件

- `assets/scripts/board-renderer/BoardRenderer.ts`
- 可新增 `assets/scripts/board-renderer/*`

### 当前问题

`BoardRenderer` 同时负责：

- root/layer 创建
- 静态网格绘制
- pipe prefab 加载与渲染
- 实体节点创建与更新
- 弹球节点同步
- 预测路径绘制
- 拖拽高亮
- 商店图标渲染
- 拖拽预览节点创建

这会继续变成 God Object。

### 修改要求

不要一次性大拆。按低风险顺序拆：

#### 第一步：抽出纯渲染子模块

建议新增：

```txt
assets/scripts/board-renderer/BoardLayerManager.ts
assets/scripts/board-renderer/GridRenderer.ts
assets/scripts/board-renderer/PipeRenderer.ts
assets/scripts/board-renderer/BallRenderer.ts
assets/scripts/board-renderer/PredictionPathRenderer.ts
assets/scripts/board-renderer/PlacementHighlightRenderer.ts
```

`BoardRenderer` 暂时保留对外 API，只做 facade。

#### 第二步：把静态方法移走

把这些从 `BoardRenderer` 移出：

```ts
BoardRenderer.renderShopItemIcon(...)
BoardRenderer.createDragPreviewNode(...)
BoardRenderer.mountEntityVisual(...)
```

建议放到：

```txt
assets/scripts/board-renderer/EntityVisualFactory.ts
```

### 验收标准

- 外部调用方尽量不改或少改。
- `BoardRenderer.ts` 行数明显下降。
- 行为不变。
- 原有测试通过。

---

## 7. `BoardDebugController` 注释和实现不一致

### 涉及文件

- `assets/scripts/board-debug/BoardDebugController.ts`

### 当前问题

注释说调试组件“独立挂载在场景中，自行查找主棋盘组件”，但实现是：

```ts
const boardBootstrap = this.node.getComponent(BoardBootstrap);
```

这只会在同一节点查找。

### 修改要求

二选一：

#### 方案 A：改实现

让它真的能从场景中找：

```ts
const boardBootstrap =
  this.node.getComponent(BoardBootstrap)
  ?? this.node.scene?.getComponentInChildren(BoardBootstrap);
```

如果 Cocos API 不支持 `getComponentInChildren`，就自己递归查找。

#### 方案 B：改注释和绑定方式

使用 `@property(BoardBootstrap)` 显式绑定。

### 推荐方案

使用 `@property(BoardBootstrap)` 显式绑定。  
调试模块不应偷偷扫描场景，避免多个棋盘时绑定错对象。

### 验收标准

- 注释和实现一致。
- 缺少 BoardBootstrap 时有明确报错或明确降级。
- 不要静默失败。

---

# 建议测试清单

Codex 修改后至少补这些测试：

## Speed

- turner level 1 设置真实 `speedMultiplier = 1.5`。
- turner level 5 设置真实 `speedMultiplier = 6`。
- black-hole 重置 `speedMultiplier = 1`。
- slow-zone 只影响 duration，不污染 `speedMultiplier` 语义。

## Prediction

- 预测路径经过 rotator 时，内部模拟 rotator 旋转。
- 预测不修改真实 runtime 实体。
- 同一布局下，预测前几步路径与真实 runtime 前几步一致。

## Weapon tail feedback

- 经过武器尾巴时会产生 charge。
- 达到 charge limit 时产生 `weapon-fired`。
- 经过尾巴只触发视觉反馈，不触发实体节点重建。
- 多个武器尾巴指向同一格时，所有可充能武器都被处理。

## Resource loading

- 实体 icon 加载失败后允许下次重试。
- weapon-tail 加载失败后允许下次重试。
- pending host 中无效节点不会被长期保留。

## Pipe path

- 参数化后的 `buildPipePath(BOARD_SIZE, DEFAULT_ENTRY)` 与当前路径行为一致。
- `BoardRuntime`、`BoardPathPredictor`、`BoardRenderer` 仍使用同一套外环路径。

---

# 推荐提交顺序

不要一次性提交全部修改。按下面顺序拆：

## Commit 1

标题：

```txt
fix(runtime): clarify speed multiplier semantics
```

内容：

- 修正 `speedMultiplier` 语义
- 调整 duration 计算
- 补速度相关测试

## Commit 2

标题：

```txt
fix(prediction): simulate rotator side effects
```

内容：

- 预测器内部模拟 rotator 旋转
- 补预测一致性测试

## Commit 3

标题：

```txt
perf(renderer): avoid entity rebuild for weapon tail feedback
```

内容：

- 事件拆分或新增 `visualOnly`
- 尾巴反馈不再触发实体重建
- 补刷新器测试

## Commit 4

标题：

```txt
fix(renderer): allow sprite load retry after failure
```

内容：

- 修复资源加载失败状态
- 清理 pending host
- 补测试或最小验证

## Commit 5

标题：

```txt
refactor(runtime): parameterize pipe path construction
```

内容：

- `buildPipePath()` 参数化
- 保持当前 7×7 行为不变
- 补路径等价测试

## Commit 6

标题：

```txt
refactor(renderer): split board renderer collaborators
```

内容：

- 小步拆 `BoardRenderer`
- 保持对外 API 不变
- 不夹带业务规则修改

## Commit 7

标题：

```txt
fix(debug): align BoardDebugController lookup behavior
```

内容：

- 修正调试组件绑定方式或注释
- 避免静默失败

---

# 禁止事项

Codex 不要做以下事情：

1. 不要修改 `presetEntityData.ts`，除非当前任务另行明确要求。
2. 不要处理重复坐标问题，本轮暂时不做。
3. 不要做 P3 工程质量相关工作，例如新增 `typecheck/check/lint` 脚本。
4. 不要重写整个 runtime。
5. 不要把 Cocos 节点逻辑塞进 runtime。
6. 不要改变实体种类、商店规则、棋盘大小。
7. 不要删除现有测试。
8. 不要把所有问题塞进一个巨大 commit。
9. 不要用“修复性能”为理由提前做对象池大改。
10. 不要引入大型依赖。
11. 不要改资源图片、prefab、scene，除非测试或编译必须。

---

# 最终验收

完成后至少满足：

```bash
npm test
```

通过。

并手动确认：

1. 默认场景能启动。
2. 弹球能从入口进入棋盘。
3. 转向器和旋转器行为正常。
4. 预测路径和真实路径一致性提升。
5. 商店拖拽、合并、交换、回收不回归。
6. 武器尾巴充能有反馈，但不会频繁重建实体节点。
7. 控制台没有资源加载死锁类错误。

# board-runtime

棋盘规则运行时。这里不依赖 Cocos 节点、Prefab、UI、颜色、拖拽输入或商店展示。

## 文件职责

| 文件 | 职责 |
|---|---|
| `BoardRuntime.ts` | 对外 API 和模块调度 |
| `BallStepper.ts` | 单颗弹球的一步结算 |
| `BallMotionBuilder.ts` | 动画段和进度事件 |
| `WeaponChargeSystem.ts` | 武器尾巴充能和开火事件 |
| `EntityStore.ts` | 实体读写和快照 |
| `EntityMutations.ts` | 放置、删除、旋转、升级实体 |
| `BoardRuntimeEvents.ts` | 实体变化事件分发 |
| `board-runtime-rules.ts` | 弹球、实体、外环、速度、武器尾巴等纯规则函数 |
| `createBoardPreset.ts` | 默认棋盘预设创建 |
| `constants.ts` | 棋盘常量 |
| `index.ts` | 统一导出入口 |

## 边界约束

- Runtime 只处理规则、状态、step 结算、实体变更、武器充能和事件。
- Runtime 可以读取 `shared/` 的类型、坐标工具和预设数据。
- Runtime 不读取 `shop/`、`board-renderer/`、`board-bootstrap/`、`board-debug/`。
- 放置协调和合并提交由 `board-placement/` 发起，最终通过 `BoardRuntime.placeEntity/removeEntity` 落到运行时。

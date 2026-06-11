# board-bootstrap

场景装配层。这里可以依赖 runtime、renderer、shop、prediction、debug host 契约，但不承载具体规则和视觉绘制细节。

## 文件职责

| 文件 | 职责 |
|---|---|
| `BoardBootstrap.ts` | Cocos 组件入口，装配 runtime / renderer / animator / refresher / drag bridge，并输出 shop/debug host |
| `BallStepAnimator.ts` | 播放弹球 step 动画，派发进度事件 |
| `BoardPresentationRefresher.ts` | 实体层、预测路径、空闲弹球节点刷新 |
| `BoardDragBridge.ts` | 棋盘实体拖拽、ShopDragController host 适配 |
| `board-bootstrap-step-driver.ts` | 弹球 step 动画上下文与进度事件计算 |
| `index.ts` | 当前目录统一导出入口 |

## 边界约束

- `BoardBootstrap.ts` 只做装配和顶层 host 适配，不再放 step 动画推进、预测路径构建、拖拽事件细节。
- `BallStepAnimator.ts` 只处理弹球 step 播放，不负责实体刷新、拖拽、预测路径。
- `BoardPresentationRefresher.ts` 只处理展示刷新，不读取触摸事件，不推进 runtime step。
- `BoardDragBridge.ts` 只处理棋盘拖拽和 host 适配，不直接参与弹球动画与预测逻辑。
- 如果某段逻辑同时需要“动画推进 + 展示刷新 + 拖拽”，优先拆成协作者协作，不要重新塞回 `BoardBootstrap.ts`。

# board-renderer

棋盘视觉渲染层。这里负责棋盘 Cocos 节点、坐标换算、棋盘实体层、弹球显示、预测路径和拖拽高亮，不处理 runtime 规则。

| 文件 | 职责 |
|---|---|
| `BoardRenderer.ts` | facade / composition root，对外保留棋盘渲染 API |
| `BoardLayerRegistry.ts` | 棋盘根节点和渲染层级 |
| `BoardCoordinateMapper.ts` | grid / local / UI 坐标换算 |
| `BoardGridRenderer.ts` | 静态棋盘格绘制 |
| `BoardPipeRenderer.ts` | 外圈 pipe prefab 加载和绘制 |
| `BoardEntityLayerRenderer.ts` | 棋盘上 entity 节点创建、销毁和尾巴反馈 |
| `BoardBallRenderer.ts` | 弹球节点集合、图片和位置/旋转同步 |
| `BoardPredictionPathRenderer.ts` | 预测路径 Graphics 绘制 |
| `BoardPlacementHighlightRenderer.ts` | 拖拽落点高亮 |
| `BoardEntityVisual.ts` | 旧路径兼容转发，实际实现位于 `../entity-visual/EntityVisual.ts` |
| `board-renderer-constants.ts` | 棋盘尺寸、弹球资源、状态类型 |
| `board-renderer-node-utils.ts` | 节点创建、UITransform 尺寸、坐标换算、颜色转换 |
| `board-renderer-style.ts` | 棋盘格和高亮配色；实体样式从 `entity-visual` 兼容转发 |

## 边界约束

- `BoardRenderer.ts` 只组装子 renderer 并转发外部调用，不承载具体绘制细节。
- Entity 具体图形、文字、图标、武器尾巴统一放在 `entity-visual`，棋盘实体层只决定放在哪一格。
- `board-renderer-constants.ts` 只放表现层常量；不要把运行时规则、配置语义塞进来。
- `board-renderer-node-utils.ts` 只放通用节点/坐标工具；不要混入业务分支判断。
- 预测路径的几何辅助函数放在 `board-prediction/board-prediction-render-utils.ts`，renderer 只消费输出。
- 外部如果需要新渲染能力，优先判断应该落在“主流程 / 实体视觉 / 工具 / 常量”哪一层，避免再次把 `BoardRenderer.ts` 做回大杂烩。

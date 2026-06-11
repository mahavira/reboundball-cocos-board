# board-renderer

棋盘视觉渲染层。这里负责 Cocos 节点、坐标换算、实体显示、弹球显示和拖拽高亮，不处理 runtime 规则。

| 文件 | 职责 |
|---|---|
| `BoardRenderer.ts` | 棋盘渲染主流程：节点层级、格子、弹球、预测路径、拖拽高亮 |
| `BoardEntityVisual.ts` | Entity 的具体图形绘制、文字、武器尾巴 |
| `board-renderer-constants.ts` | 棋盘尺寸、实体尺寸、颜色、状态类型 |
| `board-renderer-node-utils.ts` | 节点创建、UITransform 尺寸、坐标换算、颜色转换 |
| `board-renderer-style.ts` | 棋盘、实体、文字和高亮配色/样式 |

## 边界约束

- `BoardRenderer.ts` 只保留渲染主流程和节点层级管理，不再回收 Entity 具体绘图细节。
- `BoardEntityVisual.ts` 只处理实体视觉，不读取 runtime，不负责弹球动画、预测路径、触摸逻辑。
- `board-renderer-constants.ts` 只放表现层常量；不要把运行时规则、配置语义塞进来。
- `board-renderer-node-utils.ts` 只放通用节点/坐标工具；不要混入业务分支判断。
- 预测路径的几何辅助函数放在 `board-prediction/board-prediction-render-utils.ts`，renderer 只消费输出。
- 外部如果需要新渲染能力，优先判断应该落在“主流程 / 实体视觉 / 工具 / 常量”哪一层，避免再次把 `BoardRenderer.ts` 做回大杂烩。

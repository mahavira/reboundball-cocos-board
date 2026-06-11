# board-prediction

路径预测模块。这里读取 runtime 快照并生成可展示的预测结果，预测过程不写回 runtime 状态。

| 文件 | 职责 |
|---|---|
| `BoardPathPredictor.ts` | 基于入口和实体快照模拟共享球路径 |
| `board-prediction-render-utils.ts` | 预测轨迹显示所需的虚线和圆角折线几何辅助 |

## 边界约束

- 预测规则复用 `board-runtime/board-runtime-rules.ts` 的纯规则函数。
- 预测模块不依赖 Cocos 节点，不创建视觉节点。
- renderer 只消费预测结果和渲染几何辅助，不参与预测状态推演。

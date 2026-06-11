# board-placement

棋盘放置协调层。这里连接 shop/棋盘拖拽输入与 runtime 提交，但不直接处理 Cocos 节点表现。

| 文件 | 职责 |
|---|---|
| `BoardPlacementService.ts` | 落点判断、移动/交换/合并解析、放置提交和结果返回 |
| `MergeRule.ts` | 同类同级实体合并预判与合并后 `EntitySpec` 构建 |

## 边界约束

- 可以读取 `shop/ShopItemFactory.ts` 把商品或已放置实体转为 runtime 可接受的 `EntitySpec`。
- 可以通过 `BoardShopHost` 调用 runtime/renderer 暴露的最小能力。
- 不直接依赖 `BoardRuntime`、`BoardRenderer` 或 Cocos 节点。

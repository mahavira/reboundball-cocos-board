# shop

商店展示与拖拽入口。这里负责商品列表、槽位 UI、拖拽生命周期和商品定义生成，不把商店 UI 状态塞进 runtime。

| 文件 | 职责 |
|---|---|
| `ShopLayer.ts` | Cocos 商店组件，绑定槽位、按钮和商品刷新 |
| `ShopDragController.ts` | 一次拖拽的开始、移动、结束、预览和清理 |
| `ShopItemFactory.ts` | 商店商品生成，以及商品/棋盘实体到 `EntitySpec` 的转换 |

## 边界约束

- `ShopLayer` 通过 `BoardBootstrap.getShopHost()` 获取最小 host 契约。
- `ShopDragController` 把放置规则委托给 `board-placement/BoardPlacementService.ts`。
- 商店模块不直接读取或修改 runtime 内部状态。

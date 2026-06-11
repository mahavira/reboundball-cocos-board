# shared

跨层共享的类型、坐标工具和静态预设数据。这里不放具体 runtime 规则、renderer 节点逻辑、商店 UI 或调试入口。

| 文件 | 职责 |
|---|---|
| `entity-definitions.ts` | 方向、转向器变体、武器类型和运行时静态映射定义 |
| `entity-registry.ts` | Entity 分类、跨模块能力开关和展示 key 注册表 |
| `types.ts` | 跨模块共享类型和 host 契约 |
| `helpers.ts` | 坐标、方向、边界等纯工具函数 |
| `presetEntityData.ts` | 默认棋盘实体预设数据 |

## 边界约束

- `shared/` 可以被 runtime、renderer、bootstrap、shop、placement、prediction、debug 读取。
- `shared/` 不反向依赖任何业务目录。
- 如果工具函数开始包含具体规则语义，应优先移动到对应业务目录。

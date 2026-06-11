# board-debug

调试入口。这里可以提供控制台命令和调试 UI，但正式运行时模块不能依赖本目录。

| 文件 | 职责 |
|---|---|
| `BoardDebugController.ts` | Cocos 调试组件，挂载 `globalThis.boardDebug` 并显示状态文本 |
| `board-debug-api.ts` | 调试控制台 API 创建和状态文案格式化 |

## 边界约束

- 调试模块只依赖 `BoardDebugHost` 契约，不反射读取 `BoardBootstrap` 私有字段。
- 调试 API 可以触发 runtime 暴露的正式能力，但不要把调试逻辑反向塞进 runtime。

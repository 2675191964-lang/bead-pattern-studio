# 架构

## 决策

单仓库、无后端的 React + TypeScript + Vite PWA。浏览器主线程负责解码、界面和渲染，Worker 负责确定性转换。IndexedDB 是本地持久层。

## 模块边界

- `src/core`: 无 React/DOM 依赖的颜色、量化、网格、统计与序列化纯函数。
- `src/workers`: 带 `jobId` 的转换调度；新任务会终止旧 Worker，旧结果不能覆盖新设置。
- `src/renderers`: 只读 `PatternGrid`，生成屏幕、PNG、SVG、PDF 所需布局。
- `src/storage`: 带数据库版本的项目、图片与设置仓库。
- `src/features`: 上传、编辑、导出与页面交互。

## 唯一真相源

网格单元用 `Uint16Array` 保存色卡快照索引，`65535` 表示透明。统计不单独持久化，任何时候都由网格重算，避免计数漂移。

# 依赖审查

| 依赖 | 用途 | 许可 | 运行时影响/替代 |
| --- | --- | --- | --- |
| React / React DOM | UI | MIT | 主 UI；原生 DOM 替代会显著增加维护成本 |
| React Router | 深链路由 | MIT | 小型路由层；手写 history 可替代 |
| jsPDF | 客户端分页 PDF | MIT | 仅导出时加载；浏览器打印不可稳定生成分板页 |
| lucide-react | 无障碍 SVG 图标 | ISC | 可用手写 SVG 替代 |
| Vite / React plugin | 构建 | MIT | 开发依赖/构建基础 |
| vite-plugin-pwa / Workbox | 离线壳与更新 | MIT | 构建产物；可手写 Service Worker，但更易缓存错误 |
| workbox-window | PWA 更新提示 | MIT | 由 PWA 注册模块显式调用；无远端请求 |
| Vitest / Testing Library | 单元与组件测试 | MIT | 开发依赖 |
| Playwright | Chrome/移动端 E2E | Apache-2.0 | 开发依赖 |
| ESLint / TypeScript ESLint | 静态检查 | MIT/BSD-2-Clause | 开发依赖 |

已按 `pnpm-lock.yaml` 的实际解析版本复核：`pnpm licenses list --prod --json` 仅报告 MIT、ISC、MPL-2.0 OR Apache-2.0、MIT AND Zlib；`pnpm audit --prod --audit-level high` 报告无已知漏洞。生产代码不含密钥、追踪或远端图片请求。

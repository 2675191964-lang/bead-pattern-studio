# 豆格工坊（Bead Pattern Studio）

一款隐私优先、可离线使用的拼豆图案生成与编辑工具。上传 JPG、PNG 或 WebP 后，可在浏览器本地完成网格采样、Lab/CIEDE2000 色号匹配、逐格编辑、数量统计、项目恢复，以及 PNG、SVG、PDF、CSV、JSON 导出。

> 图片默认只在当前设备的浏览器中处理，不上传服务器。内置色卡是基于公开社区数据的屏幕近似值，并非品牌官方认证或实体批次校色结果。

## 在线直接使用

[打开 GitHub Pages 在线版](https://2675191964-lang.github.io/bead-pattern-studio/)。首次在线打开后，应用壳会缓存到当前浏览器，之后可离线回访；项目和原图只保存在本机浏览器中。

## 直接使用

要求 Node.js 20+ 与 pnpm 10+：

```powershell
pnpm install
pnpm dev
```

浏览器打开终端给出的本地地址。生产构建与本地预览：

```powershell
pnpm build
pnpm preview
```

## 主流程

1. 在首页拖入、选择或粘贴图片，也可导入以前导出的项目 JSON。
2. 在编辑器设置网格、色卡、颜色数、裁剪、背景与抖动，再生成图案。
3. 切换平面、施工、圆豆视图，使用画笔、橡皮、填充、吸色与矩形工具修整。
4. 核对色号数量、总豆数、尺寸和底板分区。
5. 在导出页生成 PNG、效果图、SVG、PDF、CSV 或项目备份。

## 质量检查

```powershell
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm test:e2e
```

详细需求、架构、色卡来源、许可边界和已知限制见 [`docs/`](docs/)。

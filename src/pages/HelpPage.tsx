import { BookOpen, CircleAlert, Download, ImagePlus, MousePointer2, ShieldCheck } from 'lucide-react';

export function HelpPage() {
  return (
    <div className="help-page page-width">
      <header className="page-heading"><span className="eyebrow">三分钟上手</span><h1>从图片到施工图</h1><p>先用推荐参数获得干净轮廓，再逐格精修，最后核对数量和打印比例。</p></header>
      <section className="steps-grid">
        <article><span>01</span><ImagePlus /><h2>上传与构图</h2><p>支持 JPG、PNG、WebP。透明 PNG 最适合 Logo 和角色立绘；裁剪只生成工作副本，不改原文件。</p></article>
        <article><span>02</span><BookOpen /><h2>选择网格与色数</h2><p>小图从 29 格长边、12–18 色开始；人像可用 58–87 格并开启 Floyd-Steinberg。</p></article>
        <article><span>03</span><MousePointer2 /><h2>精修图案</h2><p>用画笔、橡皮、填充、吸色和矩形区域调整。锁定关键颜色，撤销/重做最多保留 50 次。</p></article>
        <article><span>04</span><Download /><h2>导出与施工</h2><p>先检查总豆数和底板分区，再导出施工 PNG/PDF、材料 CSV 和项目 JSON 备份。</p></article>
      </section>
      <section className="help-columns">
        <div className="card"><h2><ShieldCheck size={20} />隐私与离线</h2><p>图像解码、匹配、编辑和导出全部在浏览器本地完成。应用不含分析 SDK、远端图片请求、账号或密钥。</p><p>首次打开后可通过浏览器“安装应用”使用 PWA；更新时浏览器会替换旧应用壳，项目和色卡快照保留在 IndexedDB。</p></div>
        <div className="card"><h2><CircleAlert size={20} />颜色与打印</h2><p>屏幕 RGB 只是近似。购买大量材料前，请用目标批次实体豆在固定光源下做小样。</p><p>PDF 请按 100%/实际大小打印，并先测量 50 mm 校准线；浏览器或打印机“适合页面”会改变实际尺寸。</p></div>
      </section>
    </div>
  );
}

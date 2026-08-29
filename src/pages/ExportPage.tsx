import { useEffect, useState } from 'react';
import { ArrowLeft, Download, FileArchive, FileImage, FileSpreadsheet, FileText, Printer, Shapes } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useProjects } from '../app/ProjectContext';
import { PatternCanvas } from '../components/PatternCanvas';
import { boardLayout, patternStats } from '../core/pattern/pattern';
import { createMaterialsCsv, exportCsv, exportPdf, exportPng, exportProjectJson, exportSvg } from '../features/export/exporters';
import { fitZoomForGrid } from '../renderers/patternRenderer';

export function ExportPage() {
  const { id } = useParams();
  const { currentProject, openProject } = useProjects();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [scale, setScale] = useState(2);
  const [wasteRate, setWasteRate] = useState(8);
  const [packageSize, setPackageSize] = useState(1000);
  const project = currentProject?.id === id ? currentProject : undefined;

  useEffect(() => { if (id && currentProject?.id !== id) void openProject(id).catch((reason) => setError(reason instanceof Error ? reason.message : '项目加载失败')); }, [id, currentProject?.id, openProject]);
  const stats = project?.grid ? patternStats(project.grid) : undefined;
  const boards = project?.grid ? boardLayout(project.grid, project.settings.boardWidth, project.settings.boardHeight) : undefined;

  if (!project) return <div className="center-state">{error || '正在打开项目…'}</div>;
  if (!project.grid || !stats || !boards) return <div className="center-state"><h1>还没有可导出的图案</h1><Link className="primary" to={`/editor/${project.id}`}>返回生成</Link></div>;

  const run = async (label: string, action: () => void | Promise<void>) => {
    setBusy(label);
    setError('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : `${label}失败`); } finally { setBusy(''); }
  };
  const estimatedPixels = (project.grid.width * 14 * scale) * (project.grid.height * 14 * scale);
  const estimatedMb = estimatedPixels * 4 / 1024 / 1024;
  const csvTotal = createMaterialsCsv(project, wasteRate / 100, packageSize).split('\r\n').slice(1).reduce((sum, row) => sum + Number(row.split(',')[5]?.replaceAll('"', '') ?? 0), 0);

  return (
    <div className="export-page page-width">
      <header className="page-heading">
        <Link className="back-link" to={`/editor/${project.id}`}><ArrowLeft size={18} />返回编辑器</Link>
        <span className="eyebrow">检查 · 打印 · 备份</span>
        <h1>导出施工资料</h1>
        <p>所有格式都从当前网格生成。导出前请核对数量、色号与底板方向。</p>
      </header>
      <div className="export-layout">
        <section className="export-preview card">
          <div className="card-heading"><div><span className="eyebrow">实时预览</span><h2>{project.name}</h2></div><span className="badge">施工图</span></div>
          <div className="export-canvas-scroll"><PatternCanvas grid={project.grid} mode="blueprint" zoom={fitZoomForGrid(project.grid.width, project.grid.height, 'blueprint', 640)} boardWidth={project.settings.boardWidth} boardHeight={project.settings.boardHeight} /></div>
          <div className="summary-strip">
            <div><strong>{project.grid.width}×{project.grid.height}</strong><span>网格</span></div>
            <div><strong>{stats.total}</strong><span>总豆数</span></div>
            <div><strong>{stats.colors.length}</strong><span>颜色</span></div>
            <div><strong>{boards.count}</strong><span>底板</span></div>
          </div>
          <div className={`integrity-check ${csvTotal === stats.total ? 'pass' : 'fail'}`}>网格非透明格 {stats.total} = 分色合计 {stats.colors.reduce((sum, item) => sum + item.count, 0)} = CSV 必需量 {csvTotal}</div>
        </section>

        <aside className="export-options card">
          <div className="card-heading"><div><span className="eyebrow">导出设置</span><h2>格式与采购量</h2></div></div>
          <div className="export-settings">
            <label>PNG 倍率<select value={scale} onChange={(event) => setScale(Number(event.target.value))}><option value="1">1× 标准</option><option value="2">2× 高清</option><option value="3">3× 印刷</option></select><small>预计 RGBA 内存约 {estimatedMb.toFixed(1)} MB</small></label>
            <div className="two-fields">
              <label>损耗率 %<input type="number" min="0" max="100" value={wasteRate} onChange={(event) => setWasteRate(Math.max(0, Math.min(100, Number(event.target.value))))} /></label>
              <label>每包颗数<input type="number" min="1" max="100000" value={packageSize} onChange={(event) => setPackageSize(Math.max(1, Number(event.target.value)))} /></label>
            </div>
          </div>
          <div className="export-buttons">
            <button onClick={() => void run('施工 PNG', () => exportPng(project, 'blueprint', scale))} disabled={!!busy}><FileImage size={20} /><span><strong>施工 PNG</strong><small>网格、坐标与格内色号</small></span><Download size={17} /></button>
            <button onClick={() => void run('效果 PNG', () => exportPng(project, 'bead', scale))} disabled={!!busy}><Shapes size={20} /><span><strong>圆豆效果 PNG</strong><small>透明背景、轻高光与孔洞</small></span><Download size={17} /></button>
            <button onClick={() => void run('PDF', () => exportPdf(project, wasteRate / 100, packageSize))} disabled={!!busy}><Printer size={20} /><span><strong>分板 PDF</strong><small>材料表、校准尺、逐板施工页</small></span><Download size={17} /></button>
            <button onClick={() => void run('SVG', () => exportSvg(project))} disabled={!!busy}><FileText size={20} /><span><strong>矢量 SVG</strong><small>可缩放格线与色号文本</small></span><Download size={17} /></button>
            <button onClick={() => void run('CSV', () => exportCsv(project, wasteRate / 100, packageSize))} disabled={!!busy}><FileSpreadsheet size={20} /><span><strong>材料 CSV</strong><small>损耗、建议量与包装数</small></span><Download size={17} /></button>
            <button onClick={() => void run('项目备份', () => exportProjectJson(project))} disabled={!!busy}><FileArchive size={20} /><span><strong>项目 JSON</strong><small>网格、色卡快照与全部参数</small></span><Download size={17} /></button>
          </div>
          {busy && <div className="info-banner">正在生成{busy}…</div>}
          {error && <div className="error-banner" role="alert">{error}</div>}
          <p className="pdf-note">PDF 施工页使用色号与英文标签，避免标准字体缺少中文字形；中文项目名在 PNG、SVG、CSV、JSON 中完整保留。</p>
        </aside>
      </div>
    </div>
  );
}

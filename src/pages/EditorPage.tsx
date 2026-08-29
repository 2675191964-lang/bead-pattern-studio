import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Ban, Brush, CircleDot, Download, Eraser, Eye, Grid3X3, Lock, Maximize2,
  PaintBucket, Pipette, Redo2, RotateCcw, Save, Scan, Sparkles, SquareDashed, Unlock, X
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjects } from '../app/ProjectContext';
import { PatternCanvas, type EditorTool } from '../components/PatternCanvas';
import { boardLayout, patternStats, remapDisabledColor, replaceColor } from '../core/pattern/pattern';
import { decodeImage } from '../features/import/image';
import { PALETTES } from '../core/palette/palettes';
import { fitZoomForGrid } from '../renderers/patternRenderer';
import { loadAsset } from '../storage/db';
import { ConversionClient } from '../workers/conversionClient';
import type { ConversionSettings, PatternGrid } from '../types';

const STAGE_LABELS: Record<string, string> = { sampling: '面积采样', palette: '选择颜色', matching: '匹配色号', postprocess: '清理细节' };

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentProject, openProject, updateProject, saveState } = useProjects();
  const [error, setError] = useState('');
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState({ stage: '', ratio: 0 });
  const [tool, setTool] = useState<EditorTool>('brush');
  const [statusMessage, setStatusMessage] = useState('');
  const [undoStack, setUndoStack] = useState<Uint16Array[]>([]);
  const [redoStack, setRedoStack] = useState<Uint16Array[]>([]);
  const client = useRef(new ConversionClient());
  const normalizedLargeProjects = useRef(new Set<string>());
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const [canvasViewport, setCanvasViewport] = useState({ width: 0, height: 0 });

  const project = currentProject?.id === id ? currentProject : undefined;
  const stats = project?.grid ? patternStats(project.grid) : undefined;
  const boards = project?.grid ? boardLayout(project.grid, project.settings.boardWidth, project.settings.boardHeight) : undefined;
  const isLargeGrid = Boolean(project?.grid && project.grid.cells.length > 10_000);
  const fitTargetEdge = canvasViewport.width && canvasViewport.height ? Math.max(240, Math.min(canvasViewport.width, canvasViewport.height) - 96) : 760;

  useEffect(() => {
    if (!id) return;
    if (currentProject?.id === id) return;
    openProject(id).catch((reason) => setError(reason instanceof Error ? reason.message : '项目加载失败'));
  }, [id, currentProject?.id, openProject]);

  useEffect(() => () => client.current.cancel(), []);

  useEffect(() => {
    const element = canvasScrollRef.current;
    if (!element) return;
    const updateViewport = () => setCanvasViewport({ width: element.clientWidth, height: element.clientHeight });
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!project?.grid || !isLargeGrid || !canvasViewport.width || !canvasViewport.height) return;
    const key = `${project.id}:${project.ui.viewMode}`;
    if (normalizedLargeProjects.current.has(key)) return;
    normalizedLargeProjects.current.add(key);
    const zoom = fitZoomForGrid(project.grid.width, project.grid.height, project.ui.viewMode, fitTargetEdge);
    updateProject((value) => ({ ...value, ui: { ...value.ui, zoom } }));
  }, [canvasViewport.height, canvasViewport.width, fitTargetEdge, isLargeGrid, project?.grid, project?.id, project?.ui.viewMode, updateProject]);

  if (!project && !error) return <div className="center-state">正在打开项目…</div>;
  if (!project) return <div className="center-state"><h1>无法打开项目</h1><p>{error || '项目不存在。'}</p><Link className="primary" to="/">返回首页</Link></div>;

  const patchSettings = (patch: Partial<ConversionSettings>) => updateProject((value) => ({ ...value, settings: { ...value.settings, ...patch } }));
  const selectColor = (selectedPaletteIndex: number) => updateProject((value) => ({ ...value, ui: { ...value.ui, selectedPaletteIndex } }));

  const runConversion = async (overrides: Partial<ConversionSettings> = {}) => {
    const source = project.sourceImage;
    if (!source) {
      setError('这个导入项目没有嵌入源图，可继续编辑和导出，但不能重新转换。');
      return;
    }
    setError('');
    setConverting(true);
    setProgress({ stage: 'sampling', ratio: 0 });
    try {
      const blob = await loadAsset(source.assetId);
      if (!blob) throw new Error('本机源图已丢失；现有网格仍可编辑和导出');
      const decoded = await decodeImage(blob);
      const settings = { ...project.settings, ...overrides };
      const result = await client.current.convert(decoded.pixels, settings, (stage, ratio) => setProgress({ stage, ratio }));
      setUndoStack([]);
      setRedoStack([]);
      const firstUsed = result.grid.cells.find((cell) => cell !== 65_535) ?? 0;
      updateProject((value) => ({
        ...value,
        settings,
        grid: result.grid,
        ui: {
          ...value.ui,
          selectedPaletteIndex: firstUsed,
          zoom: result.grid.cells.length > 10_000 ? fitZoomForGrid(result.grid.width, result.grid.height, value.ui.viewMode, fitTargetEdge) : value.ui.zoom
        },
      }));
      setStatusMessage(`转换完成 · ${result.diagnostics.opaqueCells} 颗 · ${result.diagnostics.selectedColors} 色 · ${Math.round(result.diagnostics.durationMs)} ms`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '转换失败');
    } finally {
      setConverting(false);
    }
  };

  const cancelConversion = () => {
    client.current.cancel();
    setConverting(false);
    setStatusMessage('已取消转换，项目未被覆盖');
  };

  const commitGrid = (nextGrid: PatternGrid) => {
    if (!project.grid) return;
    setUndoStack((previous) => [...previous, project.grid!.cells.slice()].slice(-50));
    setRedoStack([]);
    updateProject((value) => ({ ...value, grid: nextGrid }));
  };

  const commitCells = (cells: Uint16Array) => {
    if (!project.grid || cells.every((value, index) => value === project.grid!.cells[index])) return;
    commitGrid({ ...project.grid, cells });
  };

  const undo = () => {
    if (!project.grid) return;
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((items) => items.slice(0, -1));
    setRedoStack((items) => [...items, project.grid!.cells.slice()].slice(-50));
    updateProject((value) => ({ ...value, grid: value.grid ? { ...value.grid, cells: previous } : undefined }));
  };

  const redo = () => {
    if (!project.grid) return;
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((items) => items.slice(0, -1));
    setUndoStack((items) => [...items, project.grid!.cells.slice()].slice(-50));
    updateProject((value) => ({ ...value, grid: value.grid ? { ...value.grid, cells: next } : undefined }));
  };

  const replaceWithSelected = (fromIndex: number) => {
    if (!project.grid || fromIndex === project.ui.selectedPaletteIndex) return;
    commitCells(replaceColor(project.grid.cells, fromIndex, project.ui.selectedPaletteIndex));
  };

  const remapColor = (index: number) => {
    if (!project.grid) return;
    try {
      const cells = remapDisabledColor(project.grid, index);
      const paletteSnapshot = project.grid.paletteSnapshot.map((color, colorIndex) => colorIndex === index ? { ...color, active: false } : color);
      commitGrid({ ...project.grid, cells, paletteSnapshot });
      setStatusMessage(`已停用 ${project.grid.paletteSnapshot[index]?.code ?? ''} 并重映射所有格`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重映射失败');
    }
  };

  const toggleLock = (index: number) => {
    const current = new Set(project.ui.lockedPaletteIndices);
    if (current.has(index)) current.delete(index); else current.add(index);
    updateProject((value) => ({ ...value, ui: { ...value.ui, lockedPaletteIndices: Array.from(current) } }));
  };

  const currentColor = project.grid?.paletteSnapshot[project.ui.selectedPaletteIndex];
  const physicalWidth = project.grid ? project.grid.width * project.settings.beadSizeMm / 10 : 0;
  const physicalHeight = project.grid ? project.grid.height * project.settings.beadSizeMm / 10 : 0;

  return (
    <div className="editor-page">
      <header className="editor-header">
        <button className="icon-button" aria-label="返回首页" onClick={() => navigate('/')}><ArrowLeft size={19} /></button>
        <input className="project-name" aria-label="项目名称" value={project.name} onChange={(event) => updateProject((value) => ({ ...value, name: event.target.value }))} />
        <div className={`save-state save-${saveState}`}><Save size={15} />{saveState === 'saved' ? '已保存' : saveState === 'saving' ? '保存中' : '保存失败'}</div>
        <div className="header-actions">
          <button className="tool-button" onClick={undo} disabled={!undoStack.length}><RotateCcw size={17} />撤销</button>
          <button className="tool-button" onClick={redo} disabled={!redoStack.length}><Redo2 size={17} />重做</button>
          <button className="primary" disabled={!project.grid} onClick={() => navigate(`/export/${project.id}`)}><Download size={17} />导出</button>
        </div>
      </header>

      <div className="editor-grid">
        <aside className="settings-panel panel-scroll">
          <details open>
            <summary>01 · 图案设置</summary>
            <label>色卡<select value={project.settings.paletteId} onChange={(event) => {
              const palette = PALETTES.find((item) => item.id === event.target.value)!;
              patchSettings({ paletteId: palette.id, beadSizeMm: palette.beadSizeMm });
            }}>{PALETTES.map((palette) => <option key={palette.id} value={palette.id}>{palette.name} · {palette.colors.length}</option>)}</select></label>
            <div className="two-fields">
              <label>列数<input type="number" min="1" max="200" value={project.settings.gridWidth} onChange={(event) => {
                const gridWidth = clampNumber(Number(event.target.value), 1, 200);
                const gridHeight = project.settings.lockAspect && project.sourceImage ? clampNumber(Math.round(gridWidth * project.sourceImage.height / project.sourceImage.width), 1, 200) : project.settings.gridHeight;
                patchSettings({ gridWidth, gridHeight });
              }} /></label>
              <label>行数<input type="number" min="1" max="200" value={project.settings.gridHeight} onChange={(event) => patchSettings({ gridHeight: clampNumber(Number(event.target.value), 1, 200) })} disabled={project.settings.lockAspect} /></label>
            </div>
            <label className="check-row"><input type="checkbox" checked={project.settings.lockAspect} onChange={(event) => patchSettings({ lockAspect: event.target.checked })} />锁定源图比例</label>
            <label>最大颜色数 <output>{project.settings.maxColors}</output><input type="range" min="2" max="80" value={project.settings.maxColors} onChange={(event) => patchSettings({ maxColors: Number(event.target.value) })} /></label>
            <div className="two-fields">
              <label>底板列<input type="number" min="1" max="100" value={project.settings.boardWidth} onChange={(event) => patchSettings({ boardWidth: clampNumber(Number(event.target.value), 1, 100) })} /></label>
              <label>底板行<input type="number" min="1" max="100" value={project.settings.boardHeight} onChange={(event) => patchSettings({ boardHeight: clampNumber(Number(event.target.value), 1, 100) })} /></label>
            </div>
          </details>

          <details>
            <summary>02 · 构图与背景</summary>
            <p className="panel-hint">裁剪值按原图百分比计算，不修改原文件。</p>
            <div className="two-fields">
              <label>左侧 %<input type="number" min="0" max="95" value={Math.round(project.settings.crop.x * 100)} onChange={(event) => { const x = clampNumber(Number(event.target.value) / 100, 0, 1 - project.settings.crop.width); patchSettings({ crop: { ...project.settings.crop, x } }); }} /></label>
              <label>顶部 %<input type="number" min="0" max="95" value={Math.round(project.settings.crop.y * 100)} onChange={(event) => { const y = clampNumber(Number(event.target.value) / 100, 0, 1 - project.settings.crop.height); patchSettings({ crop: { ...project.settings.crop, y } }); }} /></label>
              <label>宽度 %<input type="number" min="5" max="100" value={Math.round(project.settings.crop.width * 100)} onChange={(event) => { const width = clampNumber(Number(event.target.value) / 100, 0.05, 1 - project.settings.crop.x); patchSettings({ crop: { ...project.settings.crop, width } }); }} /></label>
              <label>高度 %<input type="number" min="5" max="100" value={Math.round(project.settings.crop.height * 100)} onChange={(event) => { const height = clampNumber(Number(event.target.value) / 100, 0.05, 1 - project.settings.crop.y); patchSettings({ crop: { ...project.settings.crop, height } }); }} /></label>
            </div>
            {project.sourceImage?.thumbnail && <div className="crop-preview"><img src={project.sourceImage.thumbnail} alt="原图裁剪参考" /></div>}
            <label className="check-row"><input type="checkbox" checked={project.settings.backgroundEnabled} onChange={(event) => patchSettings({ backgroundEnabled: event.target.checked })} />按颜色去背景</label>
            {project.settings.backgroundEnabled && <div className="two-fields"><label>背景色<input type="color" value={project.settings.backgroundHex} onChange={(event) => patchSettings({ backgroundHex: event.target.value as `#${string}` })} /></label><label>容差<input type="number" min="0" max="200" value={project.settings.backgroundTolerance} onChange={(event) => patchSettings({ backgroundTolerance: clampNumber(Number(event.target.value), 0, 200) })} /></label></div>}
          </details>

          <details>
            <summary>03 · 颜色与细节</summary>
            <label>抖动<select value={project.settings.dither} onChange={(event) => patchSettings({ dither: event.target.value as ConversionSettings['dither'] })}><option value="none">关闭（轮廓清晰）</option><option value="floyd-steinberg">Floyd-Steinberg（渐变）</option><option value="bayer4">Bayer 4×4（规则纹理）</option></select></label>
            {project.settings.dither !== 'none' && <label>抖动强度 <output>{Math.round(project.settings.ditherStrength * 100)}%</output><input type="range" min="0" max="1" step="0.05" value={project.settings.ditherStrength} onChange={(event) => patchSettings({ ditherStrength: Number(event.target.value) })} /></label>}
            <label>亮度 <output>{project.settings.brightness}</output><input type="range" min="-50" max="50" value={project.settings.brightness} onChange={(event) => patchSettings({ brightness: Number(event.target.value) })} /></label>
            <label>对比度 <output>{project.settings.contrast}</output><input type="range" min="-50" max="50" value={project.settings.contrast} onChange={(event) => patchSettings({ contrast: Number(event.target.value) })} /></label>
            <label>饱和度 <output>{project.settings.saturation}</output><input type="range" min="-50" max="50" value={project.settings.saturation} onChange={(event) => patchSettings({ saturation: Number(event.target.value) })} /></label>
            <label className="check-row"><input type="checkbox" checked={project.settings.removeIsolated} onChange={(event) => patchSettings({ removeIsolated: event.target.checked })} />清理明显孤立色点</label>
          </details>

          <div className="preset-row">
            <button onClick={() => void runConversion({ dither: 'none', removeIsolated: false })}>清晰</button>
            <button onClick={() => void runConversion({ dither: 'none', removeIsolated: true })}>平滑</button>
            <button onClick={() => void runConversion({ dither: 'none', removeIsolated: true, maxColors: Math.max(4, Math.round(project.settings.maxColors / 2)) })}>省色</button>
          </div>
          {project.settings.gridWidth * project.settings.gridHeight > 10_000 && (
            <div className="info-banner">大型网格将生成 {project.settings.gridWidth * project.settings.gridHeight} 格。程序会自动使用适屏预览并限制画布内存；导出仍保留完整网格。</div>
          )}
          {converting ? (
            <div className="progress-box"><div><span>{STAGE_LABELS[progress.stage] ?? '处理中'}</span><strong>{Math.round(progress.ratio * 100)}%</strong></div><progress max="1" value={progress.ratio} /><button className="text-button" onClick={cancelConversion}><X size={15} />取消</button></div>
          ) : <button className="primary full" onClick={() => void runConversion()}><Sparkles size={18} />{project.grid ? '按当前设置重新生成' : '生成拼豆图案'}</button>}
          {error && <div className="error-banner" role="alert">{error}</div>}
        </aside>

        <section className="canvas-workspace">
          <div className="canvas-toolbar" aria-label="画布工具">
            <div className="tool-group">
              {([
                ['brush', Brush, '画笔'], ['eraser', Eraser, '橡皮'], ['fill', PaintBucket, '填充'], ['picker', Pipette, '吸色'], ['rect', SquareDashed, '矩形'], ['pan', Maximize2, '查看']
              ] as const).map(([value, Icon, label]) => <button key={value} className={tool === value ? 'active' : ''} onClick={() => setTool(value)} title={label} aria-label={label}><Icon size={17} /><span>{label}</span></button>)}
            </div>
            <div className="tool-group view-modes">
              {([
                ['flat', Eye, '平面'], ['blueprint', Grid3X3, '施工'], ['bead', CircleDot, '圆豆'], ['boards', Scan, '分板']
              ] as const).map(([value, Icon, label]) => <button key={value} aria-label={label} title={label} className={project.ui.viewMode === value ? 'active' : ''} onClick={() => updateProject((item) => ({ ...item, ui: { ...item.ui, viewMode: value } }))}><Icon size={17} /><span>{label}</span></button>)}
            </div>
            <div className="zoom-control"><span>缩放 {Math.round(project.ui.zoom * 100)}%</span><input aria-label="缩放" type="range" min="0.1" max="3" step="0.01" value={project.ui.zoom} onChange={(event) => updateProject((item) => ({ ...item, ui: { ...item.ui, zoom: Number(event.target.value) } }))} /><button className="text-button" onClick={() => project.grid && updateProject((item) => ({ ...item, ui: { ...item.ui, zoom: fitZoomForGrid(project.grid!.width, project.grid!.height, item.ui.viewMode, fitTargetEdge) } }))}>适屏</button></div>
          </div>
          <div className="canvas-scroll" ref={canvasScrollRef}>
            {project.grid ? (
              <div className="canvas-stage">
                <PatternCanvas
                  grid={project.grid}
                  mode={project.ui.viewMode}
                  zoom={project.ui.zoom}
                  boardWidth={project.settings.boardWidth}
                  boardHeight={project.settings.boardHeight}
                  tool={tool}
                  selectedPaletteIndex={project.ui.selectedPaletteIndex}
                  lockedPaletteIndices={project.ui.lockedPaletteIndices}
                  onCommit={commitCells}
                  onPick={selectColor}
                />
              </div>
            ) : (
              <div className="canvas-empty"><Grid3X3 size={42} /><h2>设置参数后生成第一版图案</h2><p>建议先用 29 格长边、18 色、关闭抖动。</p><button className="primary" onClick={() => void runConversion()}><Sparkles size={17} />立即生成</button></div>
            )}
          </div>
          <div className="editor-statusbar">
            <span>{project.grid ? `${project.grid.width} 列 × ${project.grid.height} 行` : '尚未生成'}</span>
            <span>{stats ? `${stats.total} 颗 · ${stats.colors.length} 色` : '—'}</span>
            <span>{project.grid ? `${physicalWidth.toFixed(1)} × ${physicalHeight.toFixed(1)} cm` : '—'}</span>
            <span>{boards ? `${boards.columns} × ${boards.rows} · ${boards.count} 块底板` : '—'}</span>
            <span className="status-message">{statusMessage}</span>
          </div>
        </section>

        <aside className="colors-panel panel-scroll">
          <div className="panel-title"><div><span className="eyebrow">用量清单</span><h2>颜色与数量</h2></div>{currentColor && <span className="current-swatch" style={{ background: currentColor.hex }} title={`当前颜色 ${currentColor.code}`} />}</div>
          {stats ? <>
            <div className="total-card"><strong>{stats.total.toLocaleString()}</strong><span>总豆数</span><small>{stats.colors.length} 种颜色</small></div>
            <p className="panel-hint">点击颜色可设为当前画笔；锁定色不会被编辑工具覆盖。</p>
            <div className="color-list">
              {stats.colors.map(({ color, count, ratio, paletteIndex }) => {
                const selected = project.ui.selectedPaletteIndex === paletteIndex;
                const isLocked = project.ui.lockedPaletteIndices.includes(paletteIndex);
                return <div className={`color-row ${selected ? 'selected' : ''}`} key={color.id}>
                  <button className="color-main" onClick={() => selectColor(paletteIndex)}>
                    <span className="swatch" style={{ background: color.hex }} /><span className="color-name"><strong>{color.code}</strong><small>{color.nameZh}</small></span><span className="color-count"><strong>{count}</strong><small>{(ratio * 100).toFixed(1)}%</small></span>
                  </button>
                  <div className="color-actions">
                    <button aria-label={`${isLocked ? '解锁' : '锁定'} ${color.code}`} onClick={() => toggleLock(paletteIndex)}>{isLocked ? <Lock size={14} /> : <Unlock size={14} />}</button>
                    <button aria-label={`将 ${color.code} 替换为当前色`} title="替换为当前色" disabled={selected} onClick={() => replaceWithSelected(paletteIndex)}><Brush size={14} /></button>
                    <button aria-label={`停用并重映射 ${color.code}`} title="停用并重映射" disabled={stats.colors.length <= 1} onClick={() => { if (window.confirm(`停用 ${color.code} 并把所有该色格重映射到感知最接近的颜色？`)) remapColor(paletteIndex); }}><Ban size={14} /></button>
                  </div>
                </div>;
              })}
            </div>
          </> : <div className="panel-empty"><CircleDot size={28} /><p>生成图案后显示颜色与用量。</p></div>}
        </aside>
      </div>
    </div>
  );
}

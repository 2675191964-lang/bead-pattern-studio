import { useState } from 'react';
import { Check, Gauge, Palette, Ruler } from 'lucide-react';
import { useProjects } from '../app/ProjectContext';
import { PALETTES } from '../core/palette/palettes';

export function SettingsPage() {
  const { appSettings, updateSettings } = useProjects();
  const [draft, setDraft] = useState(appSettings);
  const [saved, setSaved] = useState(false);
  return (
    <div className="narrow-page">
      <header className="page-heading"><span className="eyebrow">本机偏好</span><h1>默认设置</h1><p>这些选项只保存在当前浏览器，不会同步到任何服务器。</p></header>
      <section className="settings-card card">
        <label><span><Palette size={19} /><b>默认色卡</b></span><select value={draft.defaultPaletteId} onChange={(event) => setDraft({ ...draft, defaultPaletteId: event.target.value })}>{PALETTES.map((palette) => <option key={palette.id} value={palette.id}>{palette.name}</option>)}</select></label>
        <label><span><Ruler size={19} /><b>默认长边格数</b></span><input type="number" min="1" max="200" value={draft.defaultGridWidth} onChange={(event) => setDraft({ ...draft, defaultGridWidth: Math.max(1, Math.min(200, Number(event.target.value))) })} /></label>
        <label><span><Palette size={19} /><b>默认最大颜色数</b></span><input type="number" min="2" max="80" value={draft.defaultMaxColors} onChange={(event) => setDraft({ ...draft, defaultMaxColors: Math.max(2, Math.min(80, Number(event.target.value))) })} /></label>
        <label><span><Gauge size={19} /><b>性能偏好</b></span><select value={draft.performanceMode} onChange={(event) => setDraft({ ...draft, performanceMode: event.target.value as typeof draft.performanceMode })}><option value="quality">质量优先</option><option value="balanced">平衡</option><option value="speed">速度优先</option></select></label>
        <button className="primary" onClick={() => { void updateSettings(draft).then(() => { setSaved(true); window.setTimeout(() => setSaved(false), 1600); }); }}>{saved ? <Check size={17} /> : null}{saved ? '已保存' : '保存默认设置'}</button>
      </section>
    </div>
  );
}

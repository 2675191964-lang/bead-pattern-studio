import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Clock3, FileImage, FolderOpen, LockKeyhole, Plus, Trash2, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../app/ProjectContext';
import type { ProjectFileV1 } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const { createProject, importProject, recentProjects, removeProject, ready } = useProjects();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

  const acceptImage = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const project = await createProject(file);
      navigate(`/editor/${project.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导入失败');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
      if (image) void acceptImage(image);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void acceptImage(event.dataTransfer.files[0]);
  };

  const handleProjectImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const parsed = JSON.parse(await file.text()) as ProjectFileV1;
      const project = await importProject(parsed);
      navigate(`/editor/${project.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目文件无法读取');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  return (
    <div className="home-page page-width">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">从图片到可施工图纸</span>
          <h1>把喜欢的画面，<br /><em>一颗一颗</em>变成拼豆。</h1>
          <p>本地完成颜色匹配、逐格编辑、数量统计和施工导出。图片不离开当前设备。</p>
          <div className="hero-points"><span>✓ 394 个社区色号</span><span>✓ 数量实时一致</span><span>✓ 可离线安装</span></div>
        </div>
        <div
          className={`upload-card ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="upload-icon"><UploadCloud size={34} /></div>
          <h2>{busy ? '正在读取图片…' : '开始一个新图案'}</h2>
          <p>拖入 JPG、PNG、WebP，或按 Ctrl+V 粘贴</p>
          <button className="primary large" onClick={() => imageInput.current?.click()} disabled={busy}><Plus size={18} />选择图片</button>
          <button className="text-button" onClick={() => projectInput.current?.click()} disabled={busy}><FolderOpen size={16} />导入项目备份</button>
          <input ref={imageInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => void acceptImage(event.target.files?.[0])} />
          <input ref={projectInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={handleProjectImport} />
          <div className="privacy-note"><LockKeyhole size={14} />不上传图片 · 不需要账号 · 不记录行为</div>
          {error && <div role="alert" className="error-banner">{error}</div>}
        </div>
      </section>

      <section className="recent-section">
        <div className="section-heading"><div><span className="eyebrow">继续创作</span><h2>最近项目</h2></div><Clock3 size={22} /></div>
        {!ready ? <p className="muted">正在读取本地项目…</p> : recentProjects.length === 0 ? (
          <div className="empty-projects"><FileImage size={28} /><p>还没有保存的项目。上传第一张图片即可开始。</p></div>
        ) : (
          <div className="project-grid">
            {recentProjects.map((project) => (
              <article className="project-card" key={project.id}>
                <button className="project-open" onClick={() => navigate(`/editor/${project.id}`)}>
                  <div className="project-thumb">{project.sourceImage?.thumbnail ? <img src={project.sourceImage.thumbnail} alt="" /> : <FileImage size={28} />}</div>
                  <div><strong>{project.name}</strong><small>{project.grid ? `${project.grid.width}×${project.grid.height} · ${project.grid.paletteSnapshot.length} 色卡项` : '尚未生成'}</small></div>
                </button>
                <button className="icon-button danger" aria-label={`删除 ${project.name}`} onClick={() => { if (window.confirm(`删除“${project.name}”？此操作会同时删除本机保存的源图。`)) void removeProject(project.id); }}><Trash2 size={16} /></button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { CircleHelp, Home, Settings, Sparkles } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand" to="/" aria-label="豆格工坊首页">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>豆格工坊</strong><small>Bead Pattern Studio</small></span>
        </NavLink>
        <nav aria-label="主导航">
          <NavLink to="/"><Home size={17} />首页</NavLink>
          <NavLink to="/settings"><Settings size={17} />设置</NavLink>
          <NavLink to="/help"><CircleHelp size={17} />帮助</NavLink>
        </nav>
        <span className="privacy-pill"><Sparkles size={15} />图片仅在本机处理</span>
      </header>
      <main><Outlet /></main>
      <footer className="site-footer">社区色值为屏幕近似，并非品牌认证或实体批次测量。使用前请按实物校色。</footer>
    </div>
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { ProjectProvider } from './app/ProjectContext';
import './styles.css';

const updateServiceWorker = registerSW({
  immediate: false,
  onNeedRefresh() {
    if (window.confirm('豆格工坊有新版本。项目已保存在本机，是否现在刷新更新？')) void updateServiceWorker(true);
  }
});

const Router = import.meta.env.BASE_URL === '/' ? BrowserRouter : HashRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <ProjectProvider><App /></ProjectProvider>
    </Router>
  </StrictMode>
);

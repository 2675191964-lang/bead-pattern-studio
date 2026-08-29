import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { EditorPage } from '../pages/EditorPage';
import { ExportPage } from '../pages/ExportPage';
import { HelpPage } from '../pages/HelpPage';
import { HomePage } from '../pages/HomePage';
import { SettingsPage } from '../pages/SettingsPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/help" element={<HelpPage />} />
      </Route>
      <Route path="/editor/:id" element={<EditorPage />} />
      <Route path="/export/:id" element={<ExportPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { decodeImage } from '../features/import/image';
import { deleteProject as deleteStoredProject, listProjects, loadProject, loadSettings, saveAsset, saveProject, saveSettings } from '../storage/db';
import { parseProjectFile } from '../core/pattern/serialize';
import type { AppSettings, BeadProject, PatternGrid, ProjectFileV1 } from '../types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultPaletteId: 'mard-291',
  defaultGridWidth: 29,
  defaultMaxColors: 18,
  unit: 'mm',
  performanceMode: 'balanced'
};

interface ProjectContextValue {
  currentProject?: BeadProject;
  recentProjects: BeadProject[];
  appSettings: AppSettings;
  ready: boolean;
  saveState: 'saved' | 'saving' | 'error';
  createProject(file: File): Promise<BeadProject>;
  importProject(file: ProjectFileV1): Promise<BeadProject>;
  openProject(id: string): Promise<BeadProject>;
  updateProject(updater: (project: BeadProject) => BeadProject): void;
  updateGrid(grid: PatternGrid): void;
  removeProject(id: string): Promise<void>;
  updateSettings(settings: AppSettings): Promise<void>;
  refreshProjects(): Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

function projectDefaults(file: File, width: number, height: number, thumbnail: string, appSettings: AppSettings): BeadProject {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const gridWidth = appSettings.defaultGridWidth;
  const gridHeight = Math.max(1, Math.min(200, Math.round(gridWidth * height / width)));
  return {
    schemaVersion: 1,
    id,
    name: file.name.replace(/\.[^.]+$/, '') || '未命名图案',
    createdAt: now,
    updatedAt: now,
    sourceImage: { assetId: crypto.randomUUID(), fileName: file.name, mimeType: file.type, width, height, byteSize: file.size, thumbnail },
    settings: {
      paletteId: appSettings.defaultPaletteId,
      gridWidth,
      gridHeight,
      lockAspect: true,
      maxColors: appSettings.defaultMaxColors,
      boardWidth: 29,
      boardHeight: 29,
      beadSizeMm: appSettings.defaultPaletteId.startsWith('mard') ? 2.6 : 5,
      dither: 'none',
      ditherStrength: 0.75,
      alphaThreshold: 24,
      backgroundEnabled: false,
      backgroundHex: '#ffffff',
      backgroundTolerance: 24,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      removeIsolated: true
    },
    ui: { viewMode: 'flat', zoom: 1, selectedPaletteIndex: 0, lockedPaletteIndices: [] }
  };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<BeadProject>();
  const [recentProjects, setRecentProjects] = useState<BeadProject[]>([]);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<ProjectContextValue['saveState']>('saved');
  const saveTimer = useRef<number | undefined>(undefined);

  const refreshProjects = useCallback(async () => setRecentProjects(await listProjects()), []);

  useEffect(() => {
    Promise.all([listProjects(), loadSettings()])
      .then(([projects, settings]) => {
        setRecentProjects(projects);
        if (settings) setAppSettings(settings);
      })
      .finally(() => setReady(true));
  }, []);

  const scheduleSave = useCallback((project: BeadProject) => {
    setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveProject(project)
        .then(() => {
          setSaveState('saved');
          void refreshProjects();
        })
        .catch(() => setSaveState('error'));
    }, 1000);
  }, [refreshProjects]);

  const createProject = useCallback(async (file: File) => {
    const decoded = await decodeImage(file);
    const project = projectDefaults(file, decoded.originalWidth, decoded.originalHeight, decoded.thumbnail, appSettings);
    await saveAsset(project.sourceImage!.assetId, file);
    await saveProject(project);
    setCurrentProject(project);
    await refreshProjects();
    return project;
  }, [appSettings, refreshProjects]);

  const importProject = useCallback(async (file: ProjectFileV1) => {
    const parsed = parseProjectFile(file);
    const now = new Date().toISOString();
    const imported = { ...parsed, id: crypto.randomUUID(), name: `${parsed.name}（导入）`, createdAt: now, updatedAt: now, sourceImage: undefined };
    await saveProject(imported);
    setCurrentProject(imported);
    await refreshProjects();
    return imported;
  }, [refreshProjects]);

  const openProject = useCallback(async (id: string) => {
    const project = await loadProject(id);
    if (!project) throw new Error('项目不存在或已被删除');
    setCurrentProject(project);
    return project;
  }, []);

  const updateProject = useCallback((updater: (project: BeadProject) => BeadProject) => {
    setCurrentProject((previous) => {
      if (!previous) return previous;
      const next = { ...updater(previous), updatedAt: new Date().toISOString() };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const updateGrid = useCallback((grid: PatternGrid) => updateProject((project) => ({ ...project, grid })), [updateProject]);

  const removeProject = useCallback(async (id: string) => {
    await deleteStoredProject(id);
    if (currentProject?.id === id) setCurrentProject(undefined);
    await refreshProjects();
  }, [currentProject?.id, refreshProjects]);

  const updateSettings = useCallback(async (settings: AppSettings) => {
    setAppSettings(settings);
    await saveSettings(settings);
  }, []);

  const value = useMemo<ProjectContextValue>(() => ({
    currentProject, recentProjects, appSettings, ready, saveState, createProject, importProject, openProject,
    updateProject, updateGrid, removeProject, updateSettings, refreshProjects
  }), [currentProject, recentProjects, appSettings, ready, saveState, createProject, importProject, openProject, updateProject, updateGrid, removeProject, updateSettings, refreshProjects]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error('useProjects 必须在 ProjectProvider 内使用');
  return value;
}

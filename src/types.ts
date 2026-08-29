export const TRANSPARENT_CELL = 65_535;

export type BrandId = string;
export type PaletteId = string;
export type ColorCode = string;

export interface BeadColor {
  id: string;
  brandId: BrandId;
  paletteId: PaletteId;
  code: ColorCode;
  nameZh: string;
  nameEn?: string;
  hex: `#${string}`;
  rgb: [number, number, number];
  lab: [number, number, number];
  series: string;
  finish: 'solid' | 'transparent' | 'glitter' | 'metallic';
  active: boolean;
  source: string;
  sourceDate: string;
  aliases?: string[];
  notes?: string;
}

export interface Palette {
  id: PaletteId;
  brandId: BrandId;
  name: string;
  series: string;
  beadSizeMm: number;
  version: string;
  source: string;
  colors: BeadColor[];
}

export interface PatternGrid {
  width: number;
  height: number;
  cells: Uint16Array;
  paletteSnapshot: BeadColor[];
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DitherMode = 'none' | 'floyd-steinberg' | 'bayer4';

export interface ConversionSettings {
  paletteId: PaletteId;
  gridWidth: number;
  gridHeight: number;
  lockAspect: boolean;
  maxColors: number;
  boardWidth: number;
  boardHeight: number;
  beadSizeMm: number;
  dither: DitherMode;
  ditherStrength: number;
  alphaThreshold: number;
  backgroundEnabled: boolean;
  backgroundHex: `#${string}`;
  backgroundTolerance: number;
  brightness: number;
  contrast: number;
  saturation: number;
  crop: CropRect;
  removeIsolated: boolean;
}

export interface SourceImageMeta {
  assetId: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  thumbnail?: string;
}

export interface ProjectUiState {
  viewMode: 'flat' | 'blueprint' | 'bead' | 'boards';
  zoom: number;
  selectedPaletteIndex: number;
  lockedPaletteIndices: number[];
}

export interface BeadProject {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceImage?: SourceImageMeta;
  settings: ConversionSettings;
  grid?: PatternGrid;
  ui: ProjectUiState;
}

export interface ImagePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface SerializedPatternGrid {
  width: number;
  height: number;
  cellsBase64: string;
  paletteSnapshot: BeadColor[];
}

export interface ProjectFileV1 extends Omit<BeadProject, 'grid'> {
  grid?: SerializedPatternGrid;
}

export interface AppSettings {
  defaultPaletteId: PaletteId;
  defaultGridWidth: number;
  defaultMaxColors: number;
  unit: 'mm' | 'cm';
  performanceMode: 'quality' | 'balanced' | 'speed';
}

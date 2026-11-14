import { AppThemeId } from '../types';

export const APP_THEME_STORAGE_KEY = 'logicpos_app_theme';

export interface AppThemeOption {
  id: AppThemeId;
  name: string;
  subtitle: string;
  description: string;
  isDarkSidebar: boolean;
  swatches: {
    canvas: string;
    surface: string;
    sidebar: string;
    sidebarActive: string;
    header: string;
    accent: string;
    border: string;
    text: string;
    muted: string;
  };
}

export const APP_THEMES: AppThemeOption[] = [
  {
    id: 'zinc_classic',
    name: 'Netral Klasik',
    subtitle: 'Putih & Charcoal',
    description: 'Tampilan bersih standar dengan kontras tinggi dan aksen arang gelap.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#F4F4F5',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#18181B',
      header: '#FFFFFF',
      accent: '#18181B',
      border: '#E4E4E7',
      text: '#09090B',
      muted: '#71717A',
    },
  },
  {
    id: 'ocean_slate',
    name: 'Biru Laut & Slate',
    subtitle: 'Segar & Profesional',
    description: 'Kanvas abu kebiruan lembut dipadukan dengan aksen biru laut yang tegas.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#E8F0F7',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#0369A1',
      header: '#FFFFFF',
      accent: '#0369A1',
      border: '#D1DFEC',
      text: '#0C4A6E',
      muted: '#4C6782',
    },
  },
  {
    id: 'emerald_mint',
    name: 'Hijau Zamrud & Mint',
    subtitle: 'Sejuk & Natural',
    description: 'Nuansa hijau botani yang ringan, nyaman di mata untuk jam kerja panjang.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#E6F4EC',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#047857',
      header: '#FFFFFF',
      accent: '#047857',
      border: '#CCE5D6',
      text: '#064E3B',
      muted: '#426D55',
    },
  },
  {
    id: 'rose_blossom',
    name: 'Rose Berry & Blush',
    subtitle: 'Butik Parfum & Skincare',
    description: 'Kombinasi lembut blush pastel dengan aksen rose berry yang modern.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#FAE8EB',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#BE123C',
      header: '#FFFFFF',
      accent: '#BE123C',
      border: '#F2CFD6',
      text: '#4C0519',
      muted: '#784754',
    },
  },
  {
    id: 'indigo_night',
    name: 'Indigo Royal & Gelap',
    subtitle: 'Sidebar Gelap 2-Tone',
    description: 'Sidebar gelap indigo kontras tinggi dipadu area kerja terang yang fokus.',
    isDarkSidebar: true,
    swatches: {
      canvas: '#EBEDF7',
      surface: '#FFFFFF',
      sidebar: '#1E1B4B',
      sidebarActive: '#4F46E5',
      header: '#FFFFFF',
      accent: '#4338CA',
      border: '#D6DAF0',
      text: '#1E1B4B',
      muted: '#505882',
    },
  },
  {
    id: 'espresso_cream',
    name: 'Espresso & Krem',
    subtitle: 'Hangat & Elegan',
    description: 'Latar krem hangat berpadu aksen cokelat espresso untuk kesan premium.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#F3ECE1',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#7C3F18',
      header: '#FFFFFF',
      accent: '#7C3F18',
      border: '#E3D6C4',
      text: '#3B1D0A',
      muted: '#6D5641',
    },
  },
];

export const VALID_APP_THEME_IDS: AppThemeId[] = APP_THEMES.map(t => t.id);

export function normalizeAppTheme(value?: string | null): AppThemeId {
  return VALID_APP_THEME_IDS.includes(value as AppThemeId)
    ? (value as AppThemeId)
    : 'zinc_classic';
}

export function getAppThemeMeta(value?: string | null): AppThemeOption {
  const id = normalizeAppTheme(value);
  return APP_THEMES.find(t => t.id === id) || APP_THEMES[0];
}

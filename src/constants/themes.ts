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
    primary: string;
    secondary: string;
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
    subtitle: 'Putih, Violet & Amber',
    description: 'Tampilan bersih standar dengan warna utama violet (#8E42FF), sekunder teal, dan aksen amber.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#F4F4F5',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#8E42FF',
      header: '#FFFFFF',
      primary: '#8E42FF',
      secondary: '#0F766E',
      accent: '#D97706',
      border: '#E4E4E7',
      text: '#09090B',
      muted: '#71717A',
    },
  },
  {
    id: 'ocean_slate',
    name: 'Biru Laut & Slate',
    subtitle: 'Segar & Profesional',
    description: 'Kanvas abu kebiruan dipadu biru laut utama, teal sekunder, dan aksen oranye koral.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#E8F0F7',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#0284C7',
      header: '#FFFFFF',
      primary: '#0284C7',
      secondary: '#0D9488',
      accent: '#EA580C',
      border: '#D1DFEC',
      text: '#0C4A6E',
      muted: '#4C6782',
    },
  },
  {
    id: 'emerald_mint',
    name: 'Hijau Zamrud & Mint',
    subtitle: 'Sejuk & Natural',
    description: 'Nuansa hijau zamrud utama, biru langit sekunder, dan aksen emas hangat untuk sorotan.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#E6F4EC',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#059669',
      header: '#FFFFFF',
      primary: '#059669',
      secondary: '#0284C7',
      accent: '#D97706',
      border: '#CCE5D6',
      text: '#064E3B',
      muted: '#426D55',
    },
  },
  {
    id: 'rose_blossom',
    name: 'Rose Berry & Blush',
    subtitle: 'Butik Parfum & Skincare',
    description: 'Kombinasi lembut blush pastel dengan utama rose berry, violet sekunder, dan aksen gold.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#FAE8EB',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#E11D48',
      header: '#FFFFFF',
      primary: '#E11D48',
      secondary: '#7C3AED',
      accent: '#D97706',
      border: '#F2CFD6',
      text: '#4C0519',
      muted: '#784754',
    },
  },
  {
    id: 'indigo_night',
    name: 'Malam Indigo',
    subtitle: 'Kontras Tinggi & Gelap Modern',
    description: 'Sidebar gelap pekat dipadu kontras kanvas bersih, aksen indigo cerah, dan cyan segar.',
    isDarkSidebar: true,
    swatches: {
      canvas: '#F5F6FB',
      surface: '#FFFFFF',
      sidebar: '#1E1B4B',
      sidebarActive: '#6366F1',
      header: '#FFFFFF',
      primary: '#4F46E5',
      secondary: '#0891B2',
      accent: '#F59E0B',
      border: '#E0E7FF',
      text: '#1E1B4B',
      muted: '#6B7280',
    },
  },
  {
    id: 'espresso_cream',
    name: 'Espresso & Krem',
    subtitle: 'Hangat & Elegan',
    description: 'Latar krem hangat berpadu utama espresso terakota, sage teal sekunder, dan aksen karamel.',
    isDarkSidebar: false,
    swatches: {
      canvas: '#F3ECE1',
      surface: '#FFFFFF',
      sidebar: '#FFFFFF',
      sidebarActive: '#9A3412',
      header: '#FFFFFF',
      primary: '#9A3412',
      secondary: '#0F766E',
      accent: '#D97706',
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

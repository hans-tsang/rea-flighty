import { useColorScheme } from 'react-native';

import type { DisplayStatus } from '../domain/status';

export interface Theme {
  dark: boolean;
  colors: {
    background: string;
    card: string;
    text: string;
    textMuted: string;
    border: string;
    accent: string;
    accentText: string;
    danger: string;
    warning: string;
    success: string;
    mockBanner: string;
    mockBannerText: string;
  };
}

const light: Theme = {
  dark: false,
  colors: {
    background: '#F2F4F7',
    card: '#FFFFFF',
    text: '#101828',
    textMuted: '#475467',
    border: '#D0D5DD',
    accent: '#1D4ED8',
    accentText: '#FFFFFF',
    danger: '#B42318',
    warning: '#B54708',
    success: '#067647',
    mockBanner: '#FEF0C7',
    mockBannerText: '#7A2E0E',
  },
};

const dark: Theme = {
  dark: true,
  colors: {
    background: '#0B1220',
    card: '#151E2E',
    text: '#F2F4F7',
    textMuted: '#A5B0C2',
    border: '#2B364A',
    accent: '#7EA6FF',
    accentText: '#0B1220',
    danger: '#FDA29B',
    warning: '#FEC84B',
    success: '#75E0A7',
    mockBanner: '#4E3A0A',
    mockBannerText: '#FEDF89',
  },
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function statusColor(theme: Theme, status: DisplayStatus): string {
  switch (status) {
    case 'cancelled':
    case 'diverted':
      return theme.colors.danger;
    case 'delayed':
    case 'unconfirmed':
      return theme.colors.warning;
    case 'on_time':
    case 'arrived':
    case 'landed':
    case 'departed':
      return theme.colors.success;
    default:
      return theme.colors.textMuted;
  }
}

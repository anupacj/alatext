import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppTheme = {
  id: string;
  name: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
  screenRadius?: number | string;
  isDark?: boolean;
};

export const THEMES: Record<string, AppTheme> = {
  sunset: {
    id: 'sunset',
    name: 'Sunset Espresso',
    background: '#181210',
    surface: '#221916',
    text: '#ffffff',
    textMuted: '#ad9c96',
    accent: '#f97316',
    border: '#322521',
    isDark: true,
  },
  dark: {
    id: 'dark',
    name: 'Discord Dark',
    background: '#313338',
    surface: '#2b2d31',
    text: '#ffffff',
    textMuted: '#b5bac1',
    accent: '#5865F2',
    border: '#1e1f22',
    isDark: true,
  },
  black: {
    id: 'black',
    name: 'AMOLED Black',
    background: '#000000',
    surface: '#000000',
    text: '#ffffff',
    textMuted: '#888888',
    accent: '#5865F2',
    border: '#222222',
    isDark: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Sapphire',
    background: '#090d16',
    surface: '#111827',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    accent: '#38bdf8',
    border: '#1e293b',
    isDark: true,
  },
  emerald: {
    id: 'emerald',
    name: 'Nordic Forest',
    background: '#0b1411',
    surface: '#13221d',
    text: '#f0fdf4',
    textMuted: '#6ee7b7',
    accent: '#10b981',
    border: '#1c332b',
    isDark: true,
  },
  lavender: {
    id: 'lavender',
    name: 'Dreamy Lavender',
    background: '#13101c',
    surface: '#1e192c',
    text: '#f5f3ff',
    textMuted: '#c4b5fd',
    accent: '#a855f7',
    border: '#2e2644',
    isDark: true,
  },
  light: {
    id: 'light',
    name: 'Clean Light',
    background: '#f2f3f5',
    surface: '#ffffff',
    text: '#060607',
    textMuted: '#4e5058',
    accent: '#5865F2',
    border: '#e3e5e8',
    isDark: false,
  },
  pink: {
    id: 'pink',
    name: 'Cherry Blossom',
    background: '#fdf2f8',
    surface: '#fce7f3',
    text: '#831843',
    textMuted: '#be185d',
    accent: '#db2777',
    border: '#fbcfe8',
    isDark: false,
  },
  hacker: {
    id: 'hacker',
    name: 'Hacker Terminal',
    background: '#0a0a0a',
    surface: '#111111',
    text: '#22c55e',
    textMuted: '#166534',
    accent: '#4ade80',
    border: '#14532d',
    isDark: true,
  },
};

const ThemeContext = createContext<{ theme: AppTheme; setTheme: (id: string) => void }>({ theme: THEMES.dark, setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState('dark');

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then(t => {
      if (t && THEMES[t]) setThemeId(t);
    });
  }, []);

  const changeTheme = (id: string) => {
    setThemeId(id);
    AsyncStorage.setItem('app_theme', id);
  };

  return <ThemeContext.Provider value={{ theme: THEMES[themeId] || THEMES.dark, setTheme: changeTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

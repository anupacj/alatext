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
};

export const THEMES: Record<string, AppTheme> = {
  dark: {
    id: 'dark', name: 'Discord Dark',
    background: '#313338', surface: '#2b2d31', text: '#ffffff', textMuted: '#b5bac1', accent: '#5865F2', border: '#1e1f22'
  },
  black: {
    id: 'black', name: 'AMOLED Black',
    background: '#000000', surface: '#000000', text: '#ffffff', textMuted: '#888888', accent: '#ffffff', border: '#000000'
  },
  light: {
    id: 'light', name: 'Clean Light',
    background: '#f2f3f5', surface: '#ffffff', text: '#060607', textMuted: '#4e5058', accent: '#5865F2', border: '#e3e5e8'
  },
  pink: {
    id: 'pink', name: 'Cherry Blossom',
    background: '#fdf2f8', surface: '#fce7f3', text: '#831843', textMuted: '#be185d', accent: '#db2777', border: '#fbcfe8'
  },
  hacker: {
    id: 'hacker', name: 'Hacker Terminal',
    background: '#0a0a0a', surface: '#111111', text: '#22c55e', textMuted: '#166534', accent: '#4ade80', border: '#14532d'
  }
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


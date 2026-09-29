import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { light, dark } from '../theme/colors';

const STORAGE_KEY = 'fu_ubra_theme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [scheme, setScheme] = useState(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') setScheme(stored);
    })();
  }, []);

  async function toggleTheme() {
    const next = scheme === 'dark' ? 'light' : 'dark';
    setScheme(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const colors = useMemo(() => (scheme === 'dark' ? dark : light), [scheme]);

  const value = useMemo(
    () => ({ colors, theme: scheme, isDark: scheme === 'dark', toggleTheme }),
    [colors, scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

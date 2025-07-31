import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Apply theme to document
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }

    // Update CSS custom properties for better integration
    const root = document.documentElement;
    if (isDark) {
      root.style.setProperty('--toaster-bg', '#1a1f2e');
      root.style.setProperty('--toaster-color', '#e2e8f0');
    } else {
      root.style.setProperty('--toaster-bg', '#ffffff');
      root.style.setProperty('--toaster-color', '#1f2937');
    }
  }, [isDark]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      // Only auto-switch if user hasn't manually set a preference
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        setIsDark(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const setTheme = (theme) => {
    setIsDark(theme === 'dark');
  };

  const getThemeColors = () => {
    return {
      primary: isDark ? '#3b82f6' : '#2563eb',
      secondary: isDark ? '#1a1f2e' : '#f8fafc',
      background: isDark ? '#0f1419' : '#ffffff',
      text: isDark ? '#e2e8f0' : '#1f2937',
      muted: isDark ? '#64748b' : '#6b7280',
      border: isDark ? '#2d3748' : '#e5e7eb',
      card: isDark ? '#1a1f2e' : '#ffffff',
      accent: isDark ? '#0ea5e9' : '#0369a1',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    };
  };

  const value = {
    isDark,
    theme: isDark ? 'dark' : 'light',
    toggleTheme,
    setTheme,
    getThemeColors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
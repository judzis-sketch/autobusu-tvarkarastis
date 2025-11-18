
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AccessibilityContextType {
  isLargeText: boolean;
  toggleLargeText: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider = ({ children }: { children: ReactNode }) => {
  const [isLargeText, setIsLargeText] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedValue = localStorage.getItem('large-text-mode');
    if (storedValue) {
      setIsLargeText(JSON.parse(storedValue));
    }
  }, []);

  const toggleLargeText = () => {
    if (isMounted) {
      const newValue = !isLargeText;
      setIsLargeText(newValue);
      localStorage.setItem('large-text-mode', JSON.stringify(newValue));
    }
  };

  const value = { isLargeText, toggleLargeText };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

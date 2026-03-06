import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface SidebarContextType {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  toggleExpanded: () => void;
  sidebarWidth: number;
}

const SidebarContext = createContext<SidebarContextType>({
  expanded: false,
  setExpanded: () => {},
  toggleExpanded: () => {},
  sidebarWidth: 56,
});

export function SidebarExpandedProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem('sidebar-expanded') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('sidebar-expanded', String(expanded));
  }, [expanded]);

  const toggleExpanded = () => setExpanded(prev => !prev);
  const sidebarWidth = expanded ? 208 : 56;

  return (
    <SidebarContext.Provider value={{ expanded, setExpanded, toggleExpanded, sidebarWidth }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarExpanded() {
  return useContext(SidebarContext);
}

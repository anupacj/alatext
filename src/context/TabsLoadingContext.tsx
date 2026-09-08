import React, { createContext, useContext, useState } from 'react';

type TabsLoadingContextType = {
  isTabsLoading: boolean;
  setIsTabsLoading: (loading: boolean) => void;
};

const TabsLoadingContext = createContext<TabsLoadingContextType>({
  isTabsLoading: true,
  setIsTabsLoading: () => {},
});

export const TabsLoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTabsLoading, setIsTabsLoading] = useState(true);
  return (
    <TabsLoadingContext.Provider value={{ isTabsLoading, setIsTabsLoading }}>
      {children}
    </TabsLoadingContext.Provider>
  );
};

export const useTabsLoading = () => useContext(TabsLoadingContext);

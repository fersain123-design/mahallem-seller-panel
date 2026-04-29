import React from 'react';

type SellerSearchContextValue = {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  clearQuery: () => void;
};

const SellerSearchContext = React.createContext<SellerSearchContextValue | undefined>(undefined);

export const SellerSearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [query, setQuery] = React.useState('');

  const value = React.useMemo(
    () => ({
      query,
      setQuery,
      clearQuery: () => setQuery(''),
    }),
    [query],
  );

  return <SellerSearchContext.Provider value={value}>{children}</SellerSearchContext.Provider>;
};

export const useSellerSearch = () => {
  const context = React.useContext(SellerSearchContext);
  if (!context) {
    throw new Error('useSellerSearch must be used within SellerSearchProvider');
  }
  return context;
};
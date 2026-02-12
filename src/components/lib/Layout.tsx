import React from 'react';

interface LayoutProps {
  type?: 'grid' | 'flex' | 'sidebar-layout';
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ type = 'grid', children }) => {
  const layouts = {
    grid: 'grid gap-4 sm:grid-cols-2',
    flex: 'flex flex-col gap-4',
    'sidebar-layout': 'grid gap-6 lg:grid-cols-[240px_1fr]',
  };

  return <div className={layouts[type]}>{children}</div>;
};

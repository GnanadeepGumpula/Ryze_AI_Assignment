import React from 'react';

interface LayoutProps {
  type?: 'grid' | 'flex' | 'sidebar-layout';
  children?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ type = 'grid', children }) => {
  const base = 'w-full min-w-0';
  const layouts = {
    grid: `${base} grid content-start items-start gap-4 sm:grid-cols-2`,
    flex: `${base} flex flex-col items-start gap-4`,
    'sidebar-layout': `${base} grid items-start gap-6 lg:grid-cols-[240px_1fr]`,
  };

  return <div className={layouts[type]}>{children}</div>;
};

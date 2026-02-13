import React from 'react';

interface NavbarProps {
  title: string;
  links?: string[];
  children?: React.ReactNode;
}

export const Navbar: React.FC<NavbarProps> = ({ title, links = [], children }) => {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="text-base font-semibold text-slate-900">{title}</div>
        {links.length > 0 ? (
          <nav className="hidden items-center gap-3 text-sm text-slate-600 sm:flex">
            {links.map((link) => (
              <span key={link} className="rounded-full bg-slate-100 px-3 py-1">
                {link}
              </span>
            ))}
          </nav>
        ) : null}
      </div>
      {children ? <div className="flex items-center gap-3">{children}</div> : null}
    </header>
  );
};

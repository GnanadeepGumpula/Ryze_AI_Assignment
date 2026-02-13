import React from 'react';

interface SidebarProps {
  title: string;
  items: string[];
  footer?: string;
  children?: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ title, items, footer, children }) => {
  return (
    <aside className="flex h-full flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</div>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item} className="rounded-lg bg-slate-100 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </div>
      {children ? <div className="flex flex-col gap-3">{children}</div> : null}
      {footer ? <div className="mt-auto text-xs text-slate-500">{footer}</div> : null}
    </aside>
  );
};

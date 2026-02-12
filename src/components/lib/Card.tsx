import React from 'react';

interface CardProps {
  title: string;
  description?: string;
  content?: string;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, description, content, children }) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      </header>
      {content ? <p className="mt-4 text-sm text-slate-700">{content}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
};

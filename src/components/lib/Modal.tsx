import React from 'react';

interface ModalProps {
  title: string;
  description?: string;
  isOpen?: boolean;
  children?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ title, description, isOpen = true, children }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <header className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description ? <p className="text-sm text-slate-600">{description}</p> : null}
        </header>
        {children ? <div className="mt-4 space-y-3">{children}</div> : null}
      </div>
    </div>
  );
};

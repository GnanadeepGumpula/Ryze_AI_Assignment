import React, { useId } from 'react';

interface InputProps {
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
}

export const Input: React.FC<InputProps> = ({ label, placeholder, type = 'text' }) => {
  const inputId = useId();

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700" htmlFor={inputId}>
      {label}
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </label>
  );
};

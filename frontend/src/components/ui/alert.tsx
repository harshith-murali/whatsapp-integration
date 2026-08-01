import React from "react";

export const Alert: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div
    role="alert"
    className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-lg border border-slate-200 bg-white p-4 text-slate-950 shadow-xs dark:border-tail-dark-border dark:bg-tail-dark-card dark:text-white ${className}`}
    {...props}
  >
    {children}
  </div>
);

export const AlertTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <h5 className={`text-sm font-semibold leading-none tracking-tight ${className}`} {...props}>
    {children}
  </h5>
);

export const AlertDescription: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400 ${className}`} {...props}>
    {children}
  </div>
);

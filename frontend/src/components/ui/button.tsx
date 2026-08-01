import React from "react";

type ButtonVariant = "default" | "secondary" | "ghost" | "destructive" | "outline";
type ButtonSize = "default" | "sm" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-indigo-600 text-white shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-950/60",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
  destructive: "bg-rose-600 text-white shadow-md hover:bg-rose-700 disabled:bg-rose-300 dark:disabled:bg-rose-950/60",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-tail-dark-border dark:bg-tail-dark-card dark:text-slate-300 dark:hover:bg-slate-800",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-8 px-3 text-xs",
  icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant, size, type = "button", ...props }, ref) => {
    const resolvedVariant = variant ?? (className ? null : "default");
    const resolvedSize = size ?? (className ? null : "default");

    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-60 ${
          resolvedVariant ? variantClasses[resolvedVariant] : ""
        } ${resolvedSize ? sizeClasses[resolvedSize] : ""} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

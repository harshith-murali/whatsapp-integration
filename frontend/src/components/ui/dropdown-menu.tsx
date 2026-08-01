import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

const useDropdownMenu = () => {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("Dropdown menu components must be used inside DropdownMenu.");
  }
  return context;
};

export const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

type DropdownMenuTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  render?: React.ReactElement;
};

export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({
  children,
  className = "",
  render,
  ...props
}) => {
  const { open, setOpen } = useDropdownMenu();

  if (render) {
    return React.cloneElement(render as React.ReactElement<Record<string, unknown>>, {
      onClick: () => setOpen(!open),
      "aria-expanded": open,
      ...props,
    });
  }

  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
};

type DropdownMenuContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end";
  side?: "bottom" | "top";
};

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  children,
  className = "",
  align = "start",
  side = "bottom",
  ...props
}) => {
  const { open } = useDropdownMenu();

  if (!open) return null;

  return (
    <div
      className={`absolute z-[80] rounded-lg border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10 dark:border-tail-dark-border dark:bg-tail-dark-card ${
        align === "end" ? "right-0" : "left-0"
      } ${side === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="py-1">{children}</div>
);

export const DropdownMenuLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div className={`px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 ${className}`}>
    {children}
  </div>
);

export const DropdownMenuSeparator: React.FC = () => (
  <div className="my-1 h-px bg-slate-100 dark:bg-tail-dark-border" />
);

type DropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onSelect?: () => void;
};

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  children,
  className = "",
  onSelect,
  onClick,
  disabled,
  ...props
}) => {
  const { setOpen } = useDropdownMenu();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        onSelect?.();
        setOpen(false);
      }}
      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 disabled:pointer-events-none disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const DropdownMenuShortcut: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <span className={`ml-auto text-xs text-slate-400 ${className}`}>{children}</span>;

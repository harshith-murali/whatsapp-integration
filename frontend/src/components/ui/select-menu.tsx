import React from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

export type SelectMenuOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

interface SelectMenuProps {
  value: string;
  options: SelectMenuOption[];
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  align?: "start" | "end";
  side?: "bottom" | "top";
}

export const SelectMenu: React.FC<SelectMenuProps> = ({
  value,
  options,
  onValueChange,
  label,
  placeholder = "Select...",
  disabled = false,
  className = "",
  contentClassName = "",
  align = "start",
  side = "bottom",
}) => {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={`flex h-[42px] w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm font-medium text-slate-700 transition-colors hover:border-indigo-200 hover:bg-white focus:border-indigo-500 focus:bg-white focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-slate-300 dark:hover:bg-tail-dark-card dark:focus:bg-tail-dark-bg ${className}`}
      >
        <span className="min-w-0 truncate">{selected?.label || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className={`max-h-72 min-w-full overflow-y-auto ${contentClassName}`} align={align} side={side}>
        {label && (
          <>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              disabled={option.disabled}
              onSelect={() => onValueChange(option.value)}
              className={option.value === value ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300" : ""}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.value === value && <Check className="h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

import React from "react";

interface BorderTrailProps {
  className?: string;
}

export const BorderTrail: React.FC<BorderTrailProps> = ({ className = "" }) => {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${className}`}
    >
      <span className="absolute h-20 w-20 animate-border-trail rounded-full bg-indigo-400/25 blur-xl dark:bg-indigo-300/25" />
    </span>
  );
};

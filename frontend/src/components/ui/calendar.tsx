import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button.js";

interface CalendarProps {
  selected?: string;
  onSelect: (date: string) => void;
}

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDate = (value?: string) => {
  if (!value) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const Calendar: React.FC<CalendarProps> = ({ selected, onSelect }) => {
  const selectedDate = parseDate(selected);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const days = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const startOffset = firstDay.getDay();
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const selectedValue = selected || "";
  const currentMonth = visibleMonth.getMonth();

  return (
    <div className="w-[286px] rounded-lg bg-white p-3 dark:bg-tail-dark-card">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          onClick={() => moveMonth(-1)}
          className="h-8 w-8 rounded-md p-0 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-bold text-slate-900 dark:text-white">
          {monthFormatter.format(visibleMonth)}
        </p>
        <Button
          type="button"
          onClick={() => moveMonth(1)}
          className="h-8 w-8 rounded-md p-0 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-slate-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((date) => {
          const value = toInputDate(date);
          const isSelected = value === selectedValue;
          const isMuted = date.getMonth() !== currentMonth;
          const isToday = value === toInputDate(new Date());

          return (
            <Button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              className={`h-9 rounded-md p-0 text-sm font-semibold ${
                isSelected
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : isToday
                    ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              } ${isMuted && !isSelected ? "text-slate-300 dark:text-slate-600" : ""}`}
            >
              {date.getDate()}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

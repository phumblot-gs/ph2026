"use client";

import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxDate?: Date;
  minDate?: Date;
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Sélectionner une date",
  maxDate = new Date(),
  minDate = new Date(1900, 0, 1),
}: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [month, setMonth] = React.useState<Date>(
    value ? new Date(value) : new Date(2000, 0)
  );

  React.useEffect(() => {
    if (value) {
      const newDate = new Date(value);
      setDate(newDate);
      setMonth(newDate);
    } else {
      setDate(undefined);
      setMonth(new Date(2000, 0));
    }
  }, [value]);

  const handleSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      // Format as YYYY-MM-DD in local timezone to avoid timezone issues
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      const formatted = `${year}-${month}-${day}`;
      onChange(formatted);
    } else {
      onChange('');
    }
  };

  const handleYearChange = (year: string) => {
    const newMonth = new Date(month);
    newMonth.setFullYear(parseInt(year));
    setMonth(newMonth);
  };

  const handleMonthChange = (monthIndex: string) => {
    const newMonth = new Date(month);
    newMonth.setMonth(parseInt(monthIndex));
    setMonth(newMonth);
  };

  // Generate year options
  const currentYear = new Date().getFullYear();
  const startYear = minDate.getFullYear();
  const endYear = maxDate.getFullYear();
  const years = [];
  for (let year = endYear; year >= startYear; year--) {
    years.push(year);
  }

  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative">
          <Button
            type="button"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal pl-10",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            {date ? format(date, "dd MMMM yyyy", { locale: fr }) : <span>{placeholder}</span>}
          </Button>
          <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          {/* Year and Month Selectors */}
          <div className="flex justify-between gap-2 mb-3">
            <Select
              value={month.getFullYear().toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select
              value={month.getMonth().toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Mois" />
              </SelectTrigger>
              <SelectContent>
                {months.map((monthName, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {monthName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Calendar */}
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            disabled={(date) => {
              if (maxDate && date > maxDate) return true;
              if (minDate && date < minDate) return true;
              return false;
            }}
            locale={fr}
            className="rounded-md border-0"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
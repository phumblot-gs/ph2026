'use client';

import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
  id?: string;
}

export function DateInput({
  value,
  onChange,
  disabled = false,
  required = false,
  label,
  placeholder,
  min,
  max,
  className,
  id = "date"
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIconClick = () => {
    if (inputRef.current && !disabled) {
      inputRef.current.showPicker?.();
      inputRef.current.focus();
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        className={cn(
          "pl-10",
          // Hide the native calendar icon
          "[&::-webkit-calendar-picker-indicator]:opacity-0",
          "[&::-webkit-calendar-picker-indicator]:absolute",
          "[&::-webkit-calendar-picker-indicator]:left-0",
          "[&::-webkit-calendar-picker-indicator]:w-full",
          "[&::-webkit-calendar-picker-indicator]:h-full",
          "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
          className
        )}
      />
      <button
        type="button"
        onClick={handleIconClick}
        disabled={disabled}
        className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors"
        tabIndex={-1}
      >
        <Calendar className="h-4 w-4" />
      </button>
    </div>
  );
}
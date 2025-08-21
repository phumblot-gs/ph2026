'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, AlertCircle } from 'lucide-react';
import { parsePhoneNumber, isValidPhoneNumber, formatPhoneNumberIntl, AsYouType } from 'libphonenumber-js';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
  error?: string;
}

export function PhoneInput({
  value,
  onChange,
  disabled = false,
  required = false,
  label,
  placeholder = "06 12 34 56 78 ou +33 6 12 34 56 78",
  error
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [focused, setFocused] = useState(false);

  // Format initial value
  useEffect(() => {
    if (value && !focused) {
      try {
        // Try to parse and format the phone number
        if (isValidPhoneNumber(value, 'FR')) {
          const phoneNumber = parsePhoneNumber(value, 'FR');
          setDisplayValue(phoneNumber.formatNational());
        } else {
          setDisplayValue(value);
        }
      } catch {
        setDisplayValue(value);
      }
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Use AsYouType formatter for real-time formatting
    const formatter = new AsYouType('FR');
    const formatted = formatter.input(input);
    setDisplayValue(formatted);
    
    // Clean the number for storage (international format)
    try {
      if (input.length > 5) {
        // Check if it's a valid phone number
        const isValid = isValidPhoneNumber(input, 'FR');
        setIsValid(isValid);
        
        if (isValid) {
          const phoneNumber = parsePhoneNumber(input, 'FR');
          // Store in international format
          onChange(phoneNumber.format('E.164'));
        } else {
          onChange(input);
        }
      } else {
        onChange(input);
        setIsValid(true); // Don't show error for short inputs
      }
    } catch {
      onChange(input);
      setIsValid(true);
    }
  };

  const handleBlur = () => {
    setFocused(false);
    
    // Final validation and formatting on blur
    if (displayValue) {
      try {
        if (isValidPhoneNumber(displayValue, 'FR')) {
          const phoneNumber = parsePhoneNumber(displayValue, 'FR');
          setDisplayValue(phoneNumber.formatNational());
          onChange(phoneNumber.format('E.164'));
          setIsValid(true);
        } else if (displayValue.length > 5) {
          setIsValid(false);
        }
      } catch {
        if (displayValue.length > 5) {
          setIsValid(false);
        }
      }
    }
  };

  const showError = !isValid && displayValue.length > 5;

  return (
    <div>
      <div className="relative">
        <Input
          id="phone"
          type="tel"
          value={displayValue}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`pl-10 ${showError ? 'border-red-500 focus:ring-red-500' : ''}`}
        />
        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        {showError && (
          <AlertCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
        )}
      </div>
      
      {/* Helper text area with fixed height to prevent layout shift */}
      <div className="h-4 mt-1">
        {showError && (
          <p className="text-xs text-red-500 flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            Numéro invalide
          </p>
        )}
        {error && !showError && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        {!showError && !error && focused && displayValue && (
          <p className="text-xs text-gray-500">
            Formats : 06 12 34 56 78, +33 6 12 34 56 78
          </p>
        )}
      </div>
    </div>
  );
}
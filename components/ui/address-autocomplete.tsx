'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2, X } from 'lucide-react';
import { autocompleteAddress, getPlaceDetails, parseAddressComponents } from '@/lib/google/places-client';
import type { GooglePlacePrediction } from '@/lib/types/donations';

interface AddressAutocompleteProps {
  onAddressSelect: (address: {
    address_line1: string;
    address_line2?: string;
    postal_code: string;
    city: string;
    country: string;
    google_place_id?: string;
  }) => void;
  initialValue?: string;
  initialAddress?: {
    address_line1?: string;
    postal_code?: string;
    city?: string;
  };
  initialPlaceId?: string;
  disabled?: boolean;
  required?: boolean;
}

export function AddressAutocomplete({
  onAddressSelect,
  initialValue = '',
  initialAddress,
  initialPlaceId,
  disabled = false,
  required = false,
}: AddressAutocompleteProps) {
  // Initialize with a temporary loading state
  const [inputValue, setInputValue] = useState<string>('');
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load initial address from google_place_id if provided - only once on mount
  useEffect(() => {
    if (isInitialized) return; // Prevent multiple loads
    
    const loadInitialAddress = async () => {
      if (initialPlaceId && initialPlaceId !== '') {
        setLoading(true);
        try {
          const details = await getPlaceDetails(initialPlaceId);
          if (details && details.formatted_address) {
            setInputValue(details.formatted_address);
          }
        } catch (error) {
          console.error('Error loading initial address:', error);
          // Fallback to address components if place_id fails
          if (initialAddress?.address_line1) {
            const parts = [
              initialAddress.address_line1,
              initialAddress.postal_code,
              initialAddress.city
            ].filter(Boolean);
            setInputValue(parts.join(', '));
          }
        } finally {
          setLoading(false);
        }
      } else if (initialValue) {
        setInputValue(initialValue);
      } else if (initialAddress?.address_line1) {
        const parts = [
          initialAddress.address_line1,
          initialAddress.postal_code,
          initialAddress.city
        ].filter(Boolean);
        const addressString = parts.join(', ');
        setInputValue(addressString);
      }
      setIsInitialized(true);
    };

    loadInitialAddress();
  }, []); // Empty dependency array - only run once on mount

  // Track if user has manually changed the input
  const [userHasTyped, setUserHasTyped] = useState(false);

  // Debounced search
  useEffect(() => {
    // Don't search if input is too short or if user hasn't typed
    if (!userHasTyped || !inputValue || inputValue.length < 3) {
      setPredictions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await autocompleteAddress(inputValue);
        setPredictions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error('Error fetching predictions:', error);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, userHasTyped]);

  const handleSelectPrediction = useCallback(async (prediction: GooglePlacePrediction) => {
    setInputValue(prediction.description);
    setShowSuggestions(false);
    setPredictions([]);
    setUserHasTyped(false); // Reset to prevent re-triggering search
    
    // Get full place details
    const details = await getPlaceDetails(prediction.place_id);
    if (details) {
      const parsed = parseAddressComponents(details.address_components);
      onAddressSelect({
        ...parsed,
        google_place_id: prediction.place_id,
      });
    }
  }, [onAddressSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && predictions[selectedIndex]) {
          handleSelectPrediction(predictions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  return (
    <div className="relative">
      <Label htmlFor="address">
        Adresse
      </Label>
      <div className="relative mt-1">
        <Input
          id="address"
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setUserHasTyped(true);
            // If the user clears the field, notify parent to clear address data
            if (e.target.value === '') {
              onAddressSelect({
                address_line1: '',
                address_line2: '',
                postal_code: '',
                city: '',
                country: '',
                google_place_id: ''
              });
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => userHasTyped && predictions.length > 0 && setShowSuggestions(true)}
          placeholder="Commencez à taper votre adresse..."
          disabled={disabled}
          required={required}
          className={`pl-10 ${inputValue ? 'pr-10' : ''}`}
        />
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        {inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              setUserHasTyped(true);
              onAddressSelect({
                address_line1: '',
                address_line2: '',
                postal_code: '',
                city: '',
                country: '',
                google_place_id: ''
              });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>
      
      {showSuggestions && predictions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              className={`w-full text-left px-4 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
                index === selectedIndex ? 'bg-gray-50' : ''
              }`}
              onClick={() => handleSelectPrediction(prediction)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-start">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">
                    {prediction.structured_formatting.main_text}
                  </div>
                  <div className="text-xs text-gray-500">
                    {prediction.structured_formatting.secondary_text}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
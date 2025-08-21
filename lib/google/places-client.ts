// Client-side functions for Google Places API
// These functions call our API routes instead of Google directly

import type { GooglePlaceResult, GooglePlacePrediction } from '@/lib/types/donations';

export const getGooglePlacesApiKey = () => {
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key || key === 'YOUR_GOOGLE_PLACES_API_KEY') {
    console.warn('Google Places API key not configured');
    return null;
  }
  return key;
};

// Autocomplete for address input
export async function autocompleteAddress(input: string): Promise<GooglePlacePrediction[]> {
  if (!input || input.length < 3) {
    return [];
  }

  try {
    const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Autocomplete error:', data.error);
      return [];
    }
    
    return data.predictions.map((prediction: any) => ({
      place_id: prediction.place_id,
      description: prediction.description,
      structured_formatting: {
        main_text: prediction.structured_formatting?.main_text || '',
        secondary_text: prediction.structured_formatting?.secondary_text || '',
      },
    }));
  } catch (error) {
    console.error('Error fetching address predictions:', error);
    return [];
  }
}

// Get full address details from place ID
export async function getPlaceDetails(placeId: string): Promise<GooglePlaceResult | null> {
  try {
    const response = await fetch(`/api/places/details?place_id=${encodeURIComponent(placeId)}`);
    const data = await response.json();
    
    if (data.error) {
      console.error('Place details error:', data.error);
      return null;
    }
    
    const result = data.result;
    return {
      place_id: placeId,
      formatted_address: result.formatted_address || '',
      address_components: result.address_components || [],
      geometry: result.geometry || { location: { lat: 0, lng: 0 } },
    };
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

// Parse address components to extract structured data
export function parseAddressComponents(components: GooglePlaceResult['address_components']) {
  const parsed = {
    street_number: '',
    route: '',
    postal_code: '',
    city: '',
    country: '',
  };

  for (const component of components) {
    const types = component.types;

    if (types.includes('street_number')) {
      parsed.street_number = component.long_name;
    } else if (types.includes('route')) {
      parsed.route = component.long_name;
    } else if (types.includes('postal_code')) {
      parsed.postal_code = component.long_name;
    } else if (types.includes('locality')) {
      parsed.city = component.long_name;
    } else if (types.includes('country')) {
      parsed.country = component.long_name;
    }
  }

  return {
    address_line1: `${parsed.street_number} ${parsed.route}`.trim(),
    postal_code: parsed.postal_code,
    city: parsed.city,
    country: parsed.country,
  };
}

// Validate if address is in France
export function validateFrenchAddress(addressComponents: GooglePlaceResult['address_components']): boolean {
  const countryComponent = addressComponents.find(component => 
    component.types.includes('country')
  );
  
  return countryComponent?.short_name === 'FR' || countryComponent?.long_name === 'France';
}

// Client-side address validation
export async function validateAddress(address: {
  address_line1: string;
  postal_code: string;
  city: string;
  country: string;
}): Promise<{ valid: boolean; message?: string }> {
  // Basic validation
  if (!address.address_line1 || !address.postal_code || !address.city || !address.country) {
    return { valid: false, message: 'Tous les champs d\'adresse sont requis' };
  }

  // Check country is France
  if (address.country !== 'France' && address.country !== 'FR') {
    return { valid: false, message: 'Seules les adresses en France sont acceptées' };
  }

  // Validate postal code format (5 digits for France)
  if (!/^\d{5}$/.test(address.postal_code)) {
    return { valid: false, message: 'Le code postal doit contenir 5 chiffres' };
  }

  return { valid: true };
}
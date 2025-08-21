import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get('input');
  
  if (!input) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  
  if (!apiKey || apiKey === 'YOUR_GOOGLE_PLACES_API_KEY') {
    return NextResponse.json({ 
      error: 'Google Places API not configured',
      predictions: [] 
    }, { status: 500 });
  }

  try {
    // Using Places Autocomplete API - requires enabling "Places API" in Google Cloud Console
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
      `input=${encodeURIComponent(input)}` +
      `&components=country:fr` +
      `&types=address` +
      `&language=fr` +
      `&key=${apiKey}`
    );

    const data = await response.json();
    
    // Check for API not enabled error
    if (data.error_message && data.error_message.includes('API') && data.error_message.includes('not enabled')) {
      console.error('Places API not enabled:', data.error_message);
      return NextResponse.json({
        error: 'Google Places API n\'est pas activée. Veuillez activer "Places API" dans Google Cloud Console.',
        predictions: []
      }, { status: 500 });
    }
    
    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return NextResponse.json({
        predictions: data.predictions || []
      });
    } else if (data.status === 'REQUEST_DENIED') {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json({
        error: data.error_message || 'Clé API invalide ou API non activée',
        predictions: []
      }, { status: 403 });
    } else {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json({
        error: data.error_message || 'API error',
        predictions: []
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error calling Google Places API:', error);
    return NextResponse.json({
      error: 'Failed to fetch suggestions',
      predictions: []
    }, { status: 500 });
  }
}
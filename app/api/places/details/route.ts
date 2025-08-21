import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const placeId = searchParams.get('place_id');
  
  if (!placeId) {
    return NextResponse.json({ error: 'Place ID required' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  
  if (!apiKey || apiKey === 'YOUR_GOOGLE_PLACES_API_KEY') {
    return NextResponse.json({ 
      error: 'Google Places API not configured' 
    }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?` +
      `place_id=${encodeURIComponent(placeId)}` +
      `&fields=formatted_address,address_components,geometry` +
      `&language=fr` +
      `&key=${apiKey}`
    );

    const data = await response.json();
    
    if (data.status === 'OK') {
      return NextResponse.json({
        result: data.result
      });
    } else {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json({
        error: data.error_message || 'API error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error calling Google Places API:', error);
    return NextResponse.json({
      error: 'Failed to fetch place details'
    }, { status: 500 });
  }
}
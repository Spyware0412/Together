import { NextRequest, NextResponse } from 'next/server';

const TENOR_API_KEY = process.env.TENOR_API_KEY;
const TENOR_API_URL = 'https://tenor.googleapis.com/v2';

// Caching to reduce API calls for trending GIFs
const cache = {
  trending: null as any,
  timestamp: 0,
};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const pos = searchParams.get('pos');

  if (!TENOR_API_KEY) {
    return NextResponse.json({ error: 'Tenor API key is not configured' }, { status: 500 });
  }

  let url;
  if (query) {
    url = `${TENOR_API_URL}/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20`;
    if (pos) url += `&pos=${pos}`;
  } else {
    // Check cache for trending GIFs
    if (Date.now() - cache.timestamp < CACHE_DURATION && cache.trending) {
        return NextResponse.json(cache.trending);
    }
    url = `${TENOR_API_URL}/featured?key=${TENOR_API_KEY}&limit=20`;
    if (pos) url += `&pos=${pos}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errorData = await res.json();
      console.error('Tenor API error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch from Tenor API' }, { status: res.status });
    }
    const data = await res.json();

    const formattedGifs = data.results.map((gif: any) => ({
      id: gif.id,
      url: gif.media_formats.gif.url,
      preview: gif.media_formats.tinygif.url,
      dims: gif.media_formats.tinygif.dims,
    }));
    
    const responsePayload = {
      gifs: formattedGifs,
      next: data.next || null,
    };

    // Cache trending results
    if (!query) {
      cache.trending = responsePayload;
      cache.timestamp = Date.now();
    }

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error('Error fetching from Tenor:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

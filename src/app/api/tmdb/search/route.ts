
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const apiKey = process.env.TMDB_API_KEY;

    if (!query) {
        return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    if (!apiKey) {
        console.error('TMDb API key is not configured.');
        return NextResponse.json({ error: 'TMDb API key is not configured' }, { status: 500 });
    }

    try {
        const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            }
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error("TMDb search failed:", res.status, errorText);
            return NextResponse.json({ error: 'Failed to fetch from TMDb' }, { status: res.status });
        }

        const data = await res.json();
        
        // Filter and format the results
        const formattedResults = data.results.map((movie: any) => ({
            id: movie.id,
            title: movie.title,
            release_date: movie.release_date,
            poster_path: movie.poster_path
        }));

        return NextResponse.json(formattedResults);

    } catch (error) {
        console.error('Error fetching from TMDb:', error);
        return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
    }
}

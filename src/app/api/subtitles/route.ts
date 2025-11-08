
import { NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY!;

// Helper to search OpenSubtitles and process results
async function searchAndProcessSubtitles(searchParams: URLSearchParams) {
  const osRes = await fetch(
    `https://api.opensubtitles.com/api/v1/subtitles?${searchParams.toString()}`,
    {
      headers: {
        "Api-Key": OPENSUBTITLES_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  if (!osRes.ok) {
    // This is not a fatal error, just means this search method failed.
    console.error(`OpenSubtitles search failed with params: ${searchParams.toString()}`);
    return [];
  }

  const result = await osRes.json();

  if (!result.data || result.data.length === 0) {
    return [];
  }

  // Find the download link for the first file of each subtitle result
  const subtitles = result.data.map((sub: any) => {
    const firstFile = sub.attributes.files?.[0];
    if (!firstFile) return null;

    return {
      language: sub.attributes.language,
      fileName: firstFile.file_name || sub.attributes.feature_details.movie_name,
      url: `/api/subtitles/download?file_id=${firstFile.file_id}`, // We will use a proxy to download
    };
  }).filter((sub: any) => sub !== null);

  return subtitles;
}


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tmdbId = searchParams.get("tmdb_id");

    if (!tmdbId) {
      return NextResponse.json({ error: "Missing tmdb_id" }, { status: 400 });
    }

    // 1. Get movie details from TMDB to find the imdb_id
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}`,
       {
        headers: {
            'Authorization': `Bearer ${TMDB_API_KEY}`,
            'Accept': 'application/json'
        }
      }
    );

    if (!tmdbRes.ok) {
      const errorText = await tmdbRes.text();
      console.error("TMDB error:", errorText);
      return NextResponse.json({ error: "Failed to fetch movie details from TMDB" }, { status: tmdbRes.status });
    }

    const tmdbData = await tmdbRes.json();
    const imdbId = tmdbData.imdb_id?.replace("tt", "");

    let subtitles = [];
    const searchMethods = [
      imdbId ? { imdb_id: imdbId } : null,
      { tmdb_id: tmdbId }
    ].filter(Boolean);


    // 2. First attempt: Search for English subtitles specifically
    for (const method of searchMethods) {
        const osSearchParams = new URLSearchParams({ ...method, languages: 'en' });
        subtitles = await searchAndProcessSubtitles(osSearchParams);
        if (subtitles.length > 0) break; // Found English subs, no need to check other methods
    }

    // 3. Fallback: If no English subtitles were found, search for any language
    if (subtitles.length === 0) {
      console.log(`No English subtitles found, fallback to any language for: ${tmdbId}`);
      for (const method of searchMethods) {
          const osSearchParams = new URLSearchParams(method!);
          subtitles = await searchAndProcessSubtitles(osSearchParams);
          if (subtitles.length > 0) break; // Found some subs, no need to check other methods
      }
    }
    
    // De-duplicate subtitles based on language
    const uniqueSubtitles = Array.from(new Map(subtitles.map(sub => [sub.language, sub])).values());

    return NextResponse.json(uniqueSubtitles);

  } catch (error: any) {
    console.error("Error in /api/subtitles:", error);
    return NextResponse.json({ error: error.message || "An internal error occurred." }, { status: 500 });
  }
}

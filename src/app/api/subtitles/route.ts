
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
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
    );

    if (!tmdbRes.ok) {
      return NextResponse.json({ error: "Failed to fetch movie details from TMDB" }, { status: tmdbRes.status });
    }

    const tmdbData = await tmdbRes.json();
    const imdbId = tmdbData.imdb_id;

    let subtitles = [];

    // 2. First attempt: Search OpenSubtitles using IMDb ID (if it exists)
    if (imdbId) {
      const imdbNumericId = imdbId.replace("tt", "");
      const osSearchParams = new URLSearchParams({ imdb_id: imdbNumericId });
      subtitles = await searchAndProcessSubtitles(osSearchParams);
    }

    // 3. Fallback: If no subtitles were found with IMDb ID, search using TMDb ID
    if (subtitles.length === 0) {
      console.log(`Fallback to tmdb_id search for: ${tmdbId}`);
      const osSearchParams = new URLSearchParams({ tmdb_id: tmdbId });
      subtitles = await searchAndProcessSubtitles(osSearchParams);
    }
    
    // De-duplicate subtitles based on language
    const uniqueSubtitles = Array.from(new Map(subtitles.map(sub => [sub.language, sub])).values());

    return NextResponse.json(uniqueSubtitles);

  } catch (error: any) {
    console.error("Error in /api/subtitles:", error);
    return NextResponse.json({ error: error.message || "An internal error occurred." }, { status: 500 });
  }
}

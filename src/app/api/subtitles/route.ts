
import { NextResponse } from "next/server";

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY!;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tmdbId = searchParams.get("tmdb_id");

    if (!tmdbId) {
      return NextResponse.json({ error: "Missing tmdb_id" }, { status: 400 });
    }

    // 1. Get IMDB ID from TMDB
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
    );

    if (!tmdbRes.ok) {
      throw new Error("Failed to fetch movie details from TMDB");
    }

    const tmdbData = await tmdbRes.json();
    let imdbId: string = tmdbData.imdb_id;

    if (!imdbId) {
      return NextResponse.json({ error: "No imdb_id found for this TMDB ID" }, { status: 404 });
    }

    // 2. Convert IMDB ID → numeric only
    const imdbNumericId = imdbId.replace("tt", ""); // e.g. tt0133093 → 0133093

    // 3. Use IMDB numeric ID with OpenSubtitles
    const osRes = await fetch(
      `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdbNumericId}`,
      {
        headers: {
          "Api-Key": OPENSUBTITLES_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!osRes.ok) {
      throw new Error("Failed to fetch subtitles from OpenSubtitles");
    }

    const subtitles = await osRes.json();

    return NextResponse.json({ imdbId, imdbNumericId, subtitles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

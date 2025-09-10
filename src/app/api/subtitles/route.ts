import { NextResponse } from "next/server";

interface SubtitleFile {
  file_id: number;
  file_name: string;
}

interface SubtitleAttributes {
  language: string;
  files: SubtitleFile[];
  feature_details: {
    movie_name: string;
    year: number;
  }
}

interface SubtitleData {
  id: string;
  attributes: SubtitleAttributes;
}

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return NextResponse.json({ error: "Query parameter is missing" }, { status: 400 });

  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (!apiKey) {
    console.error("OpenSubtitles API key not found. Please set OPENSUBTITLES_API_KEY in your .env file.");
    return NextResponse.json(
      { error: "Server configuration error: Missing API Key." },
      { status: 500 }
    );
  }

  const cacheKey = `subtitles:${query}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedResult.data);
  }

  try {
    const res = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(query)}`, {
      headers: { "Api-Key": apiKey, "Accept": "application/json" }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("OpenSubtitles API Error:", res.status, errorText);
        return NextResponse.json({ error: `Failed to fetch from OpenSubtitles API: ${res.statusText}` }, { status: res.status });
    }

    const data = await res.json();

    const subtitleDownloadPromises = (data.data || []).map(async (s: SubtitleData) => {
        const fileId = s.attributes.files[0]?.file_id;
        if (!fileId) return null;

        const downloadRes = await fetch("https://api.opensubtitles.com/api/v1/download", {
            method: "POST",
            headers: {
                "Api-Key": apiKey,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ file_id: fileId })
        });
        
        if (!downloadRes.ok) return null;
        
        const downloadData = await downloadRes.json();

        return {
            language: s.attributes.language,
            url: downloadData.link,
            movieName: s.attributes.feature_details?.movie_name || s.attributes.files[0]?.file_name || 'Unknown Title',
            fileName: s.attributes.files[0]?.file_name || 'Unknown file'
        };
    });

    const settledSubs = await Promise.allSettled(subtitleDownloadPromises);

    const successfulSubs = settledSubs
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value);

    // Prefer English first
    let filteredSubs = successfulSubs.filter((s) => s.language === "en");

    // fallback if no English found
    if (filteredSubs.length === 0) {
      filteredSubs = successfulSubs;
    }

    cache.set(cacheKey, { data: filteredSubs, timestamp: Date.now() });
    return NextResponse.json(filteredSubs);

  } catch (err) {
    console.error("Error fetching subtitles:", err);
    return NextResponse.json({ error: "Internal server error while fetching subtitles." }, { status: 500 });
  }
}

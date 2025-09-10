import { NextResponse } from "next/server";

interface SubtitleFile {
  file_id: number;
  file_name: string;
}

interface OpenSubtitleAttributes {
  language: string;
  files: SubtitleFile[];
  feature_details: {
    movie_name: string;
    year: number;
  }
}

interface OpenSubtitleData {
  id: string;
  attributes: OpenSubtitleAttributes;
}

interface WyzieSubtitle {
    language: string;
    url: string;
    release: string;
    source: string;
}

interface UnifiedSubtitle {
    language: string;
    url: string;
    movieName: string;
    fileName: string;
    source: 'opensubtitles' | 'wyzie';
}

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function fetchFromOpenSubtitles(query: string, apiKey: string): Promise<UnifiedSubtitle[]> {
    const res = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(query)}`, {
      headers: { "Api-Key": apiKey, "Accept": "application/json" }
    });

    if (!res.ok) {
        console.error("OpenSubtitles API Error:", res.status, await res.text());
        return [];
    }
    
    const data = await res.json();
    
    const subtitleDownloadPromises = (data.data || []).map(async (s: OpenSubtitleData) => {
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
            fileName: s.attributes.files[0]?.file_name || 'Unknown file',
            source: 'opensubtitles' as const
        };
    });

    const settledSubs = await Promise.allSettled(subtitleDownloadPromises);
    return settledSubs
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<any>).value);
}

async function fetchFromWyzie(query: string): Promise<UnifiedSubtitle[]> {
    const res = await fetch(`https://subs.wyz.ie/v1/search.php?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
        console.error("Wyz.ie API Error:", res.status, await res.text());
        return [];
    }

    const data: WyzieSubtitle[] = await res.json();
    
    // Normalize wyzie data to our UnifiedSubtitle format
    return (data || []).map(sub => ({
        language: sub.language.toLowerCase().substring(0, 2), // e.g. "English" -> "en"
        url: sub.url.replace("download.php", "download_srt.php"), // Assuming we always want SRT
        movieName: query,
        fileName: sub.release,
        source: 'wyzie' as const
    }));
}


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return NextResponse.json({ error: "Query parameter is missing" }, { status: 400 });

  const openSubtitlesApiKey = process.env.OPENSUBTITLES_API_KEY;
  if (!openSubtitlesApiKey) {
    console.error("OpenSubtitles API key not found. Please set OPENSUBTITLES_API_KEY in your .env file.");
    // We don't return an error, just proceed without this source
  }

  const cacheKey = `subtitles:${query}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedResult.data);
  }

  try {
    const fetchPromises: Promise<UnifiedSubtitle[]>[] = [
        fetchFromWyzie(query)
    ];

    if (openSubtitlesApiKey) {
        fetchPromises.push(fetchFromOpenSubtitles(query, openSubtitlesApiKey));
    }
    
    const results = await Promise.all(fetchPromises);
    const allSubtitles = results.flat();

    // Prefer English first
    let filteredSubs = allSubtitles.filter((s) => s.language === "en");

    // fallback if no English found
    if (filteredSubs.length === 0) {
      filteredSubs = allSubtitles;
    }
    
    // Deduplicate based on fileName and language
    const uniqueSubs = Array.from(new Map(filteredSubs.map(sub => [`${sub.fileName}-${sub.language}`, sub])).values());

    cache.set(cacheKey, { data: uniqueSubs, timestamp: Date.now() });
    return NextResponse.json(uniqueSubs);

  } catch (err) {
    console.error("Error fetching subtitles:", err);
    return NextResponse.json({ error: "Internal server error while fetching subtitles." }, { status: 500 });
  }
}
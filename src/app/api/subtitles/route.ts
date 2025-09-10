import { NextResponse } from "next/server";

interface SubtitleFile {
  file_id: number;
  file_name: string;
}

interface SubtitleAttributes {
  language: string;
  files: SubtitleFile[];
}

interface SubtitleData {
  id: string;
  attributes: SubtitleAttributes;
}

// Simple in-memory cache to avoid hitting API rate limits
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return NextResponse.json([], { status: 400 });

  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (!apiKey) {
    console.error("OpenSubtitles API key not found. Please set OPENSUBTITLES_API_KEY in your environment variables.");
    return NextResponse.json(
      { error: "Server configuration error: Missing OpenSubtitles API Key." },
      { status: 500 }
    );
  }

  const cachedResult = cache.get(query);
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedResult.data);
  }

  try {
    const res = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(query)}&type=movie`, {
      headers: { "Api-Key": apiKey, "Accept": "application/json" }
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("OpenSubtitles API Error:", errorText);
        return NextResponse.json({ error: "Failed to fetch from OpenSubtitles API" }, { status: res.status });
    }

    const data = await res.json();

    const subtitleDownloads = data.data?.map(async (s: SubtitleData) => {
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
            url: downloadData.link
        };
    }).filter(Boolean);

    const subs = await Promise.all(subtitleDownloads);
    const filteredSubs = subs.filter(Boolean);

    cache.set(query, { data: filteredSubs, timestamp: Date.now() });

    return NextResponse.json(filteredSubs);
  } catch (err) {
    console.error("Error fetching subtitles:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

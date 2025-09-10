
import { NextRequest, NextResponse } from 'next/server';
import { gunzipSync } from 'zlib';

interface SubtitleFile {
  file_id: number;
  file_name: string;
}

interface Subtitle {
  id: string;
  type: string;
  attributes: {
    language: string;
    files: SubtitleFile[];
    download_count: number;
    feature_details: {
        movie_name: string;
    }
  };
}

interface FormattedSubtitle {
  language: string;
  url: string;
  fileName: string;
}

const cache = new Map<string, { data: FormattedSubtitle[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to convert SRT to VTT format
const srtToVtt = (srtText: string): string => {
  let vtt = "WEBVTT\n\n";
  const srtLines = srtText.trim().replace(/\r/g, '').split('\n');

  let i = 0;
  while (i < srtLines.length) {
    if (srtLines[i].match(/^\d+$/) && srtLines[i+1]?.includes('-->')) {
      const timeLine = srtLines[i+1].replace(/,/g, '.');
      vtt += timeLine + "\n";
      i += 2;

      let text = "";
      while (i < srtLines.length && srtLines[i].trim() !== "") {
        text += srtLines[i] + "\n";
        i++;
      }
      vtt += text.trim() + "\n\n";
    } else {
        i++;
    }
  }
  return vtt;
};

// Normalize language codes
const normalizeLang = (lang: string) => {
  if (!lang) return "unknown";
  if (lang.toLowerCase() === "en" || lang.toLowerCase() === "eng") return "eng";
  return lang.toLowerCase();
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get('tmdb_id');
  const openSubtitlesApiKey = process.env.OPENSUBTITLES_API_KEY;
  const tmdbApiKey = process.env.TMDB_API_KEY;

  if (!tmdbId) {
    return NextResponse.json({ error: 'TMDb ID parameter is required' }, { status: 400 });
  }

  if (!openSubtitlesApiKey || !tmdbApiKey) {
    console.error('API keys for OpenSubtitles or TMDb are not configured.');
    return NextResponse.json({ error: 'Server API keys are not configured' }, { status: 500 });
  }

  const cacheKey = `subtitles_${tmdbId}`;
  const cached = cache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return NextResponse.json(cached.data);
  }

  try {
    // Step 1: Get IMDb ID from TMDb
    const tmdbDetailsRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbApiKey}`);
    if (!tmdbDetailsRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch movie details from TMDb' }, { status: tmdbDetailsRes.status });
    }
    const tmdbDetails = await tmdbDetailsRes.json();
    const imdbId = tmdbDetails.imdb_id;

    if (!imdbId) {
        return NextResponse.json({ error: 'IMDb ID not found for this movie on TMDb' }, { status: 404 });
    }

    // Step 2: Search OpenSubtitles using IMDb ID
    const searchRes = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdbId}&per_page=100`, {
      headers: { 'Api-Key': openSubtitlesApiKey, 'Accept': 'application/json' },
    });
    
    if (!searchRes.ok) {
        const errorText = await searchRes.text();
        console.error("OpenSubtitles search failed:", searchRes.status, errorText);
        return NextResponse.json({ error: 'Failed to fetch from OpenSubtitles' }, { status: searchRes.status });
    }
    
    const searchData = await searchRes.json();

    if (!searchData.data || searchData.data.length === 0) {
      cache.set(cacheKey, { data: [], timestamp: Date.now() });
      return NextResponse.json([]);
    }

    const sortedSubs = searchData.data.sort((a: Subtitle, b: Subtitle) => b.attributes.download_count - a.attributes.download_count);

    const downloadPromises = sortedSubs.map(async (sub: Subtitle) => {
      try {
        if (!sub.attributes.files || sub.attributes.files.length === 0) return null;

        const fileId = sub.attributes.files[0].file_id;
        const language = normalizeLang(sub.attributes.language);
        let originalFileName = sub.attributes.files[0].file_name || `${sub.attributes.feature_details.movie_name}.${language}.srt`;

        const downloadReqRes = await fetch('https://api.opensubtitles.com/api/v1/download', {
          method: 'POST',
          headers: { 'Api-Key': openSubtitlesApiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ file_id: fileId }),
        });
        
        if (!downloadReqRes.ok) {
            console.warn(`Failed to get download link for file ID ${fileId}`);
            return null;
        }
        
        const downloadData = await downloadReqRes.json();
        const downloadUrl = downloadData.link;

        if (!downloadUrl) {
            console.warn(`No download link in response for file ID ${fileId}`);
            return null;
        }

        const subtitleContentRes = await fetch(downloadUrl);
        if (!subtitleContentRes.ok) {
            console.warn(`Failed to download subtitle content from ${downloadUrl}`);
            return null;
        }

        let subtitleText: string;
        const isCompressed = downloadUrl.endsWith(".gz") || subtitleContentRes.headers.get("content-encoding") === "gzip";

        if (isCompressed) {
            const arrayBuffer = await subtitleContentRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            subtitleText = gunzipSync(buffer).toString("utf-8");
        } else {
            subtitleText = await subtitleContentRes.text();
        }
        
        let vttText = subtitleText;
        let finalFileName = originalFileName;

        if (originalFileName.toLowerCase().endsWith(".srt") || downloadUrl.toLowerCase().endsWith(".srt")) {
            vttText = srtToVtt(subtitleText);
            finalFileName = finalFileName.replace(/\.srt$/, ".vtt");
        }

        const buffer = Buffer.from(vttText, 'utf-8');
        const dataUri = `data:text/vtt;base64,${buffer.toString('base64')}`;
        
        return {
          language,
          url: dataUri,
          fileName: finalFileName,
        };
      } catch (e) {
        console.error("Error processing a single subtitle:", e);
        return null;
      }
    });

    const successfulSubs = (await Promise.all(downloadPromises)).filter((s): s is FormattedSubtitle => s !== null);
    
    if (successfulSubs.length === 0) {
      cache.set(cacheKey, { data: [], timestamp: Date.now() });
      return NextResponse.json([]);
    }

    cache.set(cacheKey, { data: successfulSubs, timestamp: Date.now() });

    return NextResponse.json(successfulSubs);

  } catch (error) {
    console.error('Error fetching subtitles:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

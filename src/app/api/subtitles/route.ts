import { NextRequest, NextResponse } from 'next/server';

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
    }
    i++;
  }
  return vtt;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const apiKey = process.env.OPENSUBTITLES_API_KEY;

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'OpenSubtitles API key is not configured' }, { status: 500 });
  }

  const cacheKey = `subtitles_${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return NextResponse.json(cached.data);
  }

  try {
    const searchRes = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(query)}&per_page=20`, {
      headers: { 'Api-Key': apiKey, 'Accept': 'application/json' },
    });
    
    if (!searchRes.ok) {
        const errorText = await searchRes.text();
        console.error("OpenSubtitles search failed:", searchRes.status, errorText);
        return NextResponse.json({ error: 'Failed to fetch from OpenSubtitles' }, { status: searchRes.status });
    }
    
    const searchData = await searchRes.json();

    if (!searchData.data || searchData.data.length === 0) {
      return NextResponse.json({ error: 'No subtitles found' }, { status: 404 });
    }

    const downloadPromises = searchData.data.map(async (sub: Subtitle) => {
      try {
        const fileId = sub.attributes.files[0].file_id;
        const language = sub.attributes.language;
        const originalFileName = sub.attributes.files[0].file_name;

        const downloadReqRes = await fetch('https://api.opensubtitles.com/api/v1/download', {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ file_id: fileId }),
        });
        
        if (!downloadReqRes.ok) return null;
        
        const downloadData = await downloadReqRes.json();
        const downloadUrl = downloadData.link;

        const subtitleContentRes = await fetch(downloadUrl);
        if (!subtitleContentRes.ok) return null;

        const subtitleText = await subtitleContentRes.text();
        
        let vttText = subtitleText;
        let finalFileName = originalFileName;

        if (originalFileName.toLowerCase().endsWith('.srt')) {
            vttText = srtToVtt(subtitleText);
            finalFileName = originalFileName.replace(/\.srt$/, '.vtt');
        }

        const buffer = Buffer.from(vttText, 'utf-8');
        const dataUri = `data:text/vtt;base64,${buffer.toString('base64')}`;
        
        return {
          language,
          url: dataUri,
          fileName: finalFileName,
        };
      } catch (e) {
        console.error("Error processing subtitle:", e);
        return null;
      }
    });

    const successfulSubs = (await Promise.all(downloadPromises)).filter((s): s is FormattedSubtitle => s !== null);
    
    if (successfulSubs.length === 0) {
      return NextResponse.json({ error: 'No subtitles could be processed' }, { status: 404 });
    }
    
    let filteredSubs = successfulSubs;

    const englishSubs = successfulSubs.filter((s) => s.language === "en");
    if (englishSubs.length > 0) {
        const otherSubs = successfulSubs.filter((s) => s.language !== "en");
        filteredSubs = [...englishSubs, ...otherSubs];
    }

    cache.set(cacheKey, { data: filteredSubs, timestamp: Date.now() });

    return NextResponse.json(filteredSubs);

  } catch (error) {
    console.error('Error fetching subtitles:', error);
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}

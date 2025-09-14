
import { NextResponse } from "next/server";

const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY!;

// This is a new route file to act as a proxy for downloading subtitles.
// This is necessary because the OpenSubtitles download endpoint requires an API key
// in the headers, which we cannot expose to the client-side video player directly.

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("file_id");

    if (!fileId) {
      return NextResponse.json({ error: "Missing file_id" }, { status: 400 });
    }

    // 1. Prepare the download request to OpenSubtitles
    const downloadUrl = "https://api.opensubtitles.com/api/v1/download";
    const body = JSON.stringify({ file_id: parseInt(fileId) });

    const osRes = await fetch(downloadUrl, {
      method: 'POST',
      headers: {
        "Api-Key": OPENSUBTITLES_API_KEY,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!osRes.ok) {
        const errorData = await osRes.json();
        console.error("OpenSubtitles download error:", errorData);
        throw new Error(errorData.message || "Failed to get download link from OpenSubtitles");
    }

    const downloadData = await osRes.json();
    const subtitleDownloadLink = downloadData.link;

    if (!subtitleDownloadLink) {
        throw new Error("No download link provided by OpenSubtitles");
    }

    // 2. Fetch the actual subtitle content from the provided link
    const subtitleContentRes = await fetch(subtitleDownloadLink);
    if (!subtitleContentRes.ok) {
        throw new Error("Failed to download subtitle content");
    }

    const srtContent = await subtitleContentRes.text();
    
    // 3. Return the SRT content directly to the client
    return new Response(srtContent, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        }
    });

  } catch (error: any) {
    console.error("Error in /api/subtitles/download:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

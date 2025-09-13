
import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url || !ytdl.validateURL(url)) {
        return NextResponse.json({ error: 'A valid YouTube URL parameter is required' }, { status: 400 });
    }

    try {
        const info = await ytdl.getInfo(url);
        
        // Find a format that has both video and audio, and is mp4
        const format = ytdl.chooseFormat(info.formats, { 
            quality: 'highestvideo',
            filter: (f) => f.hasVideo && f.hasAudio && f.container === 'mp4'
        });

        if (!format) {
             // If no combined format, try to find the best separate ones (less ideal)
            const videoFormat = ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: 'videoonly' });
            const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

            if(videoFormat && audioFormat) {
                return NextResponse.json({ 
                    videoUrl: videoFormat.url, 
                    title: info.videoDetails.title,
                    isMuxed: false,
                    audioUrl: audioFormat.url, // Note: standard <video> can't play two sources. This is for advanced players.
                });
            }
             return NextResponse.json({ error: 'Could not find a suitable video format.' }, { status: 404 });
        }
        
        return NextResponse.json({ 
            videoUrl: format.url, 
            title: info.videoDetails.title,
            isMuxed: true,
        });

    } catch (error) {
        console.error('Error fetching YouTube video info:', error);
        return NextResponse.json({ error: 'An internal error occurred while fetching video data' }, { status: 500 });
    }
}

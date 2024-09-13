import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }

  try {
    console.log(`Attempting to fetch transcript for video ID: ${videoId}`);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    console.log('Transcript fetched successfully');
    return NextResponse.json(transcript);
  } catch (error) {
    console.error(`Error fetching transcript for video ${videoId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
}

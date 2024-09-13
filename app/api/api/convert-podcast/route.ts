// 
import { NextResponse } from 'next/server';
import { processYouTubeVideo } from '@/app/make_blog';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const MONGO_URI = process.env.MONGO_URI;
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '86400000', 10); // 24 hours in milliseconds

let mongoClient: MongoClient | null = null;

async function connectToMongoDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI as string);
    await mongoClient.connect();
  }
  return mongoClient.db('youtube_analysis_cache');
}

function generateCacheKey(youtubeLink: string): string {
  return crypto.createHash('md5').update(youtubeLink).digest('hex');
}

async function getCachedResult(key: string) {
  const db = await connectToMongoDB();
  const cacheCollection = db.collection('blog_post_cache');
  const cachedResult = await cacheCollection.findOne({ key, createdAt: { $gt: new Date(Date.now() - CACHE_TTL) } });
  return cachedResult?.value;
}

async function setCachedResult(key: string, value: string) {
  const db = await connectToMongoDB();
  const cacheCollection = db.collection('blog_post_cache');
  await cacheCollection.updateOne(
    { key },
    { $set: { value, createdAt: new Date() } },
    { upsert: true }
  );
}

export async function POST(request: Request) {
  const { youtubeLink } = await request.json();

  if (!youtubeLink) {
    return NextResponse.json({ error: 'YouTube link is required' }, { status: 400 });
  }

  const cacheKey = generateCacheKey(youtubeLink);

  try {
    // Check cache first
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
      console.log('Returning cached result');
      return NextResponse.json({ success: true, blogPost: cachedResult, cached: true });
    }

    // If not in cache, process the video
    console.log('Processing new request');

    // Create a ReadableStream to stream progress updates
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await processYouTubeVideo(youtubeLink, Date.now(), (progress: number, estimatedTime: number) => {
            // Push progress updates to the client
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ progress, estimatedTime })));
          });

          // Cache the result after processing
          await setCachedResult(cacheKey, result.blogPost); // {{ edit_1 }}

          // Push the final result to the client
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ blogPost: result.blogPost, progress: 100 })));
          controller.close();
        } catch (error) {
          console.error('Error processing YouTube video:', error);
          controller.error(error);
        }
      },
    });

    // Return the stream as the response
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Error processing YouTube video:', error);
    return NextResponse.json({ error: 'Failed to process YouTube video' }, { status: 500 });
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
    }
  }
}
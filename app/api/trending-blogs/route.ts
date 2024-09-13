import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function GET() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not defined');
  }
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('youtube_analysis_cache');
    const collection = database.collection('blogs');

    // Fetch trending blogs (you might want to adjust this query based on your data structure)
    const trendingBlogs = await collection.find({}).sort({ createdAt: -1 }).limit(6).toArray();

    return NextResponse.json(trendingBlogs);
  } catch (error) {
    console.error('Error fetching trending blogs:', error);
    return NextResponse.json({ error: 'Failed to fetch trending blogs' }, { status: 500 });
  } finally {
    await client.close();
  }
}
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Groq } from 'groq-sdk';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';
import chalk from "chalk";
// import fs from 'fs/promises';
import { configDotenv } from "dotenv";

configDotenv();

// Environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_KEY2 = process.env.GEMINI_API_KEY2;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MONGO_URI = process.env.MONGO_URI;
const MONGO_USER = process.env.MONGO_USER;
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
const CACHE_TTL = parseInt(process.env.CACHE_TTL || 24 * 60 * 60 * 1000, 10); // 24 hours in milliseconds

// MongoDB setup
let mongoClient;
let db;

async function getMongoClient() {
  if (!mongoClient) {
    const auth = MONGO_USER && MONGO_PASSWORD
      ? { auth: { username: MONGO_USER, password: MONGO_PASSWORD } }
      : {};
    mongoClient = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      ...auth,
      maxPoolSize: 10,
    });
    await mongoClient.connect();
    console.log(chalk.green('Successfully connected to MongoDB'));
  }
  return mongoClient;
}
async function withDatabase(operation) {
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const db = client.db('youtube_analysis_cache');
      await operation(db, session);
    });
  } catch (error) {
    console.error(chalk.red('Error in database operation:', error));
    throw error;
  } finally {
    await session.endSession();
  }
}

// Retry wrapper for MongoDB operations
async function retryOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withDatabase(operation);
    } catch (error) {
      if (error.name === 'MongoNetworkError' ||
        error.name === 'MongoExpiredSessionError' ||
        error.message.includes('topology was destroyed')) {
        console.error(chalk.yellow(`MongoDB operation failed (attempt ${attempt}/${maxRetries}):`, error.message));
        if (attempt === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        // Reset the client to force a new connection on the next attempt
        if (mongoClient) {
          await mongoClient.close();
          mongoClient = null;
        }
      } else {
        throw error;
      }
    }
  }
}


async function connectToMongoDB() {
  if (!mongoClient) {
    const auth = MONGO_USER && MONGO_PASSWORD
      ? { auth: { username: MONGO_USER, password: MONGO_PASSWORD } }
      : {};
    mongoClient = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      ...auth,
      maxPoolSize: 10,
    });
    try {
      await mongoClient.connect();
      console.log(chalk.green('Successfully connected to MongoDB'));
      db = mongoClient.db('youtube_analysis_cache');

      // Create TTL index for cache invalidation
      const cacheCollection = db.collection('analysis_cache');
      await cacheCollection.createIndex({ "createdAt": 1 }, { expireAfterSeconds: CACHE_TTL / 1000 });
      console.log(chalk.green('TTL index created successfully'));
    } catch (error) {
      console.error(chalk.red('Error connecting to MongoDB:', error));
      throw error;
    }
  }
  return db;
}

// async function getMongoCollection(collectionName) {
//   const database = await connectToMongoDB();
//   return database.collection(collectionName);
// }

// async function closeMongoDBConnection() {
//   if (mongoClient) {
//     await mongoClient.close();
//     mongoClient = null;
//     console.log(chalk.green('MongoDB connection closed'));
//   }
// }

// Gemini model setup
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const genAI2 = new GoogleGenerativeAI(GEMINI_API_KEY2);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const geminiModel2 = genAI2.getGenerativeModel({ model: "gemini-1.5-flash" });

const geminiConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
};

// Groq model setup
const groq = new Groq({ apiKey: GROQ_API_KEY });

// Helper function for Gemini API calls
async function callGeminiAPI(prompt) {
  const chatSession = geminiModel.startChat({ generationConfig: geminiConfig });
  const result = await chatSession.sendMessage(prompt);
  return result.response.text();
}
async function callGeminiAPI2(prompt) {
  const chatSession = geminiModel2.startChat({ generationConfig: geminiConfig });
  const result = await chatSession.sendMessage(prompt);
  return result.response.text();
}

// Helper function for Groq API calls
async function callGroqAPI(prompt) {
  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama3-8b-8192",
  });
  return chatCompletion.choices[0]?.message?.content || "";
}

// Cache helper functions
function generateCacheKey(prefix, ...inputs) {
  const concatenatedInputs = inputs.join('_');
  const hash = crypto.createHash('md5').update(concatenatedInputs).digest('hex');
  return `${prefix}_${hash}`;
}

async function getCachedResult(key) {
  try {
    return await retryOperation(async (db, session) => {
      const cacheCollection = db.collection('analysis_cache');
      return await cacheCollection.findOne({ key }, { session });
    });
  } catch (error) {
    console.error(`Error fetching cached result for key ${key}:`, error);
    throw error;
  }
}

async function setCachedResult(key, value) {
  try {
    return await retryOperation(async (db, session) => {
      const cacheCollection = db.collection('analysis_cache');
      await cacheCollection.updateOne(
        { key },
        { $set: { value, createdAt: new Date() } },
        { upsert: true, session }
      );
    });
  } catch (error) {
    console.error(`Error setting cached result for key ${key}:`, error);
    throw error;
  }
}

// Function definitions with caching and logging
async function analyze_transcript(transcript) {
  console.log(chalk.blue('Starting transcript analysis...'));
  const cacheKey = generateCacheKey('analyze_transcript', transcript);
  const cachedResult = await retryOperation(() => getCachedResult(cacheKey));
  if (cachedResult) {
    console.log(chalk.green('Analysis retrieved from cache'));
    return cachedResult;
  }

  const prompt = `Analyze the provided transcript by identifying key themes, main points, and interesting insights,
                  explaining how these elements are developed throughout the conversation. Highlight memorable quotes or anecdotes
                  by paraphrasing them to retain their original meaning while enhancing clarity. Provide context for each theme or
                  insight, emphasizing its significance in the broader discussion.

                  Transcript: ${transcript}`;
  try {
    const result = await callGeminiAPI(prompt);
    await retryOperation(() => setCachedResult(cacheKey, result));
    console.log(chalk.green('Transcript analysis completed and cached'));
    return result;
  } catch (error) {
    console.error(chalk.red('Error in transcript analysis:', error));
    throw error;
  }
}

async function develop_original_angle(transcript) {
  console.log(chalk.blue('Developing original angle...'));
  const cacheKey = generateCacheKey('develop_original_angle', transcript);
  const cachedResult = await retryOperation(() => getCachedResult(cacheKey));
  if (cachedResult) {
    console.log(chalk.green('Original angle retrieved from cache'));
    return cachedResult;
  }

  const prompt = `Develop an original angle from the transcript:
                  Consider your target audience to be college students and what would interest them most.
                  Find a unique perspective or takeaway from the podcast content.

                  Transcript: ${transcript}`;
  try {
    const result = await callGeminiAPI(prompt);
    await retryOperation(() => setCachedResult(cacheKey, result));
    console.log(chalk.green('Original angle developed and cached'));
    return result;
  } catch (error) {
    console.error(chalk.red('Error in developing original angle:', error));
    throw error;
  }
}

async function generate_summary(transcript) {
  console.log(chalk.blue('Generating summary...'));
  const cacheKey = generateCacheKey('generate_summary', transcript);
  const cachedResult = await retryOperation(() => getCachedResult(cacheKey));
  if (cachedResult) {
    console.log(chalk.green('Summary retrieved from cache'));
    return cachedResult;
  }

  const prompt = `Generate a detailed summary of the following transcript:

                  ${transcript}

                  Include key points, main themes, and any significant insights or conclusions.`;
  try {
    const result = await callGeminiAPI(prompt);
    await retryOperation(() => setCachedResult(cacheKey, result));
    console.log(chalk.green('Summary generated and cached'));
    return result;
  } catch (error) {
    console.error(chalk.red('Error in generating summary:', error));
    throw error;
  }
}

async function create_blog_outline(analysis, originalAngle, summary) {
  console.log(chalk.blue('Creating blog outline...'));
  const cacheKey = generateCacheKey('create_blog_outline', analysis, originalAngle, summary);
  const cachedResult = await retryOperation(() => getCachedResult(cacheKey));
  if (cachedResult) {
    console.log(chalk.green('Blog outline retrieved from cache'));
    return cachedResult;
  }

  const prompt = `
                  Generate an engaging outline for a blog based on the provided ${summary} and ${analysis} and this original angle: ${originalAngle}.
                  The outline should be in a valid JSON format, with main headings starting with '0' and continuing sequentially.
                  Return ONLY the JSON object, without any additional text or explanation.

                  Example of the expected format:
                  {
                      "0": {
                          "heading": "Introduction",
                          "content": [
                              "Briefly introduce Joe Rogan Experience #2190 with Peter Thiel, highlighting Thiel's unique perspectives.",
                              "Mention the podcast's focus on AI, the future of humanity, and the complexities of the modern world.",
                              "Tease the main points and arguments that will be discussed in the blog."
                          ]
                      },
                      "1": {
                          "heading": "Next Major Point",
                          "content": [
                              "Detail about the first subpoint",
                              "Detail about the second subpoint",
                              "Detail about the third subpoint"
                          ]
                      }
                  }

                  ** IMPORTANT ** :
                  1. Ensure all keys and string values are enclosed in double quotes.
                  2. Do not use single quotes anywhere in the JSON.
                  3. Do not include any text before or after the JSON object.
                  4. Ensure the JSON is valid and can be parsed by a standard JSON parser.
                  `;
  try {
    const result = await callGeminiAPI(prompt);
    // console.log(result);
    const parsedResult = JSON.stringify(JSON.parse(result), null, 2);
    await retryOperation(() => setCachedResult(cacheKey, parsedResult));
    console.log(chalk.green('Blog outline created and cached'));
    return parsedResult;
  } catch (error) {
    console.error(chalk.red('Error in creating blog outline:', error));
    throw error;
  }
}


async function write_blog_section(sectionInfo, sectionNumber, transcript, prevSummary, nextSummary, totalSections) {
  console.log(chalk.blue(`Writing blog section ${sectionNumber}...`));
  
  const cacheKey = generateCacheKey('write_blog_section', sectionNumber, JSON.stringify(sectionInfo), transcript);
  const cachedResult = await retryOperation(() => getCachedResult(cacheKey));
  if (cachedResult) {
    console.log(chalk.green(`Blog section ${sectionNumber} retrieved from cache`));
    return cachedResult;
  }

  const prompt = `
  Write an engaging section of a blog post based on the following information:
  
  Section Info: ${JSON.stringify(sectionInfo)}
  Section Number: ${sectionNumber}
  Total Sections: ${totalSections}
  
  Context:
  ${prevSummary ? `Previous Section Summary: ${prevSummary}` : "This is the first section."}
  ${nextSummary ? `Next Section Preview: ${nextSummary}` : "This is the final section."}
  
  Transcript Excerpt: ${transcript}
  
  Guidelines:
  1. Ensure smooth transitions from the previous section (if applicable) and into the next section (if applicable).
  2. Paraphrase ideas from the transcript, adding your own analysis and related examples where appropriate.
  3. Use descriptive language and incorporate storytelling elements to engage the reader.
  4. Maintain a consistent tone and style throughout the section, aligning with the overall blog post voice.
  5. Include relevant subheadings, bullet points, or numbered lists to improve readability, if applicable.
  6. Aim for a word count of approximately 300-500 words for this section.
  7. Conclude the section with a brief summary or transition that leads naturally into the next section (if applicable).
  
  Remember to focus on the specific topic of this section while keeping the overall flow and structure of the blog post in mind.
  `;

  try {
    const result = await callGeminiAPI2(prompt);
    await retryOperation(() => setCachedResult(cacheKey, result));
    console.log(chalk.green(`Blog section ${sectionNumber} written and cached`));
    return result;
  } catch (error) {
    console.error(chalk.red(`Error in writing blog section ${sectionNumber}:`, error));
    throw error;
  }
}

async function write_blog_section_summary(sectionContent, sectionNumber) {
  console.log(chalk.blue(`Writing summary for blog section ${sectionNumber}...`));
  
  const cacheKey = generateCacheKey('write_blog_section_summary', sectionNumber, sectionContent);
  const cachedResult = await retryOperation(() => getCachedResult(cacheKey));
  if (cachedResult) {
    console.log(chalk.green(`Blog section ${sectionNumber} summary retrieved from cache`));
    return cachedResult;
  }

  const prompt = `
  Summarize the following blog post section concisely. This summary will be used to provide context for the surrounding sections, ensuring smooth transitions between parts of the blog post.

  Section Content:
  ${sectionContent}

  Guidelines:
  1. Generate the detailed summary.
  2. Capture the main points or key ideas of the section.
  3. Use language that can serve as a transition to or from this section.
  4. Do not introduce new information not present in the original section.

  Provide only the summary, without any additional explanation or commentary.
  `;

  try {
    const result = await callGroqAPI(prompt);
    await retryOperation(() => setCachedResult(cacheKey, result));
    console.log(chalk.green(`Blog section ${sectionNumber} summary written and cached`));
    return result;
  } catch (error) {
    console.error(chalk.red(`Error in writing blog section ${sectionNumber} summary:`, error));
    throw error;
  }
}

function extractVideoId(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|.+\?v=)?([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}



// Main function to process a YouTube video// Modify the processYouTubeVideo function to be exported
export async function processYouTubeVideo(videoUrl, blogPostIndex, onProgress) {
  const startTime = Date.now();
  console.log(chalk.blue(`Processing YouTube video: ${videoUrl}`));
  try {
    await connectToMongoDB();

    // Generate cache key for the final blog post
    const finalBlogPostCacheKey = generateCacheKey('final_blog_post', videoUrl);
    const cachedFinalBlogPost = await getCachedResult(finalBlogPostCacheKey);
    if (cachedFinalBlogPost) {
      console.log(chalk.green('Final blog post retrieved from cache'));
      onProgress(100, 0); // Indicate completion
      return {
        summary: cachedFinalBlogPost.summary,
        blogPost: cachedFinalBlogPost.blogPost
      };
    }

    const videoId = extractVideoId(videoUrl);
    console.log(chalk.blue(`Fetching transcript for video ID: ${videoId}`));
    const response = await fetch(`/api/fetch-transcript?videoId=${videoId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.statusText}`);
    }
    const transcript = await response.json();
    const fullTranscript = transcript.map(entry => entry.text).join(' ');
    console.log(chalk.green('Transcript fetched successfully'));
    onProgress(10, (Date.now() - startTime) / 1000); // Update progress

    // Generate cache keys for each step
    const analysisCacheKey = generateCacheKey('analyze_transcript', fullTranscript);
    const originalAngleCacheKey = generateCacheKey('develop_original_angle', fullTranscript);
    const summaryCacheKey = generateCacheKey('generate_summary', fullTranscript);

    // Run analyze_transcript, develop_original_angle, and generate_summary in parallel with caching
    console.log(chalk.blue('Starting parallel processing of transcript analysis, original angle, and summary'));
    const [analysis, originalAngle, summary] = await Promise.all([
      getCachedResult(analysisCacheKey).then(cached => cached ? cached.value : analyze_transcript(fullTranscript)),
      getCachedResult(originalAngleCacheKey).then(cached => cached ? cached.value : develop_original_angle(fullTranscript)),
      getCachedResult(summaryCacheKey).then(cached => cached ? cached.value : generate_summary(fullTranscript))
    ]);

    // Cache results if they weren't already cached
    await Promise.all([
      !analysis && setCachedResult(analysisCacheKey, analysis),
      !originalAngle && setCachedResult(originalAngleCacheKey, originalAngle),
      !summary && setCachedResult(summaryCacheKey, summary)
    ]);

    console.log(chalk.green('Parallel processing completed'));
    onProgress(40, (Date.now() - startTime) / 1000); // Update progress

    // Create blog outline using the results from the parallel operations
    console.log(chalk.blue('Creating blog outline'));
    const blogOutlineCacheKey = generateCacheKey('create_blog_outline', analysis, originalAngle, summary);
    let blogOutlineJson = await getCachedResult(blogOutlineCacheKey);

    if (!blogOutlineJson) {
      blogOutlineJson = await create_blog_outline(analysis, originalAngle, summary);
      await setCachedResult(blogOutlineCacheKey, blogOutlineJson);
    }
    
    console.log(chalk.green('Blog outline created and parsed'));
    onProgress(60, (Date.now() - startTime) / 1000); // Update progress

    const blogOutline = JSON.parse(blogOutlineJson.value || blogOutlineJson);
    const totalSections = Object.keys(blogOutline).length;

    // Write blog sections and summaries with caching
    console.log(chalk.blue('Starting processing of blog sections and summaries'));
    const blogSectionsAndSummaries = [];
    for (let i = 0; i < totalSections; i++) {
      const sectionNumber = i.toString();
      const sectionInfo = blogOutline[sectionNumber];
      const prevSummary = i > 0 ? blogSectionsAndSummaries[i - 1]?.summary : null;
      const nextSummary = i < totalSections - 1 ? null : null;
      
      const sectionCacheKey = generateCacheKey('write_blog_section', sectionNumber, JSON.stringify(sectionInfo), summary);
      let sectionContent = await getCachedResult(sectionCacheKey);
      
      if (!sectionContent) {
        sectionContent = await write_blog_section(sectionInfo, sectionNumber, summary, prevSummary, nextSummary, totalSections);
        await setCachedResult(sectionCacheKey, sectionContent);
      } else {
        sectionContent = sectionContent.value;
      }
      
      const summaryCacheKey = generateCacheKey('write_blog_section_summary', sectionNumber, sectionContent);
      let sectionSummary = await getCachedResult(summaryCacheKey);
      
      if (!sectionSummary) {
        sectionSummary = await write_blog_section_summary(sectionContent, sectionNumber);
        await setCachedResult(summaryCacheKey, sectionSummary);
      } else {
        sectionSummary = sectionSummary.value;
      }
      
      blogSectionsAndSummaries.push({ content: sectionContent, summary: sectionSummary });

      // Emit progress update
      const progress = 60 + ((i + 1) / totalSections) * 40;
      const estimatedTime = (Date.now() - startTime) / 1000;
      onProgress(progress, estimatedTime);
    }
    console.log(chalk.green('All blog sections and summaries completed'));

    // Combine the blog sections into a full blog post
    const fullBlogPost = blogSectionsAndSummaries.map(section => section.content).join('\n\n');
    console.log(chalk.green('Full blog post compiled'));
    onProgress(100, (Date.now() - startTime) / 1000); // Update progress

    // Save the blog post to a file
    const blogPostFileName = `blogpost${blogPostIndex}.txt`;
    // await fs.writeFile(blogPostFileName, fullBlogPost);
    console.log(chalk.green(`Blog post saved to ${blogPostFileName}`));

    // Cache the final blog post
    await setCachedResult(finalBlogPostCacheKey, { summary, blogPost: fullBlogPost });

    // Record the time taken and save it to a log file
    const endTime = Date.now();
    const timeTaken = endTime - startTime;
    const logFileName = `log_blogpost${blogPostIndex}.txt`;
    // await fs.writeFile(logFileName, `Time taken: ${timeTaken}ms`);
    console.log(chalk.green(`Processing time recorded in ${logFileName} in ${timeTaken}ms`));

    return {
      summary,
      blogPost: fullBlogPost
    };
  } catch (error) {
    console.error(chalk.red('Error processing YouTube video:', error));
    throw error;
  }
}

// Example usage
// You can keep the main function for testing purposes
async function main() {
  try {
    const videoUrl = 'https://youtu.be/bc6uFV9CJGg?si=ASry-vvDO3R42DW8';
    console.log(chalk.blue('Starting video processing'));
    const result = await processYouTubeVideo(videoUrl, 1);
    console.log(chalk.green('Video processing completed successfully'));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(chalk.red('Error in main function:', error));
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log(chalk.green('MongoDB connection closed'));
    }
  }
}

// Optionally, we can run the main function if this file is executed directly
if (require.main === module) {
  main();
}

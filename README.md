# Blogift

This repository contains a powerful platform designed to automatically transform podcasts into engaging blog posts, enriching content creation and audience engagement. 


## Installation and Usage

1. **Prerequisites:**
   - Node.js and npm installed.
   - Google Gemini API key.
   - A Groq API key.

2. **Environment Variables:**
   - Create a `.env` file in the root directory and set the following environment variables:
     - `GEMINI_API_KEY`: Your Gemini Pro API key from GCP.
     - `GEMINI_API_KEY2`: Another Gemini Pro API key for additional processing (optional).
     - `GROQ_API_KEY`: Your Groq API key.
     - `MONGO_URI`: The connection string for your MongoDB instance.
     - `MONGO_USER`: The username for your MongoDB instance (optional).
     - `MONGO_PASSWORD`: The password for your MongoDB instance (optional).
     - `CACHE_TTL`: The time-to-live (TTL) for cache entries in milliseconds (default: 24 hours).

3. **Run the script:**
   - Open a terminal in the project directory and run `npm install`.
   - Run `node make_blog.js` to process a YouTube video URL.
   - You can modify the `videoUrl` variable in the `main` function within `make_blog.js` to test with a different video.

## Example Usage

```javascript
// In make_blog.js
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

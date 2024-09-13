```markdown
# Podcast-to-Blog Platform

This repository contains a powerful platform designed to automatically transform podcasts into engaging blog posts, enriching content creation and audience engagement. 

## Overview

The platform leverages a combination of cutting-edge technologies:

- **Gemini Pro:**  A state-of-the-art language model from Google AI, used for generating insightful analysis, original angles, and engaging blog outlines.
- **Groq:** A powerful large language model, utilized for summarizing blog sections concisely.
- **MongoDB:**  A NoSQL database for efficient caching and data storage, ensuring rapid processing and reduced API calls.

## Features

- **Transcript Fetching:** Automatically retrieves transcripts for YouTube videos through an API.
- **Intelligent Analysis:** Analyzes transcripts to identify key themes, insights, and memorable quotes.
- **Original Angle Generation:** Creates unique perspectives from the podcast content tailored to a target audience.
- **Blog Outline Creation:** Generates a structured outline for the blog post, ensuring logical flow and captivating content.
- **Blog Section Writing:** Drafts individual sections of the blog post, incorporating analysis, storytelling, and engaging prose.
- **Section Summarization:** Creates concise summaries for each section, facilitating smooth transitions between parts.
- **Caching:** Utilizes MongoDB for efficient caching of results, optimizing performance and reducing API costs.
- **Progress Tracking:** Provides real-time progress updates during processing, keeping you informed throughout the workflow.

## Installation and Usage

1. **Prerequisites:**
   - Node.js and npm installed.
   - Google Cloud Platform (GCP) account with a project and API key.
   - MongoDB instance with a database named 'youtube_analysis_cache'.
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
```

## Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more information.
```

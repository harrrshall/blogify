'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Moon, Sun, Play, Mic, FileText, Upload, ArrowRight, Youtube, ArrowLeft } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import { motion } from 'framer-motion'
import AnimatedCircularProgressBar from './magicui/animated-circular-progress-bar';
import { saveAs } from 'file-saver';

const sampleBlogs = [
  {
    id: 1,
    title: "The Future of AI in Content Creation",
    excerpt: "Explore how artificial intelligence is revolutionizing the way we create and consume content...",
    content: `# The Future of AI in Content Creation

## Introduction

Artificial Intelligence (AI) is rapidly transforming various industries, and content creation is no exception. This blog post explores the current state of AI in content creation and its potential future impacts.

## Current Applications of AI in Content Creation

1. **Automated Writing**: AI can generate simple news articles, reports, and summaries.
2. **Content Optimization**: AI tools can analyze and suggest improvements for SEO and readability.
3. **Personalized Content**: AI algorithms can tailor content to individual user preferences.

## The Future of AI in Content Creation

### Enhanced Creativity
As AI becomes more sophisticated, it may be able to generate more creative and original content, potentially collaborating with human creators to produce unique works.

### Improved Efficiency
AI will likely streamline the content creation process, allowing creators to focus on high-level strategy and creativity while automating routine tasks.

### Ethical Considerations
As AI becomes more prevalent in content creation, we'll need to address issues such as copyright, authenticity, and the potential displacement of human creators.

## Conclusion

While AI is already making significant strides in content creation, its full potential is yet to be realized. As technology continues to evolve, we can expect AI to play an increasingly important role in shaping the future of content creation.`
  },
  {
    id: 2,
    title: "Mindfulness in the Digital Age",
    excerpt: "Discover practical tips for maintaining mindfulness in our increasingly connected world...",
    content: `# Mindfulness in the Digital Age

## Introduction

In our hyper-connected world, maintaining mindfulness can be a challenge. This blog post offers practical strategies for staying present and focused in the digital age.

## The Challenge of Digital Distraction

With smartphones, social media, and constant notifications, our attention is constantly pulled in multiple directions. This can lead to stress, reduced productivity, and a disconnection from our immediate surroundings.

## Strategies for Digital Mindfulness

### 1. Set Boundaries
Establish specific times for checking emails and social media. Consider using apps that limit your screen time or block distracting websites during work hours.

### 2. Practice Digital Detox
Regularly disconnect from your devices. This could be for a few hours each day, or even a full day each week.

### 3. Mindful Media Consumption
Be intentional about what you consume online. Choose quality over quantity and consider how each piece of content affects your mental state.

### 4. Use Technology Mindfully
Leverage apps and tools designed to promote mindfulness, such as meditation apps or focus-enhancing software.

## Conclusion

While technology can be a source of distraction, it can also be a tool for promoting mindfulness. By being intentional about our digital habits, we can cultivate presence and focus in the digital age.`
  }
]

type Blog = {
  id: number;
  title: string;
  excerpt: string;
  content: string;
};

export function PodcastToBlogPlatform() {
  const [darkMode, setDarkMode] = useState(false)
  const [youtubeLink, setYoutubeLink] = useState('')
  const [convertedBlog, setConvertedBlog] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState('main')
  const [selectedBlog, setSelectedBlog] = useState<typeof sampleBlogs[0] | null>(null)
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [trendingBlogs, setTrendingBlogs] = useState<Blog[]>([])
  const youtubeInputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: light)').matches
    setDarkMode(prefersDark)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    async function fetchTrendingBlogs() {
      try {
        const response = await fetch('/api/trending-blogs')
        if (!response.ok) {
          throw new Error('Failed to fetch trending blogs')
        }
        const data = await response.json()
        setTrendingBlogs(data)
      } catch (error) {
        console.error('Error fetching trending blogs:', error)
      }
    }

    fetchTrendingBlogs()
  }, [])

  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode)
  }

  const handleYoutubeLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setYoutubeLink(e.target.value)
  }

  const handleConvertNow = async () => {
    if (youtubeLink.includes('youtube.com') || youtubeLink.includes('youtu.be')) {
      setIsProcessing(true);
      setProgress(0);
      setEstimatedTime(0);
  
      try {
        const response = await fetch('/api/convert-podcast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ youtubeLink }),
        });
  
        if (!response.ok) {
          throw new Error('Failed to convert podcast');
        }
  
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
  
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
  
            const chunk = decoder.decode(value);
            const data = JSON.parse(chunk);
  
            if (data.progress !== undefined) {
              setProgress(data.progress);
            }
            if (data.estimatedTime !== undefined) {
              setEstimatedTime(data.estimatedTime);
            }
            if (data.blogPost !== undefined) {
              setConvertedBlog(data.blogPost);
              setIsCached(data.cached);
              setCurrentView('convertedBlog');
            }
          }
        }
      } catch (error) {
        console.error('Podcast conversion failed:', error);
        alert('Something went wrong. Please try again.');
      } finally {
        setIsProcessing(false);
        setProgress(100); // Ensure progress is set to 100%
      }
    } else {
      alert('Please enter a valid YouTube link');
    }
  }

  const renderProcessingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="p-6 bg-white dark:bg-gray-800 rounded-3xl">
        <h2 className="text-2xl font-bold mb-4">Generating your blog post...</h2>
        <AnimatedCircularProgressBar
          progress={progress}
          max={100}
          value={progress}
          min={0}
          gaugePrimaryColor="#4caf50"
          gaugeSecondaryColor="#e0e0e0"
        />
        <p className="mt-4 text-center">
          Progress: {progress.toFixed(2)}%
        </p>
        <p className="mt-2 text-center">
          Time Remaining: {estimatedTime} seconds
        </p>
      </Card>
    </div>
  )

  const handleReadFullBlog = (blog: typeof sampleBlogs[0]) => {
    setSelectedBlog(blog)
    setCurrentView('fullBlog')
  }

  const handleGetStarted = () => {
    youtubeInputRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const renderNavbar = () => (
    <motion.header
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 backdrop-blur-md bg-orange-50/80 dark:bg-gray-900/80 shadow-md"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <button
            onClick={() => setCurrentView('main')}
            className="text-2xl font-bold text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors"
          >
            Blogify
          </button>
          <nav className="hidden md:flex space-x-6">
            <Button
              variant="link"
              className="text-sm font-medium p-0 hover:text-orange-500 dark:hover:text-orange-400"
              onClick={() => setCurrentView('trendingBlogs')}
            >
              Trending
            </Button>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            aria-label="Toggle theme"
            className="rounded-full hover:bg-orange-100 dark:hover:bg-gray-800"
          >
            {darkMode ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5 text-blue-500" />}
          </Button>
          <Button variant="outline" className="text-sm rounded-full hover:bg-orange-100 dark:hover:bg-gray-800">Sign up</Button>
          <Button variant="default" className="text-sm rounded-full bg-orange-500 hover:bg-orange-600 text-white">Sign in</Button>
        </div>
      </div>
    </motion.header>
  )

  const renderTrendingBlogsView = () => (
    <div className="bg-orange-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-200">
      {renderNavbar()}
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Trending Blogs</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trendingBlogs.map(blog => (
            <Card key={blog.id} className="p-4 bg-white dark:bg-gray-800 rounded-3xl">
              <h3 className="text-xl font-bold mb-2">{blog.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{blog.excerpt}</p>
              <Button variant="outline" className="w-full" onClick={() => handleReadFullBlog(blog)}>
                Read Full Blog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )

  const renderMainView = () => (
    <div className="bg-orange-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-200">
      {renderNavbar()}
      <main className="container mx-auto px-4 py-8">
        <section className="relative rounded-3xl overflow-hidden mb-8 bg-gradient-to-r from-orange-500 to-orange-300 dark:from-gray-800 dark:to-gray-700">
          <div className="container mx-auto px-4 py-16 flex items-center">
            <div className="w-3/5 pr-8">
              <h1 className="text-5xl font-bold mb-4 text-white drop-shadow-lg">Transform your podcast<br />into engaging blogs</h1>
              <p className="text-xl text-white drop-shadow-md mb-8">AI-powered conversion at your fingertips</p>
              <Button
                variant="default"
                className="text-lg px-6 py-3 bg-white text-orange-500 hover:bg-orange-100"
                onClick={handleGetStarted}
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="hidden md:flex w-2/5 justify-center items-center">
            </div>
          </div>
          <Card className="absolute bottom-4 right-4 p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
            <div className="text-sm font-medium">Convert your first podcast</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">It&apos;s quick and easy!</div>
          </Card>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <Card className="p-6 bg-white dark:bg-gray-800 rounded-3xl">
            <h2 className="text-2xl font-bold mb-4">Convert Your Podcast</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Mic className="h-8 w-8 text-orange-500" />
                <div>
                  <div className="font-medium">Upload Your Podcast</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">YouTube link</div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <FileText className="h-8 w-8 text-orange-500" />
                <div>
                  <div className="font-medium">AI-Powered Transcription</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Accurate and fast</div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Upload className="h-8 w-8 text-orange-500" />
                <div>
                  <div className="font-medium">Publish Your Blog</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Share with your audience</div>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-4" ref={youtubeInputRef}>
              <div className="flex items-center space-x-2">
                <Youtube className="h-5 w-5 text-red-500" />
                <Input
                  type="text"
                  placeholder="Enter your YouTube podcast URL"
                  value={youtubeLink}
                  onChange={handleYoutubeLinkChange}
                />
              </div>
              <Button className="w-full" onClick={handleConvertNow}>Convert Now</Button>
            </div>
          </Card>
          <div className="space-y-4">
            {sampleBlogs.map(blog => (
              <Card key={blog.id} className="p-4 bg-white dark:bg-gray-800 rounded-3xl">
                <div className="font-medium mb-2">Sample Converted Blog</div>
                <h3 className="text-xl font-bold mb-2">{blog.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{blog.excerpt}</p>
                <Button variant="outline" className="w-full" onClick={() => handleReadFullBlog(blog)}>
                  Read Full Blog
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">EXPAND YOUR AUDIENCE<br />WITH ENGAGING BLOG CONTENT</h2>
          <div className="flex space-x-4">
            <Button variant="default" className="rounded-full">
              <Play className="h-4 w-4 mr-2" />
              Watch How It Works
            </Button>
            <Button variant="outline" className="rounded-full">View Sample Blogs</Button>
          </div>
          <div className="flex space-x-8 mt-4 text-sm text-gray-500 dark:text-gray-400">
            <div>+ 100,000 Podcasts Converted</div>
            <div>+ 5,000,000 Blog Readers</div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-6 bg-orange-100 dark:bg-gray-800 rounded-3xl">
            <h3 className="text-xl font-bold mb-4">Why Convert Your Podcast to a Blog?</h3>
            <ul className="space-y-2 text-sm">
              <li>• Reach a wider audience</li>
              <li>• Improve SEO and discoverability</li>
              <li>• Provide accessible content for all users</li>
              <li>• Repurpose your content across platforms</li>
            </ul>
          </Card>
          <Card className="p-6 bg-orange-200 dark:bg-gray-700 rounded-3xl">
            <h3 className="text-xl font-bold mb-4">Get Started Today</h3>
            <p className="mb-4 text-sm">Transform your YouTube podcast into an engaging written article with just a few clicks.</p>
            <div className="flex items-center space-x-2 mb-4">
              <Youtube className="h-5 w-5 text-red-500" />
              <Input
                type="text"
                placeholder="Enter your YouTube podcast URL"
                value={youtubeLink}
                onChange={handleYoutubeLinkChange}
              />
            </div>
            <Button className="w-full" onClick={handleConvertNow}>Convert Now</Button>
          </Card>
        </section>
      </main>
    </div>
  )

  const renderFullBlogView = () => {
    const handleDownload = () => {
      if (selectedBlog) {
        const blob = new Blob([selectedBlog.content], { type: "text/markdown;charset=utf-8" });
        saveAs(blob, `${selectedBlog.title}.md`);
      }
    };

    return (
      <div className="bg-orange-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-200">
        {renderNavbar()}
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <Button variant="ghost" onClick={() => setCurrentView('main')} className="flex items-center">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Home
            </Button>
            <h1 className="text-3xl font-bold">{selectedBlog?.title}</h1>
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex items-center"
            >
              <FileText className="h-5 w-5 mr-2" />
              Download Blog
            </Button>
          </div>
          <Card className="p-6 bg-white dark:bg-gray-800 rounded-3xl">
            <ReactMarkdown className="prose dark:prose-invert max-w-none">
              {selectedBlog?.content || ''}
            </ReactMarkdown>
          </Card>
        </main>
      </div>
    )
  }

  const renderConvertedBlogView = () => (
    <div className="bg-gray-900 text-gray-100 min-h-screen transition-colors duration-200">
      {renderNavbar()}
      <main className="markdown-body">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <Button variant="ghost" onClick={() => setCurrentView('main')} className="flex items-center">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Home
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([convertedBlog || ''], {type: "text/markdown;charset=utf-8"});
                saveAs(blob, `converted_blog_${Date.now()}.md`);
              }}
              className="flex items-center"
            >
              <FileText className="h-5 w-5 mr-2" />
              Download Blog
            </Button>
          </div>
          {isCached}
        </div>
        <ReactMarkdown className="prose dark:prose-invert max-w-none">
          {convertedBlog || ''}
        </ReactMarkdown>
      </main>
    </div>
  )

  return (
    <>
      {currentView === 'main' && renderMainView()}
      {currentView === 'fullBlog' && renderFullBlogView()}
      {currentView === 'convertedBlog' && renderConvertedBlogView()}
      {currentView === 'trendingBlogs' && renderTrendingBlogsView()}

      {isProcessing && renderProcessingOverlay()}
    </>
  )
}
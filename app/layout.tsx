import '@/app/globals.css'
import '@/app/github-markdown.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Blogify - Transform Your Podcast into Engaging Blogs',
  description: 'Convert your podcasts into engaging blog posts ',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}

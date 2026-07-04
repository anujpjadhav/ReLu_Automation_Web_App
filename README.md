# AI-Powered Company Research Assistant

A full-stack Next.js application that autonomously researches companies, crawls their websites, and leverages AI to generate comprehensive reports and PDF downloads.

## Features

- **Company Search:** Enter a company name or website URL. The app uses Serper.dev to find the official website and basic contact details.
- **Intelligent Web Crawling:** A custom crawler fetches the homepage and discovers important subpages (About, Products, Services) to extract meaningful text for analysis.
- **OpenRouter AI Integration:** Leverage cutting-edge models (like Claude 3.5 Sonnet or GPT-4o) via OpenRouter to analyze the crawled data and extract structured insights: Products/Services, AI-Generated Pain Points, and Competitors.
- **PDF Generation:** Instantly generate and download a professional, pixel-perfect PDF report matching enterprise design standards.
- **Discord Integration (Bonus):** Automatically post the generated PDF and applicant details to a Discord channel via webhook integration.
- **Premium UI:** A sleek, glassmorphism-inspired dark mode interface with real-time progress indicators.

## Tech Stack

- **Frontend:** Next.js (App Router), React, Vanilla CSS
- **Backend:** Next.js API Routes (Node.js)
- **APIs:** Serper.dev (Search), OpenRouter (AI)
- **Utilities:** Cheerio (Web crawling), jsPDF (PDF Generation), Axios

## Setup Instructions

1. **Install Dependencies:**
   Ensure you have Node.js installed, then run:
   ```bash
   npm install
   ```

2. **Start the Development Server:**
   ```bash
   npm run dev
   ```

3. **Configure API Keys (In-App):**
   Open `http://localhost:3000` in your browser. Use the sidebar to enter your API keys. No `.env` files are required for core functionality, as keys are securely passed from the client directly to the serverless functions per session!

## Environment Variables (Optional)

The application is designed to take API keys directly via the UI for testing purposes. However, if you wish to hardcode defaults for a production deployment, you can edit the Next.js API route files directly.

## Deployment

This project is a single unified repository and can be instantly deployed to Vercel:

1. Push the code to a GitHub repository.
2. Log in to Vercel and import the repository.
3. No environment variables are strictly necessary if users input them via the UI, but you can set them in Vercel settings if you modify the code to read from `process.env`.
4. Click **Deploy**.

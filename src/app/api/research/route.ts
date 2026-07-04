import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

// 1. Helper: Web Search (Auto-detects Serper vs Zenserp)
async function searchSerper(query: string, apiKey: string) {
  if (!apiKey || apiKey.trim() === '') return null;
  try {
    // Zenserp keys are UUIDs (36 chars)
    if (apiKey.length === 36 && apiKey.includes('-')) {
        const res = await axios.get(`https://app.zenserp.com/api/v2/search?q=${encodeURIComponent(query)}&num=5`, {
           headers: { 'apikey': apiKey }
        });
        return {
           organic: (res.data.organic || []).map((o: any) => ({
              title: o.title,
              link: o.url,
              snippet: o.description
           }))
        };
    }
    
    // Default to Serper
    const res = await axios.post('https://google.serper.dev/search', 
      { q: query, num: 5 }, 
      { headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' } }
    );
    return res.data;
  } catch (err: any) {
    console.warn("Search API Error:", err.response?.data || err.message);
    return null; // Return null on failure instead of crashing
  }
}

// 2. Helper: Crawl URL
async function crawlWebsite(baseUrl: string) {
  try {
    const res = await axios.get(baseUrl, { timeout: 10000 });
    const $ = cheerio.load(res.data);
    
    // Remove scripts, styles
    $('script, style, nav, footer, header').remove();
    
    // Basic extraction
    const title = $('title').text();
    let text = $('body').text().replace(/\s+/g, ' ').trim();
    
    // Attempt to discover links to about/products/services
    const links: string[] = [];
    $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && (href.includes('about') || href.includes('product') || href.includes('service'))) {
            if (href.startsWith('/')) {
                links.push(new URL(href, baseUrl).href);
            } else if (href.startsWith('http')) {
                links.push(href);
            }
        }
    });

    // Deduplicate links and take top 2 to crawl quickly
    const uniqueLinks = Array.from(new Set(links)).slice(0, 2);
    
    for (const link of uniqueLinks) {
        try {
           const subRes = await axios.get(link, { timeout: 5000 });
           const _$ = cheerio.load(subRes.data);
           _$('script, style, nav, footer').remove();
           text += " " + _$('body').text().replace(/\s+/g, ' ').trim();
        } catch(e) {
           // Ignore sub-page errors
        }
    }

    // Limit text to avoid massive token usage
    return { title, text: text.substring(0, 15000) };
  } catch (err: any) {
    console.error("Crawl Error:", err.message);
    return null; // Return null if crawl fails, LLM will rely on search snippets
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { query, openRouterKey, serperKey, aiModel } = body;

    // Fallback to environment variables if not provided in UI
    if (!serperKey) serperKey = process.env.SERPER_API_KEY || "";
    if (!openRouterKey) openRouterKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || "";

    if (!query || !openRouterKey) {
      return NextResponse.json({ error: 'Missing required parameters. Provide an AI API Key in the UI or .env.local' }, { status: 400 });
    }

    const cleanSerperKey = serperKey.trim();
    const cleanOpenRouterKey = openRouterKey.trim();

    // A. Perform Serper Search
    let searchData = null;
    let officialUrl = "";

    if (query.startsWith('http')) {
        officialUrl = query;
    } 
    
    // Only search Serper if we have a key and need snippets or URL discovery
    if (cleanSerperKey && cleanSerperKey.length > 5) {
        searchData = await searchSerper(query + " official company website", cleanSerperKey);
    }
    
    if (!officialUrl && searchData && searchData.organic && searchData.organic.length > 0) {
        officialUrl = searchData.organic[0].link;
    }

    if (!officialUrl && !query.startsWith('http')) {
        return NextResponse.json({ error: 'Serper search failed or key invalid. Please provide a direct URL (e.g. https://example.com) instead of a company name.' }, { status: 400 });
    }

    // B. Crawl Website
    let crawledText = "";
    if (officialUrl) {
       const crawlResult = await crawlWebsite(officialUrl);
       if (crawlResult) {
           crawledText = crawlResult.text;
       }
    }

    // Combine Serper snippets as fallback context
    let searchContext = "";
    if (searchData && searchData.organic) {
        searchData.organic.slice(0, 5).forEach((r: any) => {
            searchContext += `Title: ${r.title}\nSnippet: ${r.snippet}\nLink: ${r.link}\n\n`;
        });
    }

    // C. AI Generation (Auto-detect Groq vs OpenRouter)
    const isGroq = cleanOpenRouterKey.startsWith("gsk_");
    const baseURL = isGroq ? "https://api.groq.com/openai/v1" : "https://openrouter.ai/api/v1";

    const openai = new OpenAI({
      baseURL: baseURL,
      apiKey: cleanOpenRouterKey,
      defaultHeaders: {
         "HTTP-Referer": "http://localhost:3000", 
         "X-Title": "Company Research App",
      }
    });

    const systemPrompt = `You are an expert business researcher.
Extract and summarize the following details about the company from the provided text.
Return ONLY a raw, minified JSON object exactly matching this schema:
{
  "CompanyName": "string",
  "Website": "string (the official URL)",
  "Phone": "string (or 'Not publicly listed')",
  "Address": "string (or 'Not publicly listed')",
  "Products": ["string", "string"], // An Array of Strings (list the main products/services)
  "PainPoints": ["string", "string"], // An Array of Strings (list potential customer pain points)
  "Competitors": [
    { "Name": "string", "Website": "string" }
  ]
}
Do not include markdown blocks, backticks, or any other text.`;

    const userPrompt = `Company Query: ${query}\nIdentified URL: ${officialUrl}\n\nSearch Snippets:\n${searchContext}\n\nCrawled Website Text:\n${crawledText}`;

    let finalModel = aiModel || "anthropic/claude-3.5-sonnet";
    
    // Clean up old decommissioned model IDs
    if (finalModel === 'llama3-8b-8192' || finalModel === 'mixtral-8x7b-32768') {
        finalModel = 'llama-3.1-8b-instant';
    } else if (finalModel === 'llama3-70b-8192') {
        finalModel = 'llama-3.3-70b-versatile';
    }

    if (isGroq) {
        // If Groq key is used, ensure we only send Groq-compatible models
        if (finalModel.includes('claude') || finalModel.includes('gpt')) {
            finalModel = 'llama-3.1-8b-instant'; // Fallback to 8b
        }
    } else {
        // If OpenRouter key is used, ensure we translate Groq model IDs to OpenRouter model IDs
        if (finalModel.includes('llama-3.1-8b-instant')) {
            finalModel = 'meta-llama/llama-3-8b-instruct';
        } else if (finalModel.includes('llama-3.3-70b-versatile')) {
            finalModel = 'meta-llama/llama-3-70b-instruct';
        }
    }

    const completion = await openai.chat.completions.create({
      model: finalModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" } // Works for OpenAI models, some OpenRouter models might ignore, so strict prompt helps
    });

    const aiContent = completion.choices[0].message.content || "{}";
    
    // Try to parse the JSON
    let reportData;
    try {
        reportData = JSON.parse(aiContent.trim());
    } catch (e) {
        // Fallback cleanup if the LLM wrapped it in markdown
        const cleaned = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
        reportData = JSON.parse(cleaned);
    }

    return NextResponse.json(reportData);

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

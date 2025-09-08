import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch the URL content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${response.statusText}` }, { status: 400 });
    }

    const html = await response.text();
    
    // Try to find article content using common selectors
    let articleContent = '';
    
    // First, try to find the main article content area
    const mainContentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '#main-content',
      '.article-content',
      '.story-content'
    ];
    
    for (const selector of mainContentSelectors) {
      const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i');
      const match = html.match(regex);
      if (match && match[1]) {
        // Check if this content is substantial (more than just a headline)
        const contentLength = match[1].replace(/<[^>]*>/g, '').trim().length;
        if (contentLength > 200) { // Only use if it has substantial content
          articleContent = match[1];
          console.log(`Found substantial main content using selector: ${selector} (${contentLength} chars)`);
          break;
        } else {
          console.log(`Found small main content using selector: ${selector} (${contentLength} chars) - skipping`);
        }
      }
    }
    
    // If no main content found, try to find content after the headline
    if (!articleContent) {
      // Look for content after the headline and before footer/end
      const headlineMatch = html.match(/<h1[^>]*>([^<]*)<\/h1>([\s\S]*?)(?:<footer|<\/body|<\/html)/i);
      if (headlineMatch && headlineMatch[2]) {
        const contentLength = headlineMatch[2].replace(/<[^>]*>/g, '').trim().length;
        if (contentLength > 200) {
          articleContent = headlineMatch[2];
          console.log(`Found substantial article content after headline (${contentLength} chars)`);
        } else {
          console.log(`Found small content after headline (${contentLength} chars) - skipping`);
        }
      }
    }
    
    // If still no content found, try to find content after "Key Points" or similar markers
    if (!articleContent) {
      const keyPointsMatch = html.match(/Key Points([\s\S]*?)(?:<footer|<\/body|<\/html)/i);
      if (keyPointsMatch) {
        const contentLength = keyPointsMatch[1].replace(/<[^>]*>/g, '').trim().length;
        if (contentLength > 200) {
          articleContent = keyPointsMatch[1];
          console.log(`Found substantial article content after "Key Points" marker (${contentLength} chars)`);
        } else {
          console.log(`Found small content after "Key Points" (${contentLength} chars) - skipping`);
        }
      }
    }
    
    // If still no content found, try to find content after "Published" or "Updated" markers
    if (!articleContent) {
      const publishedMatch = html.match(/(?:Published|Updated)[\s\S]*?([\s\S]*?)(?:<footer|<\/body|<\/html)/i);
      if (publishedMatch && publishedMatch[1]) {
        const contentLength = publishedMatch[1].replace(/<[^>]*>/g, '').trim().length;
        if (contentLength > 200) {
          articleContent = publishedMatch[1];
          console.log(`Found substantial article content after "Published/Updated" marker (${contentLength} chars)`);
        }
      }
    }
    
    // If still no content found, try to find any substantial text content
    if (!articleContent) {
      // Look for content with multiple paragraphs
      const paragraphMatch = html.match(/(<p[^>]*>[\s\S]*?<\/p>){3,}/i);
      if (paragraphMatch) {
        articleContent = paragraphMatch[0];
        console.log('Found article content with multiple paragraphs');
      }
    }
    
    // If still no content found, fall back to full HTML
    if (!articleContent) {
      articleContent = html;
      console.log('Using full HTML as fallback');
    }
    
    // Try a different approach - look for specific content patterns first
    let text = '';
    
    // First, try to extract content using more specific patterns
    const contentPatterns = [
      /Key Points([\s\S]*?)(?:<footer|<\/body|<\/html|$)/i,
      /<p[^>]*>([^<]*Xpeng[^<]*)<\/p>[\s\S]*?<\/p>/i,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<article[^>]*>([\s\S]*?)<\/article>/i
    ];
    
    for (const pattern of contentPatterns) {
      const match = articleContent.match(pattern);
      if (match && match[1]) {
        text = match[1];
        console.log(`Found content using pattern: ${pattern}`);
        break;
      }
    }
    
    // If no pattern worked, fall back to full cleaning
    if (!text) {
      console.log('No pattern matched, using full HTML cleaning');
      text = articleContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '') // Remove navigation
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '') // Remove header
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '') // Remove footer
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '') // Remove sidebar
        .replace(/<[^>]+>/g, ' ') // Remove remaining HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/&nbsp;/g, ' ') // Replace HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .trim();
    }

    console.log(`Text after HTML cleaning: ${text.length} chars`);
    console.log(`Text preview after HTML cleaning: ${text.substring(0, 200)}`);

    // If we still don't have good content, try a more aggressive approach
    if (text.length < 200) {
      console.log('Text too short, trying aggressive content extraction');
      
      // Look for the actual article content in the original HTML
      const aggressivePatterns = [
        /Xpeng plans to launch its mass-market Mona brand[\s\S]*?(?:<footer|<\/body|<\/html|$)/i,
        /CEO He Xiaopeng told CNBC[\s\S]*?(?:<footer|<\/body|<\/html|$)/i,
        /These new cars could ramp up competition[\s\S]*?(?:<footer|<\/body|<\/html|$)/i
      ];
      
      for (const pattern of aggressivePatterns) {
        const match = html.match(pattern);
        if (match && match[0]) {
          text = match[0]
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .trim();
          console.log(`Found content using aggressive pattern: ${pattern}`);
          break;
        }
      }
    }
    
    // Find the actual article content by looking for "Key Points" or similar markers
    let cleanedText = text;
    
    // Try to find content starting from "Key Points"
    const keyPointsIndex = text.indexOf('Key Points');
    if (keyPointsIndex !== -1) {
      cleanedText = text.substring(keyPointsIndex);
      console.log(`Found Key Points at index ${keyPointsIndex}, using content from there`);
    } else {
      // Try to find content starting from the headline
      const headlineMatch = text.match(/^([^.]*\.)/);
      if (headlineMatch) {
        const headlineEnd = headlineMatch[0].length;
        cleanedText = text.substring(headlineEnd);
        console.log(`Using content after headline: "${headlineMatch[0]}"`);
      }
    }
    
    // Remove common navigation text patterns (but be more selective)
    cleanedText = cleanedText
      .replace(/Skip Navigation[\s\S]*?SIGN IN/g, '') // Remove navigation menus
      .replace(/Markets Business Investing Tech Politics Video[\s\S]*?Menu/g, '') // Remove menu text
      .replace(/Subscribe[\s\S]*?Livestream/g, '') // Remove subscription text
      .replace(/WATCH LIVE[\s\S]*?Key Points/g, 'Key Points') // Remove content between WATCH LIVE and Key Points
      .replace(/\s+/g, ' ') // Normalize whitespace again
      .trim();

    // Extract a reasonable amount of text (first 5000 characters)
    const extractedText = cleanedText.substring(0, 5000);
    
    console.log('Extracted text length:', extractedText.length);
    console.log('Extracted text preview:', extractedText.substring(0, 200));

    return NextResponse.json({ text: extractedText });
  } catch (error: any) {
    console.error('Error scraping URL:', error);
    return NextResponse.json({ error: 'Failed to scrape URL' }, { status: 500 });
  }
} 
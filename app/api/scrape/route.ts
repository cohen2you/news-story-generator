import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('=== CHEERIO SCRAPER STARTING ===');
    console.log('URL:', url);

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
    console.log('HTML length:', html.length);

    // Load HTML into cheerio
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ad, .sidebar, .menu, .navigation').remove();
    
    let articleText = '';
    
    // Try multiple strategies to find article content
    const strategies = [
      // Strategy 1: Look for article tag
      () => {
        const article = $('article').first();
        if (article.length) {
          console.log('Found article tag');
          return article.text().trim();
        }
        return '';
      },
      
      // Strategy 2: Look for main content areas
      () => {
        const selectors = [
          '[role="main"]',
          '.article-content',
          '.story-content', 
          '.post-content',
          '.entry-content',
          '.content',
          '.main-content',
          '#main-content',
          '.article-body',
          '.story-body'
        ];
        
        for (const selector of selectors) {
          const element = $(selector).first();
          if (element.length) {
            console.log(`Found content using selector: ${selector}`);
            return element.text().trim();
          }
        }
        return '';
      },
      
      // Strategy 3: Look for headline and extract following content
      () => {
        const headline = $('h1').first();
        if (headline.length) {
          console.log('Found headline:', headline.text().trim());
          
          // Find the parent container of the headline
          let container = headline.parent();
          while (container.length && container.prop('tagName') !== 'BODY') {
            // Check if this container has substantial text content
            const text = container.text().trim();
            if (text.length > 500) {
              console.log('Found substantial content in headline container');
              return text;
            }
            container = container.parent();
          }
        }
        return '';
      },
      
      // Strategy 4: Extract all paragraphs and combine
      () => {
        const paragraphs = $('p').map((i, el) => $(el).text().trim()).get();
        const validParagraphs = paragraphs.filter(p => 
          p.length > 20 && 
          !p.includes('Skip Navigation') &&
          !p.includes('SIGN IN') &&
          !p.includes('Subscribe') &&
          !p.includes('Newsletter') &&
          !p.includes('Terms of Use') &&
          !p.includes('Privacy Policy') &&
          !p.includes('Data is a real-time snapshot') &&
          !p.includes('Global Business and Financial News')
        );
        
        if (validParagraphs.length > 0) {
          console.log(`Found ${validParagraphs.length} valid paragraphs`);
          return validParagraphs.join(' ');
        }
        return '';
      }
    ];
    
    // Try each strategy until we get substantial content
    for (let i = 0; i < strategies.length; i++) {
      const content = strategies[i]();
      if (content.length > 200) {
        articleText = content;
        console.log(`Strategy ${i + 1} successful: ${content.length} chars`);
        break;
      }
    }
    
    // Clean up the extracted text
    if (articleText) {
      articleText = articleText
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .trim();
      
      // Limit to 10000 characters
      if (articleText.length > 10000) {
        articleText = articleText.substring(0, 10000);
      }
    }
    
    console.log('Final extracted text length:', articleText.length);
    console.log('Text preview:', articleText.substring(0, 200));
    
    if (!articleText || articleText.length < 100) {
      return NextResponse.json({ error: 'Could not extract article content' }, { status: 400 });
    }

    return NextResponse.json({ text: articleText });
    
  } catch (error: any) {
    console.error('Error scraping URL:', error);
    return NextResponse.json({ error: 'Failed to scrape URL' }, { status: 500 });
  }
}
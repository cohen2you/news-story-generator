import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    if (!url || !url.trim()) {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
    }

    // Validate it's a Benzinga URL
    if (!url.includes('benzinga.com')) {
      return NextResponse.json({ error: 'Please provide a valid Benzinga article URL.' }, { status: 400 });
    }

    console.log('Fetching article from URL:', url);

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
    const $ = cheerio.load(html);
    
    // Extract headline
    let headline = '';
    const headlineSelectors = [
      'h1.article-title',
      'h1',
      '.headline',
      '.article-headline',
      '[data-testid="headline"]',
      'title'
    ];
    
    for (const selector of headlineSelectors) {
      const element = $(selector).first();
      if (element.length) {
        headline = element.text().trim();
        if (headline && headline.length > 10) {
          break;
        }
      }
    }

    // Extract article body
    let body = '';
    const bodySelectors = [
      'article',
      '[role="main"]',
      '.article-content',
      '.story-content',
      '.post-content',
      '.entry-content',
      '.article-body',
      '.story-body'
    ];
    
    for (const selector of bodySelectors) {
      const element = $(selector).first();
      if (element.length) {
        // Remove unwanted elements
        element.find('script, style, nav, header, footer, aside, .advertisement, .ad, .sidebar, .menu, .navigation, .social-share, .share-buttons, .comments, .related-articles').remove();
        body = element.text().trim();
        if (body && body.length > 200) {
          break;
        }
      }
    }

    // If no body found, try extracting paragraphs
    if (!body || body.length < 200) {
      const paragraphs = $('p').map((i, el) => $(el).text().trim()).get();
      const validParagraphs = paragraphs.filter(p => 
        p.length > 20 && 
        !p.includes('Skip Navigation') &&
        !p.includes('SIGN IN') &&
        !p.includes('Subscribe') &&
        !p.includes('Newsletter') &&
        !p.includes('Terms of Use') &&
        !p.includes('Privacy Policy')
      );
      
      if (validParagraphs.length > 0) {
        body = validParagraphs.join(' ');
      }
    }

    // Clean up the body text
    body = body
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();

    // Extract date if available
    let created = new Date().toISOString();
    const dateSelectors = [
      'time[datetime]',
      '[data-published-date]',
      '.article-date',
      '.published-date',
      '.date'
    ];
    
    for (const selector of dateSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const dateAttr = element.attr('datetime') || element.attr('data-published-date') || element.text().trim();
        if (dateAttr) {
          const parsedDate = new Date(dateAttr);
          if (!isNaN(parsedDate.getTime())) {
            created = parsedDate.toISOString();
            break;
          }
        }
      }
    }

    if (!headline || headline.length < 10) {
      return NextResponse.json({ error: 'Could not extract article headline' }, { status: 400 });
    }

    if (!body || body.length < 100) {
      return NextResponse.json({ error: 'Could not extract article content' }, { status: 400 });
    }

    // Format as article object matching the search results format
    const article = {
      headline: headline,
      body: body.substring(0, 50000), // Limit body length
      url: url,
      created: created,
      relevanceScore: 1000, // High score since user explicitly selected this URL
    };

    console.log('Successfully fetched article:', {
      headline: article.headline.substring(0, 100),
      bodyLength: article.body.length,
      url: article.url,
      created: article.created
    });

    return NextResponse.json({ 
      article: article,
      success: true
    });

  } catch (error: any) {
    console.error('Error fetching article from URL:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch article from URL.' 
    }, { status: 500 });
  }
}


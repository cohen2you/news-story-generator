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
    
    // Remove ALL unwanted elements aggressively - images, logos, tickers, etc.
    $('script, style, nav, header, footer, aside, .advertisement, .ad, .sidebar, .menu, .navigation, .social-share, .share-buttons, .comments, .related-articles, .newsletter, .subscribe, .cookie-notice, .popup, .modal').remove();
    
    // Remove ALL images and logo-related elements
    $('img, picture, svg, .logo, .ticker, .stock-price, .price-info, .market-data, .follow-button, .follow, .overview, .market-data, .price-display, .ticker-symbol, .bz-ticker, .bz-price, .bz-logo, .bz-follow, .bz-overview, .bz-market-data, [class*="logo"], [class*="ticker"], [class*="price"], [id*="logo"], [id*="ticker"], [id*="price"]').remove();
    
    // Remove elements that contain only stock symbols or prices
    $('*').each(function() {
      const $el = $(this);
      const text = $el.text().trim();
      if (text.match(/^[A-Z]{1,5}\$[\d,]+\.?\d*\s*[+-]?\d*\.?\d*%?$/)) {
        $el.remove();
      }
    });
    
    let articleText = '';
    
    // Try multiple strategies to find article content (same as news articles)
    const strategies = [
      // Strategy 1: Look for article tag (same as news)
      () => {
        const article = $('article').first();
        if (article.length) {
          console.log('Found article tag');
          return article.text().trim();
        }
        return '';
      },
      
      // Strategy 2: Look for main content areas (same as news)
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
          '.story-body',
          // Add PR-specific selectors
          '.press-release',
          '.pr-content',
          '.announcement',
          '.company-news',
          '.earnings-release',
          '.financial-news'
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
      
      // Strategy 3: Look for headline and extract following content (same as news)
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
              // Check if this content is mostly images or actual text
              const textWithoutImages = text.replace(/<[^>]*>/g, '').trim();
              const actualTextLength = textWithoutImages.length;
              
              // Only accept if it has substantial actual text (not just images)
              if (actualTextLength > 300) {
                console.log('Found substantial text content in headline container');
                return text;
              } else {
                console.log('Headline container has content but mostly images, skipping');
              }
            }
            container = container.parent();
          }
        }
        return '';
      },
      
      // Strategy 4: Extract all paragraphs and combine (same as news)
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
      console.log(`Strategy ${i + 1} found ${content.length} chars`);
      if (content.length > 50) { // Lower threshold to see what strategies find
        console.log(`Strategy ${i + 1} content preview:`, content.substring(0, 200));
      }
      if (content.length > 200) {
        articleText = content;
        console.log(`Strategy ${i + 1} successful: ${content.length} chars`);
        break;
      }
    }
    
    // Clean up the extracted text
    if (articleText) {
      console.log('Text before cleaning (first 1000 chars):', articleText.substring(0, 1000));
      console.log('Text before cleaning (last 500 chars):', articleText.substring(Math.max(0, articleText.length - 500)));
      
      articleText = articleText
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        // Remove HTML img tags only
        .replace(/<img[^>]*>/g, '') // Remove img tags
        .trim();
        
      console.log('Text after cleaning:', articleText.substring(0, 500));
      
      // Limit to 10000 characters
      if (articleText.length > 10000) {
        articleText = articleText.substring(0, 10000);
      }
    }
    
    console.log('Final extracted text length:', articleText.length);
    console.log('Text preview:', articleText.substring(0, 200));
    
    if (!articleText || articleText.length < 50) {
      return NextResponse.json({ error: 'Could not extract article content' }, { status: 400 });
    }

    return NextResponse.json({ text: articleText });
    
  } catch (error: any) {
    console.error('Error scraping URL:', error);
    return NextResponse.json({ error: 'Failed to scrape URL' }, { status: 500 });
  }
}
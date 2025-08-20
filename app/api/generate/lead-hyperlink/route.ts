import { NextResponse } from 'next/server';

const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { leadParagraph } = body;

    if (!leadParagraph) {
      return NextResponse.json({ error: 'Lead paragraph is required' }, { status: 400 });
    }

    console.log('Searching for lead hyperlink articles for paragraph:', leadParagraph.substring(0, 100) + '...');

    // Extract search terms from the lead paragraph using the same logic as the main search API
    const searchTerms = extractSearchTermsFromLead(leadParagraph);
    console.log('Extracted search terms from lead paragraph:', searchTerms);

    const allArticles: any[] = [];

    // Try each search term using the proven search logic
    for (const searchTerm of searchTerms.slice(0, 3)) { // Use top 3 search terms
      console.log('Trying search for term:', searchTerm);

      try {
        // Use the same proven search logic as the main search API
        const searchUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&topics=${encodeURIComponent(searchTerm)}&items=100&fields=headline,title,url,channels,body&displayOutput=full`;
        console.log('Trying topics search URL:', searchUrl.replace(BENZINGA_API_KEY, '[API_KEY_HIDDEN]'));
        
        const searchRes = await fetch(searchUrl, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (Array.isArray(searchData) && searchData.length > 0) {
            console.log(`Topics search returned ${searchData.length} articles for "${searchTerm}"`);
            allArticles.push(...searchData);
          }
        }
      } catch (error) {
        console.log('Search failed for term:', searchTerm, error);
      }
    }

    // If no results from topic searches, try a general search
    if (allArticles.length === 0) {
      console.log('No topic search results, trying general search...');
      const generalUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=100&fields=headline,title,url,channels,body&displayOutput=full`;
      
      try {
        const generalRes = await fetch(generalUrl, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (generalRes.ok) {
          const generalData = await generalRes.json();
          if (Array.isArray(generalData) && generalData.length > 0) {
            console.log(`General search returned ${generalData.length} articles`);
            allArticles.push(...generalData);
          }
        }
      } catch (error) {
        console.log('General search also failed:', error);
      }
    }

    if (allArticles.length === 0) {
      return NextResponse.json({ 
        articles: [],
        message: 'No relevant articles found for hyperlink selection'
      });
    }

    // Remove duplicates based on URL
    const uniqueArticles = allArticles.filter((article, index, self) => 
      index === self.findIndex(a => a.url === article.url)
    );

    console.log(`Found ${uniqueArticles.length} unique articles for hyperlink selection`);

    // Score and filter articles using the same logic as the main search API
    const scoredArticles = uniqueArticles
      .filter((article: any) => {
        // Exclude press releases and insights
        if (Array.isArray(article.channels) && article.channels.some((ch: any) => 
          typeof ch.name === 'string' && ['press-releases', 'insights'].includes(ch.name.toLowerCase())
        )) {
          return false;
        }
        
        if (article.url && article.url.startsWith('https://www.benzinga.com/insights/')) {
          return false;
        }
        
        return true;
      })
      .map((article: any) => {
        const headline = (article.headline || article.title || '').toLowerCase();
        const content = (article.body || '').toLowerCase();
        let score = 0;
        
        // Score based on search terms from the lead paragraph
        searchTerms.forEach(searchTerm => {
          const termLower = searchTerm.toLowerCase();
          
          if (headline.includes(termLower)) {
            score += 50; // Headline matches get high weight
          }
          if (content.includes(termLower)) {
            score += 25; // Content matches get medium weight
          }
        });
        
        // Bonus for financial/stock market content
        const financialTerms = ['stock', 'market', 'investor', 'analyst', 'earnings', 'trading', 'price', 'shares', 'financial', 'investment'];
        financialTerms.forEach(term => {
          if (headline.includes(term)) score += 20;
          if (content.includes(term)) score += 10;
        });
        
        // Bonus for recent articles (within last 7 days)
        if (article.created) {
          const articleDate = new Date(article.created);
          const now = new Date();
          const daysDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff <= 7) {
            score += 30; // Recent articles get bonus
          }
        }
        
        return { 
          ...article, 
          score,
          headline: article.headline || article.title || '[No Headline]',
          created: article.created,
          relevanceScore: score // Add relevanceScore for consistency with main search
        };
      })
      .filter(article => article.score > 0) // Only include articles with positive scores
      .sort((a, b) => b.score - a.score) // Sort by relevance
      .slice(0, 20); // Return top 20 articles for more variety

    console.log(`Returning ${scoredArticles.length} scored articles for hyperlink selection`);

    return NextResponse.json({
      articles: scoredArticles,
      totalFound: scoredArticles.length,
      searchTerms: searchTerms.slice(0, 5) // Return top 5 search terms for debugging
    });

  } catch (error: any) {
    console.error('Error in lead hyperlink search:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to search for hyperlink articles' 
    }, { status: 500 });
  }
}

// Function to extract search terms from lead paragraph using the same logic as main search API
function extractSearchTermsFromLead(leadParagraph: string): string[] {
  const cleanText = leadParagraph.replace(/<[^>]*>/g, '').toLowerCase();
  const searchTerms: string[] = [];
  
  // Extract company names and tickers
  const companyPatterns = [
    /apple\s+inc/i,
    /tesla\s+inc/i,
    /amazon\.com/i,
    /microsoft\s+corporation/i,
    /carvana\s+co/i,
    /novo\s+nordisk/i,
    /palo\s+alto\s+networks/i,
    /hertz\s+global/i,
    /general\s+motors/i,
    /ford\s+motor/i,
    /donald\s+trump/i,
    /joe\s+biden/i,
    /lisa\s+cook/i,
    /bill\s+pulte/i
  ];
  
  companyPatterns.forEach(pattern => {
    const match = cleanText.match(pattern);
    if (match) {
      searchTerms.push(match[0]);
    }
  });
  
  // Extract ticker symbols
  const tickerMatch = cleanText.match(/nasdaq:\s*([a-z]+)/i);
  if (tickerMatch) {
    searchTerms.push(tickerMatch[1].toUpperCase());
  }
  
  // Extract key business and financial terms
  const keyTerms = [
    'encryption', 'privacy', 'cyberattacks', 'back door', 'end-to-end encryption',
    'earnings', 'revenue', 'profit', 'analyst', 'rating', 'price target',
    'stock', 'market', 'trading', 'investor', 'investment',
    'government', 'policy', 'regulation', 'legal', 'court',
    'used car', 'car sales', 'automotive', 'rental car',
    'mortgage fraud', 'bank documents', 'loan terms', 'resignation', 'allegations',
    'federal reserve', 'federal housing finance agency', 'fhfa'
  ];
  
  keyTerms.forEach(term => {
    if (cleanText.includes(term)) {
      searchTerms.push(term);
    }
  });
  
  // Extract specific phrases that indicate the story topic
  const specificPhrases = [
    'jim cramer', 'cnbc', 'online used car', 'used car dealer',
    'diabetes drug', 'weight loss', 'ozempic', 'wegovy',
    'artificial intelligence', 'ai', 'machine learning',
    'electric vehicle', 'ev', 'autonomous driving',
    'rental car', 'car rental', 'fleet management'
  ];
  
  specificPhrases.forEach(phrase => {
    if (cleanText.includes(phrase)) {
      searchTerms.push(phrase);
    }
  });
  
  // Extract government entities
  const governmentTerms = ['u.s. government', 'u.k. government', 'federal government', 'biden administration'];
  governmentTerms.forEach(term => {
    if (cleanText.includes(term)) {
      searchTerms.push(term);
    }
  });
  
  // Extract action words that indicate what happened
  const actionTerms = ['announced', 'reported', 'revealed', 'launched', 'acquired', 'merged', 'filed', 'sued', 'demanded', 'resignation', 'allegations', 'falsified', 'secured', 'prompting', 'call for'];
  actionTerms.forEach(term => {
    if (cleanText.includes(term)) {
      searchTerms.push(term);
    }
  });
  
  // Remove duplicates and return top search terms
  const uniqueSearchTerms = searchTerms.filter((term, index, self) => 
    index === self.findIndex(t => t === term)
  );
  
  return uniqueSearchTerms.slice(0, 8); // Return top 8 search terms
}

import { NextResponse } from 'next/server';

const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';

export async function POST(request: Request) {
  try {
    const { searchTerm } = await request.json();
    
    if (!searchTerm || searchTerm.trim() === '') {
      return NextResponse.json({ error: 'Search term is required.' }, { status: 400 });
    }

    // Get articles from the last 90 days and increase the limit significantly
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 90);
    const dateFromStr = dateFrom.toISOString().slice(0, 10);
    
    // Build the API URL - use the correct Benzinga API parameters
    let url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&topics=${encodeURIComponent(searchTerm)}&items=500&fields=headline,title,url,channels,body&displayOutput=full`;
    
    // Valid Benzinga API search parameters (in order of preference)
    const searchParams = [
      `topics=${encodeURIComponent(searchTerm)}`,  // Primary: searches Title, Tags, and Body
      `authors=${encodeURIComponent(searchTerm)}`, // Fallback: search by author
      `tickers=${encodeURIComponent(searchTerm)}`  // Fallback: search by ticker symbol
    ];
    
    console.log('Making API call to:', url.replace(BENZINGA_API_KEY, '[API_KEY_HIDDEN]'));
    console.log('Search URL (with API key hidden):', url.replace(BENZINGA_API_KEY, '[API_KEY_HIDDEN]'));
    
    // Define relevant tickers for different search terms
    const tickerMap: { [key: string]: string[] } = {
      'wegovy': ['NVO', 'LLY'],
      'ozempic': ['NVO'],
      'weight loss': ['NVO', 'LLY', 'PFE'],
      'novo nordisk': ['NVO'],
      'eli lilly': ['LLY'],
      'pfizer': ['PFE'],
      'tesla': ['TSLA'],
      'apple': ['AAPL'],
      'amazon': ['AMZN'],
      'microsoft': ['MSFT'],
      'nvidia': ['NVDA'],
      'hertz': ['HTZ', 'HTZGQ'],
      // Add direct ticker symbol mappings
      'aapl': ['AAPL'],
      'tsla': ['TSLA'],
      'amzn': ['AMZN'],
      'msft': ['MSFT'],
      'nvda': ['NVDA'],
      'nvo': ['NVO'],
      'lly': ['LLY'],
      'pfe': ['PFE'],
      'htz': ['HTZ', 'HTZGQ'],
      'htzgq': ['HTZ', 'HTZGQ']
    };
    
    const searchTermLower = searchTerm.toLowerCase();
    const relevantTickers = tickerMap[searchTermLower] || [];
    
    console.log(`Search term "${searchTerm}" maps to tickers: ${relevantTickers.join(', ')}`);
    console.log(`Search term lower: "${searchTermLower}"`);
    console.log(`Relevant tickers found: ${relevantTickers.length > 0 ? 'Yes' : 'No'}`);
    
    // Make API calls for each relevant ticker, or make a search if no tickers found
    const allArticles: any[] = [];
    const seenUrls = new Set<string>(); // Track seen URLs to avoid duplicates
    const maxCalls = relevantTickers.length > 0 ? relevantTickers.length : 1; // One call per ticker, or one search call
    
    // Helper function to add articles without duplicates
    const addArticlesWithoutDuplicates = (articles: any[]) => {
      if (!Array.isArray(articles)) return;
      
      articles.forEach(article => {
        const url = article.url;
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
          allArticles.push(article);
        }
      });
    };
    
    // Always try search first, regardless of ticker mapping
    console.log('Trying Benzinga search functionality...');
    
    // Try the primary search approach using topics parameter
    try {
      const searchUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&topics=${encodeURIComponent(searchTerm)}&items=500&fields=headline,title,url,channels,body&displayOutput=full`;
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
          addArticlesWithoutDuplicates(searchData);
        } else {
          console.log('Topics search returned no results, trying alternative parameters...');
          
          // Try alternative search parameters
          for (const param of searchParams.slice(1)) {
            const altUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&${param}&items=500&fields=headline,title,url,channels,body&displayOutput=full`;
            console.log('Trying alternative URL:', altUrl.replace(BENZINGA_API_KEY, '[API_KEY_HIDDEN]'));
            
            try {
              const altRes = await fetch(altUrl, {
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                }
              });
              
              if (altRes.ok) {
                const altData = await altRes.json();
                if (Array.isArray(altData) && altData.length > 0) {
                  console.log(`Alternative parameter (${param}) returned ${altData.length} articles`);
                  addArticlesWithoutDuplicates(altData);
                  break;
                }
              }
            } catch (error) {
              console.log('Alternative search failed:', error);
            }
          }
        }
      }
    } catch (error) {
      console.log('Topics search failed, falling back to general search:', error);
    }
    
    // If no search results, fall back to general search
    if (allArticles.length === 0) {
      console.log('No search results found, falling back to general search...');
      const generalUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=500&fields=headline,title,url,channels,body&displayOutput=full`;
      console.log('Trying general search URL:', generalUrl.replace(BENZINGA_API_KEY, '[API_KEY_HIDDEN]'));
      
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
            addArticlesWithoutDuplicates(generalData);
          }
        }
      } catch (error) {
        console.log('General search also failed:', error);
      }
    }
    
    // Also try ticker-based searches if we have relevant tickers
    for (let i = 0; i < maxCalls; i++) {
      try {
        // Build URL with ticker if available
        let currentUrl = url;
        if (relevantTickers.length > 0 && i < relevantTickers.length) {
          currentUrl = `${url}&tickers=${encodeURIComponent(relevantTickers[i])}`;
          console.log(`Making API call ${i + 1} for ticker ${relevantTickers[i]}:`, currentUrl.replace(BENZINGA_API_KEY, '[API_KEY_HIDDEN]'));
        } else {
          console.log(`Making API call ${i + 1} (general):`, currentUrl.replace(BENZINGA_API_KEY, '[API_KEY_HIDDEN]'));
        }
        
        const res = await fetch(currentUrl, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!res.ok) {
          console.error(`Benzinga API error on call ${i + 1}:`, await res.text());
          break;
        }
        
        const data = await res.json();
        
        console.log(`Call ${i + 1} response type:`, typeof data);
        console.log(`Call ${i + 1} response length:`, Array.isArray(data) ? data.length : 'Not an array');
        
        if (!Array.isArray(data) || data.length === 0) {
          console.log(`No articles returned on call ${i + 1}`);
          if (!Array.isArray(data)) {
            console.log(`Call ${i + 1} response structure:`, JSON.stringify(data, null, 2).substring(0, 500));
          }
          break;
        }
        
        addArticlesWithoutDuplicates(data);
        console.log(`Call ${i + 1}: Got ${data.length} articles, total unique so far: ${allArticles.length}`);
        
        // If we got fewer articles than requested, we've probably reached the end
        if (data.length < 20) {
          break;
        }
        
        // Small delay between calls to avoid rate limiting
        if (i < maxCalls - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error on API call ${i + 1}:`, error);
        break;
      }
    }
    
    const data = allArticles;
    console.log('Total articles collected:', data.length);
    console.log('API Response type:', typeof data);
    console.log('API Response length:', Array.isArray(data) ? data.length : 'Not an array');
    
    // Log the first few articles to see what we're getting
    if (Array.isArray(data) && data.length > 0) {
      console.log('First 3 articles from API:');
      data.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. Headline: ${item.headline || item.title}`);
        console.log(`   Created: ${item.created}`);
        console.log(`   URL: ${item.url}`);
        console.log('---');
      });
    }
    
    if (!Array.isArray(data)) {
      console.log('API Response structure:', JSON.stringify(data, null, 2).substring(0, 500));
      return NextResponse.json({ error: 'Invalid response from Benzinga API.' }, { status: 500 });
    }
    
    // Filter out press releases
    const prChannelNames = ['press releases', 'press-releases', 'pressrelease', 'pr'];
    const normalize = (str: string) => str.toLowerCase().replace(/[-_]/g, ' ');
    
    console.log(`Searching for "${searchTerm}" in ${data.length} articles from Benzinga API`);
    console.log(`Using ${relevantTickers.length > 0 ? 'ticker-based' : 'topics-based'} search logic`);
    
    // Filter articles - be more permissive for ticker-based searches
    let processedCount = 0;
    const matchingArticles = data
      .filter((item: any) => {
        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`DEBUG: Processed ${processedCount}/${data.length} articles...`);
        }
        // Exclude press releases
        if (Array.isArray(item.channels) && item.channels.some((ch: any) => 
          typeof ch.name === 'string' && prChannelNames.includes(normalize(ch.name))
        )) {
          console.log('DEBUG: Filtered out PR article:', item.headline || item.title);
          return false;
        }
        
        // Exclude insights articles
        if (item.url && item.url.startsWith('https://www.benzinga.com/insights/')) {
          console.log('DEBUG: Filtered out insights article:', item.headline || item.title);
          return false;
        }
        
        // If we're using ticker-based search, be more permissive
        if (relevantTickers.length > 0) {
          // For ticker searches, include all articles unless they're clearly irrelevant
          const headline = (item.headline || item.title || '').toLowerCase();
          const body = (item.body || '').toLowerCase();
          
          // Still check for exact matches first (highest priority)
          if (headline.includes(searchTermLower) || body.includes(searchTermLower)) {
            console.log('DEBUG: Found exact match:', item.headline || item.title);
            return true;
          }
          
          // For ticker searches, include articles that might be related
          const relatedTerms = getRelatedTerms(searchTermLower);
          const hasRelatedTerms = relatedTerms.some((term: string) => 
            headline.includes(term) || body.includes(term)
          );
          
          // Include if it has related terms, or if it's a recent article (within last 7 days)
          if (hasRelatedTerms) {
            console.log('DEBUG: Found related terms match:', item.headline || item.title, 'Related terms:', relatedTerms);
            return true;
          }
          
          // Check if it's a recent article
          if (item.created) {
            const now = new Date();
            const articleDate = new Date(item.created);
            if (!isNaN(articleDate.getTime())) {
              const daysDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
              if (daysDiff <= 7) {
                console.log('DEBUG: Found recent article (within 7 days):', item.headline || item.title, 'Days old:', daysDiff.toFixed(1));
                return true; // Include recent articles from the ticker
              }
            }
          }
          
          return false;
        } else {
          // For general searches, since we're now using Benzinga's topics search,
          // we can be more permissive - if the article was returned by the API,
          // it likely contains relevant content
          const headline = (item.headline || item.title || '').toLowerCase();
          const body = (item.body || '').toLowerCase();
          
          // Check for exact phrase match first (highest priority)
          if (headline.includes(searchTermLower) || body.includes(searchTermLower)) {
            console.log('DEBUG: Found exact match (topics search):', item.headline || item.title);
            return true;
          }
          
          // Split search term into individual words for more flexible matching
          const searchWords = searchTermLower.split(/\s+/).filter((word: string) => word.length > 1);
          
          // Since Benzinga's topics search already filtered for relevance,
          // include articles that contain any of the search words
          if (searchWords.length > 0) {
            const hasAnyWord = searchWords.some((word: string) => 
              headline.includes(word) || body.includes(word)
            );
            if (hasAnyWord) {
              console.log('DEBUG: Found word match (topics search):', item.headline || item.title, 'Words found:', searchWords.filter((word: string) => headline.includes(word) || body.includes(word)));
              return true;
            }
          }
          
          // For single word searches, since we're using Benzinga's topics search,
          // the API should have already filtered for relevance
          if (searchWords.length === 1) {
            const word = searchWords[0];
            
            // Check for exact word match
            if (headline.includes(word) || body.includes(word)) {
              console.log('DEBUG: Found word match (topics search):', item.headline || item.title, 'Word:', word);
              return true;
            }
          }
          
          // If no matches found, return false
          return false;
        }
      })
      .map((item: any) => ({
        headline: item.headline || item.title || '[No Headline]',
        body: item.body || '',
        url: item.url,
        created: item.created,
        // Calculate relevance score based on how prominently the search term appears in headline and body
        relevanceScore: calculateRelevanceScore(item.headline || item.title || '', item.body || '', searchTermLower, item.created)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance
      .slice(0, 15); // Return top 15 articles (increased from 7)
    
    console.log(`Found ${matchingArticles.length} matching articles for "${searchTerm}"`);
    
    // Add debugging to show what was found and what was filtered
    if (matchingArticles.length > 0) {
      console.log('DEBUG: Matching articles found:');
      matchingArticles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.headline} (Score: ${article.relevanceScore})`);
      });
    }
    
    // Show some articles that were filtered out for debugging
    const filteredOutCount = data.length - matchingArticles.length;
    if (filteredOutCount > 0) {
      console.log(`DEBUG: ${filteredOutCount} articles were filtered out`);
      console.log('DEBUG: Sample of filtered articles:');
      data.slice(0, 5).forEach((item, index) => {
        const headline = (item.headline || item.title || '').toLowerCase();
        const body = (item.body || '').toLowerCase();
        const hasSearchTerm = headline.includes(searchTermLower) || body.includes(searchTermLower);
        console.log(`${index + 1}. ${item.headline || item.title} - Contains "${searchTermLower}": ${hasSearchTerm}`);
        
        // Check if it was filtered out as PR or insights
        const isPR = Array.isArray(item.channels) && item.channels.some((ch: any) => 
          typeof ch.name === 'string' && prChannelNames.includes(normalize(ch.name))
        );
        const isInsights = item.url && item.url.startsWith('https://www.benzinga.com/insights/');
        console.log(`   - Is PR: ${isPR}, Is Insights: ${isInsights}`);
      });
    }
    
    // If no results, let's log some sample articles to debug
    if (matchingArticles.length === 0 && data.length > 0) {
      console.log('DEBUG: No matching articles found, checking why...');
      console.log('DEBUG: Total articles from API:', data.length);
      console.log('DEBUG: Search term:', searchTermLower);
      console.log('DEBUG: Relevant tickers:', relevantTickers);
      console.log('Sample articles from the dataset:');
      data.slice(0, 10).forEach((item: any, index: number) => {
        console.log(`${index + 1}. Headline: ${item.headline || item.title}`);
        console.log(`   Body preview: ${(item.body || '').substring(0, 150)}...`);
        console.log(`   Created: ${item.created}`);
        console.log('---');
      });
      
      // Also check if any articles contain related terms
      const relatedTerms = ['weight', 'loss', 'drug', 'pharma', 'novo', 'nordisk', 'ozempic', 'semaglutide'];
      const relatedArticles = data.filter((item: any) => {
        const headline = (item.headline || item.title || '').toLowerCase();
        const body = (item.body || '').toLowerCase();
        return relatedTerms.some((term: string) => headline.includes(term) || body.includes(term));
      });
      
      if (relatedArticles.length > 0) {
        console.log(`Found ${relatedArticles.length} articles with related terms:`);
        relatedArticles.slice(0, 5).forEach((item: any, index: number) => {
          console.log(`${index + 1}. Headline: ${item.headline || item.title}`);
        });
      }
    }
    
    // If no exact matches found, try searching for related terms
    if (matchingArticles.length === 0) {
      console.log('No exact matches found, trying related terms...');
      
      // Define related terms for common search topics
      const relatedTermsMap: { [key: string]: string[] } = {
        'wegovy': ['ozempic', 'semaglutide', 'novo nordisk', 'weight loss', 'obesity'],
        'weight loss': ['wegovy', 'ozempic', 'semaglutide', 'obesity', 'novo nordisk'],
        'ozempic': ['wegovy', 'semaglutide', 'novo nordisk', 'weight loss', 'diabetes'],
        'novo nordisk': ['wegovy', 'ozempic', 'semaglutide', 'weight loss', 'obesity'],
        'tesla': ['tsla', 'elon musk', 'electric vehicle', 'ev'],
        'apple': ['aapl', 'iphone', 'tim cook', 'tech'],
        'amazon': ['amzn', 'jeff bezos', 'ecommerce', 'aws'],
        'hertz': ['htz', 'htzgq', 'car rental', 'automotive', 'rental car'],
        // Add ticker symbol mappings
        'aapl': ['apple', 'iphone', 'tim cook', 'tech', 'smartphone', 'ios'],
        'tsla': ['tesla', 'elon musk', 'electric vehicle', 'ev', 'car', 'automotive'],
        'amzn': ['amazon', 'jeff bezos', 'ecommerce', 'aws', 'cloud', 'retail'],
        'msft': ['microsoft', 'satya nadella', 'azure', 'cloud', 'software', 'tech'],
        'nvda': ['nvidia', 'ai', 'artificial intelligence', 'gpu', 'chip', 'semiconductor'],
        'htz': ['hertz', 'car rental', 'automotive', 'rental car'],
        'htzgq': ['hertz', 'car rental', 'automotive', 'rental car']
      };
      
      const relatedTerms = relatedTermsMap[searchTerm.toLowerCase()] || [];
      
      if (relatedTerms.length > 0) {
        console.log(`Trying related terms: ${relatedTerms.join(', ')}`);
        
        const relatedArticles = data
          .filter((item: any) => {
            // Exclude press releases
            if (Array.isArray(item.channels) && item.channels.some((ch: any) => 
              typeof ch.name === 'string' && prChannelNames.includes(normalize(ch.name))
            )) {
              return false;
            }
            
            // Exclude insights articles
            if (item.url && item.url.startsWith('https://www.benzinga.com/insights/')) {
              return false;
            }
            
            const headline = (item.headline || item.title || '').toLowerCase();
            const body = (item.body || '').toLowerCase();
            
            // Check if any related term appears in headline or body
            return relatedTerms.some((term: string) => 
              headline.includes(term.toLowerCase()) || body.includes(term.toLowerCase())
            );
          })
          .map((item: any) => ({
            headline: item.headline || item.title || '[No Headline]',
            body: item.body || '',
            url: item.url,
            created: item.created,
            relevanceScore: calculateRelevanceScore(item.headline || item.title || '', item.body || '', searchTermLower, item.created)
          }))
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 7);
        
        console.log(`Found ${relatedArticles.length} articles with related terms`);
        
        if (relatedArticles.length > 0) {
          return NextResponse.json({ 
            articles: relatedArticles,
            searchTerm: searchTerm,
            totalFound: relatedArticles.length,
            note: 'Results include related terms'
          });
        }
      }
    }
    
    // Add final debugging before returning
    console.log('DEBUG: Final response details:');
    console.log(`- Total articles found: ${matchingArticles.length}`);
    console.log(`- Articles array length: ${matchingArticles.length}`);
    console.log(`- First article: ${matchingArticles[0]?.headline || 'None'}`);
    console.log(`- All articles:`, matchingArticles.map(a => a.headline));
    console.log(`- Response structure:`, {
      articles: matchingArticles.length,
      searchTerm: searchTerm,
      totalFound: matchingArticles.length
    });
    
    return NextResponse.json({ 
      articles: matchingArticles,
      searchTerm: searchTerm,
      totalFound: matchingArticles.length
    });
    
  } catch (error: any) {
    console.error('Error searching Benzinga articles:', error);
    return NextResponse.json({ error: error.message || 'Failed to search articles.' }, { status: 500 });
  }
}

function calculateRelevanceScore(headline: string, body: string, searchTerm: string, createdDate?: string): number {
  const headlineLower = headline.toLowerCase();
  const bodyLower = body.toLowerCase();
  let score = 0;
  
  // Headline matches get higher scores
  if (headlineLower.includes(searchTerm)) {
    score += 100;
  }
  
  // Body matches get lower scores but still count
  if (bodyLower.includes(searchTerm)) {
    score += 50;
  }
  
  // Check for word boundary matches (more precise)
  const wordBoundaryPattern = new RegExp(`\\b${searchTerm}\\b`, 'i');
  if (wordBoundaryPattern.test(headline)) {
    score += 25; // Bonus for exact word match in headline
  }
  if (wordBoundaryPattern.test(body)) {
    score += 15; // Bonus for exact word match in body
  }
  
  // Check for individual word matches in headline
  const searchWords = searchTerm.split(/\s+/);
  const headlineWords = headlineLower.split(/\s+/);
  
  searchWords.forEach((word: string) => {
    if (headlineWords.includes(word)) {
      score += 20;
    }
  });
  
  // Check for individual word matches in body
  const bodyWords = bodyLower.split(/\s+/);
  searchWords.forEach((word: string) => {
    if (bodyWords.includes(word)) {
      score += 10;
    }
  });
  
  // Bonus for search term appearing at the beginning of headline
  if (headlineLower.startsWith(searchTerm)) {
    score += 50;
  }
  
  // Bonus for recent articles (within last 24 hours)
  if (createdDate) {
    const now = new Date();
    const articleDate = new Date(createdDate);
    if (!isNaN(articleDate.getTime())) {
      const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
      if (hoursDiff <= 24) {
        score += 30;
      } else if (hoursDiff <= 72) {
        score += 15;
      }
    }
  }
  
  return score;
}

function getRelatedTerms(searchTerm: string): string[] {
  const relatedTermsMap: { [key: string]: string[] } = {
    'wegovy': ['ozempic', 'semaglutide', 'novo nordisk', 'weight loss', 'obesity', 'diabetes', 'pharma', 'drug'],
    'ozempic': ['wegovy', 'semaglutide', 'novo nordisk', 'weight loss', 'obesity', 'diabetes', 'pharma', 'drug'],
    'weight loss': ['wegovy', 'ozempic', 'semaglutide', 'obesity', 'novo nordisk', 'eli lilly', 'pharma', 'drug'],
    'novo nordisk': ['wegovy', 'ozempic', 'semaglutide', 'weight loss', 'obesity', 'diabetes', 'pharma', 'drug'],
    'eli lilly': ['mounjaro', 'zepbound', 'tirzepatide', 'weight loss', 'obesity', 'diabetes', 'pharma', 'drug'],
    'tesla': ['tsla', 'elon musk', 'electric vehicle', 'ev', 'car', 'automotive'],
    'apple': ['aapl', 'iphone', 'tim cook', 'tech', 'smartphone', 'ios'],
    'amazon': ['amzn', 'jeff bezos', 'ecommerce', 'aws', 'cloud', 'retail'],
    'microsoft': ['msft', 'satya nadella', 'azure', 'cloud', 'software', 'tech'],
    'nvidia': ['nvda', 'ai', 'artificial intelligence', 'gpu', 'chip', 'semiconductor'],
    'hertz': ['htz', 'htzgq', 'car rental', 'automotive', 'rental car'],
    // Add ticker symbol mappings
    'aapl': ['apple', 'iphone', 'tim cook', 'tech', 'smartphone', 'ios'],
    'tsla': ['tesla', 'elon musk', 'electric vehicle', 'ev', 'car', 'automotive'],
    'amzn': ['amazon', 'jeff bezos', 'ecommerce', 'aws', 'cloud', 'retail'],
    'msft': ['microsoft', 'satya nadella', 'azure', 'cloud', 'software', 'tech'],
    'nvda': ['nvidia', 'ai', 'artificial intelligence', 'gpu', 'chip', 'semiconductor'],
    'htz': ['hertz', 'car rental', 'automotive', 'rental car'],
    'htzgq': ['hertz', 'car rental', 'automotive', 'rental car']
  };
  
  return relatedTermsMap[searchTerm] || [];
}

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
    
    // Build the API URL - use ticker-based search instead of text search
    const url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=20&fields=headline,title,url,channels,body&displayOutput=full`;
    
    console.log('Making API call to:', url.replace(BENZINGA_API_KEY, '[API_KEY_HIDDEN]'));
    
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
      // Add direct ticker symbol mappings
      'aapl': ['AAPL'],
      'tsla': ['TSLA'],
      'amzn': ['AMZN'],
      'msft': ['MSFT'],
      'nvda': ['NVDA'],
      'nvo': ['NVO'],
      'lly': ['LLY'],
      'pfe': ['PFE']
    };
    
    const searchTermLower = searchTerm.toLowerCase();
    const relevantTickers = tickerMap[searchTermLower] || [];
    
    console.log(`Search term "${searchTerm}" maps to tickers: ${relevantTickers.join(', ')}`);
    
    // Make API calls for each relevant ticker
    const allArticles = [];
    const maxCalls = relevantTickers.length > 0 ? relevantTickers.length : 1; // One call per ticker, or one general call
    
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
        
        allArticles.push(...data);
        console.log(`Call ${i + 1}: Got ${data.length} articles, total so far: ${allArticles.length}`);
        
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
    
    console.log(`Searching for "${searchTerm}" in ${data.length} articles from the last 90 days`);
    
              // Filter articles - be more permissive for ticker-based searches
     const matchingArticles = data
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
         
         // If we're using ticker-based search, be more permissive
         if (relevantTickers.length > 0) {
           // For ticker searches, include all articles unless they're clearly irrelevant
           const headline = (item.headline || item.title || '').toLowerCase();
           const body = (item.body || '').toLowerCase();
           
           // Still check for exact matches first (highest priority)
           if (headline.includes(searchTermLower) || body.includes(searchTermLower)) {
             return true;
           }
           
           // For ticker searches, include articles that might be related
           const relatedTerms = getRelatedTerms(searchTermLower);
           const hasRelatedTerms = relatedTerms.some((term: string) => 
             headline.includes(term) || body.includes(term)
           );
           
           // Include if it has related terms, or if it's a recent article (within last 7 days)
           if (hasRelatedTerms) {
             return true;
           }
           
           // Check if it's a recent article
           if (item.created) {
             const now = new Date();
             const articleDate = new Date(item.created);
             if (!isNaN(articleDate.getTime())) {
               const daysDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
               if (daysDiff <= 7) {
                 return true; // Include recent articles from the ticker
               }
             }
           }
           
           return false;
         } else {
           // For non-ticker searches, use the original logic
           const headline = (item.headline || item.title || '').toLowerCase();
           const body = (item.body || '').toLowerCase();
           
           // Split search term into individual words for more flexible matching
           const searchWords = searchTermLower.split(/\s+/).filter((word: string) => word.length > 1);
           
           // Check for exact phrase match first (highest priority)
           if (headline.includes(searchTermLower) || body.includes(searchTermLower)) {
             return true;
           }
           
           // Check for individual word matches
           if (searchWords.length > 1) {
             const headlineWordCount = searchWords.filter((word: string) => headline.includes(word)).length;
             const bodyWordCount = searchWords.filter((word: string) => body.includes(word)).length;
             return headlineWordCount >= 1 || bodyWordCount >= 1;
           }
           
           // For single word searches, use exact match
           return headline.includes(searchTermLower) || body.includes(searchTermLower);
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
      .slice(0, 7); // Return top 7 articles
    
    console.log(`Found ${matchingArticles.length} matching articles for "${searchTerm}"`);
    
    // If no results, let's log some sample articles to debug
    if (matchingArticles.length === 0 && data.length > 0) {
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
        // Add ticker symbol mappings
        'aapl': ['apple', 'iphone', 'tim cook', 'tech', 'smartphone', 'ios'],
        'tsla': ['tesla', 'elon musk', 'electric vehicle', 'ev', 'car', 'automotive'],
        'amzn': ['amazon', 'jeff bezos', 'ecommerce', 'aws', 'cloud', 'retail'],
        'msft': ['microsoft', 'satya nadella', 'azure', 'cloud', 'software', 'tech'],
        'nvda': ['nvidia', 'ai', 'artificial intelligence', 'gpu', 'chip', 'semiconductor']
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
       // Add ticker symbol mappings
       'aapl': ['apple', 'iphone', 'tim cook', 'tech', 'smartphone', 'ios'],
       'tsla': ['tesla', 'elon musk', 'electric vehicle', 'ev', 'car', 'automotive'],
       'amzn': ['amazon', 'jeff bezos', 'ecommerce', 'aws', 'cloud', 'retail'],
       'msft': ['microsoft', 'satya nadella', 'azure', 'cloud', 'software', 'tech'],
       'nvda': ['nvidia', 'ai', 'artificial intelligence', 'gpu', 'chip', 'semiconductor']
     };
     
     return relatedTermsMap[searchTerm] || [];
   }

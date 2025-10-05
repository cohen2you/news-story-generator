import { NextResponse } from 'next/server';

const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';

export async function POST(request: Request) {
  try {
    const { searchTerm } = await request.json();
    
    if (!searchTerm || searchTerm.trim() === '') {
      return NextResponse.json({ error: 'Search term is required.' }, { status: 400 });
    }

    console.log('Enhanced search for term:', searchTerm);

    // Enhanced multiword search processing
    const searchTerms = processMultiwordSearch(searchTerm);
    console.log('Processed search terms:', searchTerms);
    console.log('Number of search terms:', searchTerms.length);
    console.log('Original search term:', searchTerm);

    // Search strategy: Try recent first (30 days), then fall back to 6 months
    const searchDateRanges = [
      { days: 30, label: 'last 30 days' },
      { days: 180, label: 'last 6 months' }
    ];
    
    let allArticles: any[] = [];
    let searchUsed = '';
    
    for (const dateRange of searchDateRanges) {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - dateRange.days);
      const dateFromStr = dateFrom.toISOString().slice(0, 10);
      
      console.log(`Searching for articles from ${dateFromStr} (${dateRange.label})`);
      
      allArticles = [];
      const seenUrls = new Set<string>();

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

      // Try multiple search strategies for better multiword matching
      for (const term of searchTerms) {
      console.log('Searching for term:', term);
      
      try {
        // Strategy 1: Try multiple search approaches to see what works
        const searchUrls = [
          // Current approach
          `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&topics=${encodeURIComponent(term)}&items=500&fields=headline,title,url,channels,body,created&displayOutput=full&dateFrom=${dateFromStr}&sort=created`,
          // Try headline-specific search
          `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&headline=${encodeURIComponent(term)}&items=200&fields=headline,title,url,channels,body,created&displayOutput=full&dateFrom=${dateFromStr}&sort=created`,
          // Try title-specific search  
          `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&title=${encodeURIComponent(term)}&items=200&fields=headline,title,url,channels,body,created&displayOutput=full&dateFrom=${dateFromStr}&sort=created`
        ];
        
        // Try each search approach
        for (const searchUrl of searchUrls) {
          try {
            const res = await fetch(searchUrl, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                console.log(`Search returned ${data.length} articles for "${term}" using URL: ${searchUrl.split('?')[1].split('&')[0]}`);
                addArticlesWithoutDuplicates(data);
              }
            } else {
              console.log(`Search failed for URL: ${searchUrl.split('?')[1].split('&')[0]} - Status: ${res.status}`);
            }
          } catch (error) {
            console.log(`Search error for URL: ${searchUrl.split('?')[1].split('&')[0]}`, error);
          }
        }

        // Strategy 2: Individual word search for multiword terms
        if (term.includes(' ')) {
          const words = term.split(' ').filter(word => word.length > 2);
          for (const word of words.slice(0, 3)) { // Use top 3 words
            const wordSearchUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&topics=${encodeURIComponent(word)}&items=300&fields=headline,title,url,channels,body,created&displayOutput=full&dateFrom=${dateFromStr}&sort=created`;
            
            const wordRes = await fetch(wordSearchUrl, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            
            if (wordRes.ok) {
              const wordData = await wordRes.json();
              if (Array.isArray(wordData) && wordData.length > 0) {
                console.log(`Word search returned ${wordData.length} articles for "${word}"`);
                addArticlesWithoutDuplicates(wordData);
              }
            }
          }
        }

        // Strategy 3: Related terms search
        const relatedTerms = getRelatedTerms(term);
        for (const relatedTerm of relatedTerms.slice(0, 2)) {
          const relatedSearchUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&topics=${encodeURIComponent(relatedTerm)}&items=300&fields=headline,title,url,channels,body,created&displayOutput=full&dateFrom=${dateFromStr}&sort=created`;
          
          const relatedRes = await fetch(relatedSearchUrl, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (relatedRes.ok) {
            const relatedData = await relatedRes.json();
            if (Array.isArray(relatedData) && relatedData.length > 0) {
              console.log(`Related search returned ${relatedData.length} articles for "${relatedTerm}"`);
              addArticlesWithoutDuplicates(relatedData);
            }
          }
        }

        } catch (error) {
          console.log('Search failed for term:', term, error);
        }
      }

      console.log(`Total articles found for ${dateRange.label}: ${allArticles.length}`);
      
      // Process and filter articles to check for relevance
      if (allArticles.length > 0) {
        const now = new Date();
        const dateThreshold = new Date(now.getTime() - (dateRange.days * 24 * 60 * 60 * 1000));
        let processedCount = 0;
        
        const matchingArticles = allArticles
          .filter((item: any) => {
            processedCount++;
            
            // Exclude press releases and insights
            if (Array.isArray(item.channels) && item.channels.some((ch: any) => 
              typeof ch.name === 'string' && ['press-releases', 'insights'].includes(ch.name.toLowerCase())
            )) {
              return false;
            }
            
            if (item.url && item.url.startsWith('https://www.benzinga.com/insights/')) {
              return false;
            }
            
            // Dynamic date filtering based on search range used
            if (item.created) {
              const articleDate = new Date(item.created);
              if (articleDate < dateThreshold) {
                return false;
              }
            }
            
            return true;
          })
          .map((item: any) => {
            const headline = (item.headline || item.title || '').toLowerCase();
            const body = (item.body || '').toLowerCase();
            const createdDate = item.created;
            
            // Enhanced relevance scoring with date context
            const score = calculateEnhancedRelevanceScore(headline, body, searchTerm, createdDate);
            
            return {
              ...item,
              headline: item.headline || item.title || '[No Headline]',
              created: createdDate,
              relevanceScore: score,
              dateContext: getDateContext(createdDate)
            };
          })
          .filter(item => {
            // For person name searches (2 words), require exact phrase match
            const searchWords = searchTerm.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
            if (searchWords.length === 2) {
              // For person names, only return articles that contain the exact phrase
              const headlineLower = (item.headline || '').toLowerCase();
              const bodyLower = (item.body || '').toLowerCase();
              const exactPhrase = searchTerm.toLowerCase();
              return headlineLower.includes(exactPhrase) || bodyLower.includes(exactPhrase);
            }
            return item.relevanceScore > 0; // Normal threshold for other searches
          })
          .sort((a, b) => {
            // First sort by date (newest first), then by relevance score
            const dateA = new Date(a.created || 0);
            const dateB = new Date(b.created || 0);
            const dateDiff = dateB.getTime() - dateA.getTime();
            
            if (Math.abs(dateDiff) > 24 * 60 * 60 * 1000) { // If more than 1 day difference
              return dateDiff;
            }
            
            // If dates are close, sort by relevance
            return b.relevanceScore - a.relevanceScore;
          })
          .slice(0, 50);

        console.log(`Found ${matchingArticles.length} relevant articles in ${dateRange.label}`);
        
        // If we found relevant articles, use this date range
        if (matchingArticles.length > 0) {
          searchUsed = dateRange.label;
          
          // Debug: Log the date range of returned articles
          const newestDate = new Date(Math.max(...matchingArticles.map(a => new Date(a.created || 0).getTime())));
          const oldestDate = new Date(Math.min(...matchingArticles.map(a => new Date(a.created || 0).getTime())));
          console.log(`Date range: ${oldestDate.toISOString().slice(0, 10)} to ${newestDate.toISOString().slice(0, 10)}`);

          return NextResponse.json({
            articles: matchingArticles,
            totalFound: matchingArticles.length,
            searchTerms: searchTerms,
            searchRange: searchUsed,
            dateRange: searchUsed.includes('6 months') ? '6 months' : '30 days'
          });
        }
        
        // No relevant articles found, continue to next date range
        console.log(`No relevant articles found in ${dateRange.label}, trying longer time range...`);
      }
    }

    // If we get here, no relevant articles were found in any date range
    console.log(`No relevant articles found in any date range`);
    return NextResponse.json({
      articles: [],
      totalFound: 0,
      searchTerms: searchTerms,
      searchRange: 'no results found',
      dateRange: 'none'
    });

  } catch (error: any) {
    console.error('Error in enhanced article search:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to search articles.' 
    }, { status: 500 });
  }
}

// Enhanced function to process multiword searches
function processMultiwordSearch(searchTerm: string): string[] {
  const terms: string[] = [];
  
  // Add the original search term
  terms.push(searchTerm);
  
  // For multiword searches, create variations
  if (searchTerm.includes(' ')) {
    const words = searchTerm.split(' ').filter(word => word.length > 2);
    
    // For person names (2 words), be very conservative - only use exact phrase
    if (words.length === 2) {
      // Only return the exact search term for person names
      return [searchTerm];
    }
    
    // For longer searches, add combinations
    if (words.length >= 3) {
      // Add 2-3 word combinations
      for (let i = 0; i <= words.length - 2; i++) {
        const phrase = words.slice(i, i + 2).join(' ');
        if (phrase.length > 3) {
          terms.push(phrase);
        }
      }
      
      // Add 3-word combinations
      for (let i = 0; i <= words.length - 3; i++) {
        const phrase = words.slice(i, i + 3).join(' ');
        if (phrase.length > 5) {
          terms.push(phrase);
        }
      }
      
      // Add individual important words for longer searches
      const importantWords = words.filter(word => 
        word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'been', 'will', 'said', 'were'].includes(word.toLowerCase())
      );
      terms.push(...importantWords.slice(0, 2));
    }
  }
  
  // Remove duplicates and return
  return [...new Set(terms)].slice(0, 8);
}

// Enhanced relevance scoring with better date context
function calculateEnhancedRelevanceScore(headline: string, body: string, searchTerm: string, createdDate?: string): number {
  const headlineLower = headline.toLowerCase();
  const bodyLower = body.toLowerCase();
  let score = 0;
  
  // Exact phrase matches get highest scores
  if (headlineLower.includes(searchTerm.toLowerCase())) {
    score += 500; // Increased from 200
  }
  
  if (bodyLower.includes(searchTerm.toLowerCase())) {
    score += 300; // Increased from 100
  }
  
  // Multiword search term processing
  const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  // For person names (2 words), heavily penalize individual word matches
  if (searchWords.length === 2) {
    // Only give small scores for individual word matches in person name searches
    searchWords.forEach(word => {
      if (headlineLower.includes(word)) {
        score += 10; // Reduced from 50
      }
      if (bodyLower.includes(word)) {
        score += 5; // Reduced from 25
      }
    });
  } else {
    // For longer searches, use normal scoring
    searchWords.forEach(word => {
      if (headlineLower.includes(word)) {
        score += 50;
      }
      if (bodyLower.includes(word)) {
        score += 25;
      }
    });
  }
  
  // Bonus for word boundary matches (more precise)
  const wordBoundaryPattern = new RegExp(`\\b${searchTerm.toLowerCase()}\\b`, 'i');
  if (wordBoundaryPattern.test(headline)) {
    score += 100;
  }
  if (wordBoundaryPattern.test(body)) {
    score += 50;
  }
  
  // Enhanced date scoring
  if (createdDate) {
    const now = new Date();
    const articleDate = new Date(createdDate);
    if (!isNaN(articleDate.getTime())) {
      const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
      const daysDiff = hoursDiff / 24;
      
      // Recent articles get higher scores
      if (hoursDiff <= 24) {
        score += 150; // Very recent
      } else if (hoursDiff <= 72) {
        score += 100; // Recent
      } else if (daysDiff <= 7) {
        score += 75; // This week
      } else if (daysDiff <= 30) {
        score += 50; // This month
      } else if (daysDiff <= 90) {
        score += 25; // Recent months
      }
    }
  }
  
  // Bonus for financial/market content
  const financialTerms = ['stock', 'market', 'investor', 'analyst', 'earnings', 'trading', 'price', 'shares', 'financial', 'investment', 'revenue', 'profit'];
  financialTerms.forEach(term => {
    if (headlineLower.includes(term)) score += 20;
    if (bodyLower.includes(term)) score += 10;
  });
  
  return score;
}

// Function to get human-readable date context
function getDateContext(createdDate?: string): string {
  if (!createdDate) return 'Unknown date';
  
  const now = new Date();
  const articleDate = new Date(createdDate);
  
  if (isNaN(articleDate.getTime())) return 'Unknown date';
  
  const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
  const daysDiff = hoursDiff / 24;
  
  if (hoursDiff <= 1) {
    return 'within the last hour';
  } else if (hoursDiff <= 24) {
    return 'today';
  } else if (daysDiff <= 2) {
    return 'yesterday';
  } else if (daysDiff <= 7) {
    return 'this week';
  } else if (daysDiff <= 14) {
    return 'last week';
  } else if (daysDiff <= 30) {
    return 'this month';
  } else if (daysDiff <= 60) {
    return 'last month';
  } else if (daysDiff <= 90) {
    return 'earlier this year';
  } else {
    return 'earlier this year';
  }
}

// Enhanced related terms function
function getRelatedTerms(searchTerm: string): string[] {
  const relatedTermsMap: { [key: string]: string[] } = {
    'wegovy': ['ozempic', 'weight loss', 'novo nordisk', 'glp-1'],
    'ozempic': ['wegovy', 'weight loss', 'novo nordisk', 'glp-1'],
    'weight loss': ['wegovy', 'ozempic', 'glp-1', 'obesity'],
    'novo nordisk': ['wegovy', 'ozempic', 'diabetes', 'weight loss'],
    'eli lilly': ['zepbound', 'mounjaro', 'diabetes', 'weight loss'],
    'tesla': ['electric vehicle', 'ev', 'musk', 'automotive'],
    'apple': ['iphone', 'tech', 'consumer', 'smartphone'],
    'amazon': ['e-commerce', 'retail', 'cloud', 'aws'],
    'microsoft': ['software', 'cloud', 'azure', 'tech'],
    'nvidia': ['ai', 'artificial intelligence', 'gpu', 'chips'],
    'artificial intelligence': ['ai', 'machine learning', 'tech', 'automation'],
    'machine learning': ['ai', 'artificial intelligence', 'algorithms', 'data'],
    'cybersecurity': ['security', 'hacking', 'data breach', 'privacy'],
    'encryption': ['security', 'privacy', 'data protection', 'cybersecurity'],
    'federal reserve': ['fed', 'interest rates', 'monetary policy', 'economy'],
    'inflation': ['prices', 'economy', 'consumer', 'federal reserve'],
    'earnings': ['revenue', 'profit', 'quarterly', 'financial results'],
    'stock market': ['trading', 'investing', 'equities', 'market volatility'],
    'donald trump': ['trump', 'presidential', 'political', 'election'],
    'joe biden': ['biden', 'presidential', 'political', 'administration'],
    'used car': ['automotive', 'car sales', 'pre-owned', 'dealership'],
    'car rental': ['hertz', 'avis', 'enterprise', 'rental car'],
    'electric vehicle': ['ev', 'tesla', 'automotive', 'battery']
  };
  
  const searchTermLower = searchTerm.toLowerCase();
  
  // Check for exact matches
  if (relatedTermsMap[searchTermLower]) {
    return relatedTermsMap[searchTermLower];
  }
  
  // Check for partial matches
  for (const [key, terms] of Object.entries(relatedTermsMap)) {
    if (searchTermLower.includes(key) || key.includes(searchTermLower)) {
      return terms;
    }
  }
  
  // Return generic related terms for unknown search terms
  return ['market news', 'financial news', 'stock market'];
}

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

    // Get articles from the last 90 days with enhanced date filtering
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 90);
    const dateFromStr = dateFrom.toISOString().slice(0, 10);
    
    const allArticles: any[] = [];
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
        // Strategy 1: Exact phrase search
        const exactSearchUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&topics=${encodeURIComponent(term)}&items=200&fields=headline,title,url,channels,body,created&displayOutput=full&dateFrom=${dateFromStr}`;
        
        const exactRes = await fetch(exactSearchUrl, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (exactRes.ok) {
          const exactData = await exactRes.json();
          if (Array.isArray(exactData) && exactData.length > 0) {
            console.log(`Exact search returned ${exactData.length} articles for "${term}"`);
            addArticlesWithoutDuplicates(exactData);
          }
        }

        // Strategy 2: Individual word search for multiword terms
        if (term.includes(' ')) {
          const words = term.split(' ').filter(word => word.length > 2);
          for (const word of words.slice(0, 3)) { // Use top 3 words
            const wordSearchUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&topics=${encodeURIComponent(word)}&items=100&fields=headline,title,url,channels,body,created&displayOutput=full&dateFrom=${dateFromStr}`;
            
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
          const relatedSearchUrl = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&topics=${encodeURIComponent(relatedTerm)}&items=100&fields=headline,title,url,channels,body,created&displayOutput=full&dateFrom=${dateFromStr}`;
          
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

    console.log(`Total articles found: ${allArticles.length}`);

    // Enhanced filtering and scoring with better date context
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
      .filter(item => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 50);

    console.log(`Returning ${matchingArticles.length} relevant articles`);

    return NextResponse.json({
      articles: matchingArticles,
      totalFound: matchingArticles.length,
      searchTerms: searchTerms
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
    
    // Add 2-3 word combinations
    for (let i = 0; i <= words.length - 2; i++) {
      const phrase = words.slice(i, i + 2).join(' ');
      if (phrase.length > 3) {
        terms.push(phrase);
      }
    }
    
    // Add 3-word combinations for longer searches
    if (words.length >= 3) {
      for (let i = 0; i <= words.length - 3; i++) {
        const phrase = words.slice(i, i + 3).join(' ');
        if (phrase.length > 5) {
          terms.push(phrase);
        }
      }
    }
    
    // Add individual important words
    const importantWords = words.filter(word => 
      word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'been', 'will', 'said', 'were'].includes(word.toLowerCase())
    );
    terms.push(...importantWords.slice(0, 3));
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
    score += 200;
  }
  
  if (bodyLower.includes(searchTerm.toLowerCase())) {
    score += 100;
  }
  
  // Multiword search term processing
  const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  // Score for individual word matches
  searchWords.forEach(word => {
    if (headlineLower.includes(word)) {
      score += 50;
    }
    if (bodyLower.includes(word)) {
      score += 25;
    }
  });
  
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

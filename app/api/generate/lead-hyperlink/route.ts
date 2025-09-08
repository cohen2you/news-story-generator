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

    console.log('Searching for lead hyperlink landing pages for paragraph:', leadParagraph.substring(0, 100) + '...');

    // Extract search terms from the lead paragraph with enhanced multiword support
    const searchTerms = extractEnhancedSearchTermsFromLead(leadParagraph);
    console.log('Extracted enhanced search terms from lead paragraph:', searchTerms);

    const landingPages: any[] = [];

    // Generate landing pages for each search term
    for (const searchTerm of searchTerms.slice(0, 8)) { // Use top 8 search terms to get variety
      console.log('Generating landing page for term:', searchTerm);

      try {
        // Create a landing page object instead of searching for specific articles
        const landingPage = await generateLandingPageForTerm(searchTerm);
        console.log('Generated landing page for term:', searchTerm, landingPage);
        
        // Check if we already have a landing page with this URL
        const urlExists = landingPages.some(page => page.url === landingPage.url);
        
        if (landingPage && !urlExists && landingPages.length < 5) { // Limit to 5 landing pages
          landingPages.push(landingPage);
        }
      } catch (error) {
        console.log('Landing page generation failed for term:', searchTerm, error);
      }
    }

    // If no landing pages generated, create fallback options
    if (landingPages.length === 0) {
      const fallbackTerms = ['financial news', 'earnings', 'analyst ratings'];
      for (const term of fallbackTerms) {
        if (landingPages.length < 5) {
          landingPages.push({
            url: `https://www.benzinga.com/news`,
            headline: `${term.charAt(0).toUpperCase() + term.slice(1)}`,
            title: `${term.charAt(0).toUpperCase() + term.slice(1)}`,
            created: new Date().toISOString(),
            score: 10,
            relevanceScore: 10,
            isLandingPage: true
          });
        }
      }
    }

    console.log(`Generated ${landingPages.length} landing pages for hyperlink selection`);

    return NextResponse.json({
      articles: landingPages,
      totalFound: landingPages.length,
      searchTerms: searchTerms.slice(0, 5)
    });

  } catch (error: any) {
    console.error('Error in lead hyperlink search:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to search for hyperlink articles' 
    }, { status: 500 });
  }
}

// Function to discover available topics from Benzinga API
async function getAvailableTopics(): Promise<string[]> {
  try {
    console.log('🔍 Starting API discovery...');
    console.log('🔑 API Key present:', !!BENZINGA_API_KEY);
    console.log('🌐 API URL:', `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY ? '***' : 'MISSING'}&limit=100`);
    
    // Try to get topics from Benzinga's news API
    const response = await fetch(`${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&limit=100`);
    console.log('📡 API Response status:', response.status);
    console.log('📡 API Response ok:', response.ok);
    console.log('📡 API Response headers:', Object.fromEntries(response.headers.entries()));
    
    // Check if response is XML or JSON
    const contentType = response.headers.get('content-type');
    console.log('📄 Content-Type:', contentType);
    
    let data: any;
    
    if (contentType && contentType.includes('xml')) {
      console.log('📄 Parsing XML response...');
      const xmlText = await response.text();
      console.log('📄 XML Response preview:', xmlText.substring(0, 500));
      console.log('📄 XML Response length:', xmlText.length);
      data = await parseXMLResponse(xmlText);
    } else {
      console.log('📄 Parsing JSON response...');
      const jsonText = await response.text();
      console.log('📄 JSON Response preview:', jsonText.substring(0, 500));
      console.log('📄 JSON Response length:', jsonText.length);
      
      try {
        data = JSON.parse(jsonText);
      } catch (parseError) {
        console.log('❌ JSON parse failed:', parseError);
        console.log('📄 Raw response text:', jsonText);
        return [];
      }
    }
    
    console.log('📊 Parsed data structure:', JSON.stringify(data, null, 2).substring(0, 1000));
    console.log('📊 Data has news property:', !!data.news);
    console.log('📊 News is array:', Array.isArray(data.news));
    console.log('📊 News length:', data.news?.length || 0);
    
    const topics = new Set<string>();
    
    // Extract topics from article tags and categories
    if (data.news && Array.isArray(data.news)) {
      console.log('🔍 Processing news articles...');
      data.news.forEach((article: any, index: number) => {
        if (index < 3) { // Log first 3 articles for debugging
          console.log(`📰 Article ${index}:`, {
            hasTags: !!article.tags,
            hasCategories: !!article.categories,
            tags: article.tags,
            categories: article.categories
          });
        }
        
        if (article.tags && Array.isArray(article.tags)) {
          article.tags.forEach((tag: string) => {
            if (tag && tag.length > 2) { // Filter out very short tags
              topics.add(tag.toLowerCase());
            }
          });
        }
        if (article.categories && Array.isArray(article.categories)) {
          article.categories.forEach((category: string) => {
            if (category && category.length > 2) {
              topics.add(category.toLowerCase());
            }
          });
        }
      });
    } else {
      console.log('❌ No valid news data found in response');
      console.log('📊 Available data keys:', Object.keys(data || {}));
    }
    
    console.log('🎯 Discovered topics from API:', Array.from(topics).slice(0, 20));
    console.log('🎯 Total topics found:', topics.size);
    return Array.from(topics);
  } catch (error: any) {
    console.log('❌ API discovery failed:', error);
    console.log('❌ Error stack:', error.stack);
    return [];
  }
}

// Helper function to parse XML response
async function parseXMLResponse(xmlText: string): Promise<any> {
  try {
    // Simple XML parsing for common patterns
    const topics = new Set<string>();
    
    // Extract tags from XML (basic pattern matching)
    const tagMatches = xmlText.match(/<tag[^>]*>([^<]+)<\/tag>/gi);
    if (tagMatches) {
      tagMatches.forEach(match => {
        const tagContent = match.replace(/<[^>]*>/g, '');
        if (tagContent && tagContent.length > 2) {
          topics.add(tagContent.toLowerCase());
        }
      });
    }
    
    // Extract categories from XML
    const categoryMatches = xmlText.match(/<category[^>]*>([^<]+)<\/category>/gi);
    if (categoryMatches) {
      categoryMatches.forEach(match => {
        const categoryContent = match.replace(/<[^>]*>/g, '');
        if (categoryContent && categoryContent.length > 2) {
          topics.add(categoryContent.toLowerCase());
        }
      });
    }
    
    // Return in expected format
    return {
      news: Array.from(topics).map(topic => ({
        tags: [topic],
        categories: [topic]
      }))
    };
  } catch (error) {
    console.log('XML parsing failed:', error);
    return { news: [] };
  }
}

// Enhanced function to generate landing pages for search terms
async function generateLandingPageForTerm(searchTerm: string): Promise<any> {
  console.log('generateLandingPageForTerm called with searchTerm:', searchTerm);
  
  // Define landing page mappings for common financial terms
  const landingPageMap: { [key: string]: any } = {
    // Company-specific landing pages
    'apple': {
      url: 'https://www.benzinga.com/quote/AAPL',
      headline: 'Apple Inc. (AAPL) Stock News',
      title: 'Apple Inc. Stock Analysis and News'
    },
    'tesla': {
      url: 'https://www.benzinga.com/quote/TSLA',
      headline: 'Tesla Inc. (TSLA) Stock News',
      title: 'Tesla Inc. Stock Analysis and News'
    },
    'amazon': {
      url: 'https://www.benzinga.com/quote/AMZN',
      headline: 'Amazon.com Inc. (AMZN) Stock News',
      title: 'Amazon.com Inc. Stock Analysis and News'
    },
    'microsoft': {
      url: 'https://www.benzinga.com/quote/MSFT',
      headline: 'Microsoft Corporation (MSFT) Stock News',
      title: 'Microsoft Corporation Stock Analysis and News'
    },
    'nvidia': {
      url: 'https://www.benzinga.com/topic/nvidia',
      headline: 'NVIDIA Corporation (NVDA) Stock News',
      title: 'NVIDIA Corporation Stock Analysis and News'
    },
    'novo nordisk': {
      url: 'https://www.benzinga.com/quote/NVO',
      headline: 'Novo Nordisk A/S (NVO) Stock News',
      title: 'Novo Nordisk A/S Stock Analysis and News'
    },
    'eli lilly': {
      url: 'https://www.benzinga.com/quote/LLY',
      headline: 'Eli Lilly and Company (LLY) Stock News',
      title: 'Eli Lilly and Company Stock Analysis and News'
    },
    'pfizer': {
      url: 'https://www.benzinga.com/quote/PFE',
      headline: 'Pfizer Inc. (PFE) Stock News',
      title: 'Pfizer Inc. Stock Analysis and News'
    },
    'hertz': {
      url: 'https://www.benzinga.com/quote/HTZ',
      headline: 'Hertz Global Holdings (HTZ) Stock News',
      title: 'Hertz Global Holdings Stock Analysis and News'
    },
    
    // Sector-specific landing pages
    'artificial intelligence': {
      url: 'https://www.benzinga.com/topic/artificial-intelligence',
      headline: 'Artificial Intelligence News and Analysis',
      title: 'AI Technology News and Market Analysis'
    },
    'weight loss': {
      url: 'https://www.benzinga.com/topic/weight-loss-drugs',
      headline: 'Weight Loss Drugs Market News',
      title: 'GLP-1 Drugs and Weight Loss Market Analysis'
    },
    'diabetes drug': {
      url: 'https://www.benzinga.com/topic/diabetes-treatment',
      headline: 'Diabetes Treatment Market News',
      title: 'Diabetes Drugs and Treatment Market Analysis'
    },
    'electric vehicle': {
      url: 'https://www.benzinga.com/topic/electric-vehicles',
      headline: 'Electric Vehicle Market News',
      title: 'EV Industry News and Market Analysis'
    },
    'autonomous driving': {
      url: 'https://www.benzinga.com/topic/autonomous-vehicles',
      headline: 'Autonomous Vehicle Technology News',
      title: 'Self-Driving Cars Market Analysis'
    },
    'cybersecurity': {
      url: 'https://www.benzinga.com/topic/cybersecurity',
      headline: 'Cybersecurity Market News',
      title: 'Cybersecurity Industry Analysis'
    },
    'encryption': {
      url: 'https://www.benzinga.com/topic/encryption',
      headline: 'Encryption Technology News',
      title: 'Data Security and Encryption Market'
    },
    'used car': {
      url: 'https://www.benzinga.com/topic/used-car-market',
      headline: 'Used Car Market News',
      title: 'Pre-Owned Vehicle Market Analysis'
    },
    'car sales': {
      url: 'https://www.benzinga.com/topic/automotive-sales',
      headline: 'Automotive Sales Market News',
      title: 'Car Sales Industry Analysis'
    },
    'rental car': {
      url: 'https://www.benzinga.com/topic/car-rental',
      headline: 'Car Rental Industry News',
      title: 'Rental Car Market Analysis'
    },
    
    // Financial terms
    'earnings': {
      url: 'https://www.benzinga.com/earnings',
      headline: 'Earnings Reports and Analysis',
      title: 'Corporate Earnings News and Analysis'
    },
    'federal reserve': {
      url: 'https://www.benzinga.com/topic/federal-reserve',
      headline: 'Federal Reserve News and Analysis',
      title: 'Fed Policy and Interest Rate News'
    },
    'inflation': {
      url: 'https://www.benzinga.com/topic/inflation',
      headline: 'Inflation News and Analysis',
      title: 'Inflation Data and Economic Impact'
    },
    'jobs report': {
      url: 'https://www.benzinga.com/topic/employment',
      headline: 'Employment and Jobs Report News',
      title: 'Labor Market Data and Analysis'
    },
    
    // Political terms
    'donald trump': {
      url: 'https://www.benzinga.com/topic/donald-trump',
      headline: 'Donald Trump News and Market Impact',
      title: 'Trump Policy News and Market Analysis'
    },
    'joe biden': {
      url: 'https://www.benzinga.com/topic/joe-biden',
      headline: 'Joe Biden News and Market Impact',
      title: 'Biden Administration Policy News'
    },
    'government': {
      url: 'https://www.benzinga.com/topic/government-policy',
      headline: 'Government Policy News',
      title: 'Policy Impact on Markets'
    },
    
    // Technology terms
    'ai': {
      url: 'https://www.benzinga.com/topic/artificial-intelligence',
      headline: 'Artificial Intelligence News',
      title: 'AI Technology Market Analysis'
    },
    'machine learning': {
      url: 'https://www.benzinga.com/topic/machine-learning',
      headline: 'Machine Learning Technology News',
      title: 'ML Market and Technology Analysis'
    },
    
    // Healthcare terms
    'fda': {
      url: 'https://www.benzinga.com/topic/fda',
      headline: 'FDA News and Drug Approvals',
      title: 'Food and Drug Administration Updates'
    },
    'drug approval': {
      url: 'https://www.benzinga.com/topic/drug-approvals',
      headline: 'Drug Approval News',
      title: 'Pharmaceutical Approval Market Impact'
    },
    
    // Broader industry/sector topic pages
    'airlines': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'airline': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'spirit airlines': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'united airlines': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'american airlines': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'southwest airlines': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'jetblue': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'delta airlines': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'boeing': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'airbus': {
      url: 'https://www.benzinga.com/topic/airlines',
      headline: 'Airlines Industry News',
      title: 'Airline Stocks and Industry Analysis'
    },
    'automotive': {
      url: 'https://www.benzinga.com/topic/automotive',
      headline: 'Automotive Industry News',
      title: 'Auto Stocks and Industry Analysis'
    },
    'automotive industry': {
      url: 'https://www.benzinga.com/topic/automotive',
      headline: 'Automotive Industry News',
      title: 'Auto Stocks and Industry Analysis'
    },
    'car industry': {
      url: 'https://www.benzinga.com/topic/automotive',
      headline: 'Automotive Industry News',
      title: 'Auto Stocks and Industry Analysis'
    },
    'pharmaceutical': {
      url: 'https://www.benzinga.com/topic/pharmaceuticals',
      headline: 'Pharmaceutical Industry News',
      title: 'Pharma Stocks and Drug Development'
    },
    'pharmaceuticals': {
      url: 'https://www.benzinga.com/topic/pharmaceuticals',
      headline: 'Pharmaceutical Industry News',
      title: 'Pharma Stocks and Drug Development'
    },
    'biotech': {
      url: 'https://www.benzinga.com/topic/biotech',
      headline: 'Biotechnology Industry News',
      title: 'Biotech Stocks and Research'
    },
    'biotechnology': {
      url: 'https://www.benzinga.com/topic/biotech',
      headline: 'Biotechnology Industry News',
      title: 'Biotech Stocks and Research'
    },
    'technology': {
      url: 'https://www.benzinga.com/topic/technology',
      headline: 'Technology Industry News',
      title: 'Tech Stocks and Innovation'
    },
    'tech': {
      url: 'https://www.benzinga.com/topic/technology',
      headline: 'Technology Industry News',
      title: 'Tech Stocks and Innovation'
    },
    'energy': {
      url: 'https://www.benzinga.com/topic/energy',
      headline: 'Energy Industry News',
      title: 'Energy Stocks and Market Analysis'
    },
    'oil': {
      url: 'https://www.benzinga.com/topic/energy',
      headline: 'Energy Industry News',
      title: 'Energy Stocks and Market Analysis'
    },
    'gas': {
      url: 'https://www.benzinga.com/topic/energy',
      headline: 'Energy Industry News',
      title: 'Energy Stocks and Market Analysis'
    },
    'banking': {
      url: 'https://www.benzinga.com/topic/banking',
      headline: 'Banking Industry News',
      title: 'Bank Stocks and Financial Services'
    },
    'banks': {
      url: 'https://www.benzinga.com/topic/banking',
      headline: 'Banking Industry News',
      title: 'Bank Stocks and Financial Services'
    },
    'finance': {
      url: 'https://www.benzinga.com/topic/finance',
      headline: 'Finance Industry News',
      title: 'Financial Services and Market Analysis'
    },
    'financial': {
      url: 'https://www.benzinga.com/topic/finance',
      headline: 'Finance Industry News',
      title: 'Financial Services and Market Analysis'
    },
    'retail': {
      url: 'https://www.benzinga.com/topic/retail',
      headline: 'Retail Industry News',
      title: 'Retail Stocks and Consumer Spending'
    },
    'healthcare': {
      url: 'https://www.benzinga.com/topic/healthcare',
      headline: 'Healthcare Industry News',
      title: 'Healthcare Stocks and Medical Innovation'
    },
    'real estate': {
      url: 'https://www.benzinga.com/topic/real-estate',
      headline: 'Real Estate Industry News',
      title: 'Real Estate Stocks and Property Market'
    },
    'cryptocurrency': {
      url: 'https://www.benzinga.com/topic/cryptocurrency',
      headline: 'Cryptocurrency News',
      title: 'Crypto Market Analysis and Digital Assets'
    },
    'crypto': {
      url: 'https://www.benzinga.com/topic/cryptocurrency',
      headline: 'Cryptocurrency News',
      title: 'Crypto Market Analysis and Digital Assets'
    },
    'marijuana': {
      url: 'https://www.benzinga.com/topic/marijuana',
      headline: 'Cannabis Industry News',
      title: 'Marijuana Stocks and Legalization'
    },
    'cannabis': {
      url: 'https://www.benzinga.com/topic/marijuana',
      headline: 'Cannabis Industry News',
      title: 'Marijuana Stocks and Legalization'
    },
    
    // Additional market and sector pages
    'analyst ratings': {
      url: 'https://www.benzinga.com/ratings',
      headline: 'Analyst Ratings and Price Targets',
      title: 'Wall Street Analyst Coverage'
    },
    'pre market': {
      url: 'https://www.benzinga.com/pre-market',
      headline: 'Pre-Market Trading News',
      title: 'Early Market Analysis and Movers'
    },
    'after hours': {
      url: 'https://www.benzinga.com/after-hours',
      headline: 'After-Hours Trading News',
      title: 'Extended Hours Market Analysis'
    },
    'insider trading': {
      url: 'https://www.benzinga.com/insider-trades',
      headline: 'Insider Trading Activity',
      title: 'Corporate Insider Transactions'
    },
    'dividends': {
      url: 'https://www.benzinga.com/dividends',
      headline: 'Dividend News and Analysis',
      title: 'Dividend Stocks and Payouts'
    },
    'mergers acquisitions': {
      url: 'https://www.benzinga.com/ma',
      headline: 'Mergers and Acquisitions News',
      title: 'M&A Activity and Deals'
    },
    'initial public offering': {
      url: 'https://www.benzinga.com/ipos',
      headline: 'IPO News and Analysis',
      title: 'Initial Public Offerings'
    },
    'ipo': {
      url: 'https://www.benzinga.com/ipos',
      headline: 'IPO News and Analysis',
      title: 'Initial Public Offerings'
    },
    'options trading': {
      url: 'https://www.benzinga.com/options',
      headline: 'Options Trading News',
      title: 'Options Market Analysis'
    },
    'etfs': {
      url: 'https://www.benzinga.com/etfs',
      headline: 'ETF News and Analysis',
      title: 'Exchange-Traded Funds'
    },
    'commodities': {
      url: 'https://www.benzinga.com/commodities',
      headline: 'Commodities News and Analysis',
      title: 'Commodity Market Updates'
    },
    'bonds': {
      url: 'https://www.benzinga.com/bonds',
      headline: 'Bond Market News',
      title: 'Fixed Income Analysis'
    },
    'futures': {
      url: 'https://www.benzinga.com/futures',
      headline: 'Futures Trading News',
      title: 'Futures Market Analysis'
    }
  };

  // Check for exact matches first
  const searchTermLower = searchTerm.toLowerCase();
  console.log('Checking for exact match with:', searchTermLower);
  console.log('Available keys in landingPageMap:', Object.keys(landingPageMap));
  
  if (landingPageMap[searchTermLower]) {
    console.log('Found exact match for:', searchTermLower);
    return {
      ...landingPageMap[searchTermLower],
      created: new Date().toISOString(),
      score: 100,
      relevanceScore: 100,
      isLandingPage: true
    };
  }

  // Check for partial matches
  console.log('Checking for partial matches...');
  for (const [key, value] of Object.entries(landingPageMap)) {
    if (searchTermLower.includes(key) || key.includes(searchTermLower)) {
      console.log('Found partial match:', key, 'for search term:', searchTermLower);
      return {
        ...value,
        created: new Date().toISOString(),
        score: 80,
        relevanceScore: 80,
        isLandingPage: true
      };
    }
  }

  // Try to discover a topic page before falling back to generic search
  console.log('No mapping found, trying to discover topic page for:', searchTerm);
  
  try {
    const availableTopics = await getAvailableTopics();
    
    // Look for a topic that matches our search term with better matching logic
    let matchingTopic = availableTopics.find(topic => 
      topic.includes(searchTermLower) || searchTermLower.includes(topic)
    );
    
    // If no direct match, try fuzzy matching for company names and tickers
    if (!matchingTopic && searchTermLower.length >= 3) {
      matchingTopic = availableTopics.find(topic => {
        // Check for company name variations
        if (searchTermLower === 'googl' || searchTermLower === 'google') {
          return topic.includes('google') || topic.includes('alphabet');
        }
        if (searchTermLower === 'aapl') {
          return topic.includes('apple');
        }
        if (searchTermLower === 'tsla') {
          return topic.includes('tesla');
        }
        if (searchTermLower === 'amzn') {
          return topic.includes('amazon');
        }
        if (searchTermLower === 'msft') {
          return topic.includes('microsoft');
        }
        if (searchTermLower === 'nvda') {
          return topic.includes('nvidia');
        }
        
        // Check for partial word matches
        return topic.split(' ').some(word => 
          word.length >= 3 && searchTermLower.includes(word)
        );
      });
    }
    
    if (matchingTopic) {
      console.log('Found matching topic:', matchingTopic);
      return {
        url: `https://www.benzinga.com/topic/${matchingTopic.replace(/\s+/g, '-')}`,
        headline: `${matchingTopic.charAt(0).toUpperCase() + matchingTopic.slice(1)} News and Analysis`,
        title: `${matchingTopic.charAt(0).toUpperCase() + matchingTopic.slice(1)} Market Coverage`,
        created: new Date().toISOString(),
        score: 70,
        relevanceScore: 70,
        isLandingPage: true,
        discovered: true
      };
    }
  } catch (error) {
    console.log('Topic discovery failed, falling back to generic search:', error);
  }
  
  // Generate a proper topic landing page instead of search
  console.log('Generating topic landing page for:', searchTerm);
  return {
    url: `https://www.benzinga.com/topic/${searchTerm.toLowerCase().replace(/\s+/g, '-')}`,
    headline: `${searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)} News and Analysis`,
    title: `${searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)} Market Coverage`,
    created: new Date().toISOString(),
    score: 70,
    relevanceScore: 70,
    isLandingPage: true,
    discovered: true
  };
}

// Enhanced function to extract search terms from lead paragraph with better multiword support
function extractEnhancedSearchTermsFromLead(leadParagraph: string): string[] {
  const cleanText = leadParagraph.replace(/<[^>]*>/g, '').toLowerCase();
  const searchTerms: string[] = [];
  
  // Enhanced company names and tickers with multiword support
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
    /bill\s+pulte/i,
    /eli\s+lilly/i,
    /pfizer\s+inc/i,
    /nvidia\s+corporation/i,
    /alphabet\s+inc/i,
    /meta\s+platforms/i,
    /netflix\s+inc/i
  ];
  
  companyPatterns.forEach(pattern => {
    const match = cleanText.match(pattern);
    if (match) {
      searchTerms.push(match[0]);
    }
  });
  
  // Extract ticker symbols and convert to company names
  const tickerMatch = cleanText.match(/nasdaq:\s*([a-z]+)/i);
  if (tickerMatch) {
    const ticker = tickerMatch[1].toUpperCase();
    // Convert ticker to company name for better landing page URLs
    const tickerToCompany: { [key: string]: string } = {
      'NVDA': 'nvidia',
      'AAPL': 'apple',
      'TSLA': 'tesla',
      'AMZN': 'amazon',
      'MSFT': 'microsoft',
      'GOOGL': 'alphabet',
      'META': 'meta',
      'NFLX': 'netflix',
      'GM': 'general motors',
      'F': 'ford motor',
      'PFE': 'pfizer',
      'LLY': 'eli lilly',
      'NVO': 'novo nordisk'
    };
    
    const companyName = tickerToCompany[ticker] || ticker.toLowerCase();
    searchTerms.push(companyName);
  }
  
  // Enhanced multiword business and financial terms
  const keyTerms = [
    'artificial intelligence', 'machine learning', 'ai technology',
    'weight loss drugs', 'diabetes treatment', 'glp-1 drugs',
    'electric vehicle', 'autonomous driving', 'self-driving cars',
    'cybersecurity', 'data encryption', 'end-to-end encryption',
    'earnings report', 'revenue growth', 'profit margin',
    'market volatility', 'trading volume',
    'federal reserve', 'interest rates', 'monetary policy',
    'inflation data', 'consumer price index', 'economic growth',
    'government policy', 'regulatory approval', 'legal action',
    'used car market', 'automotive sales', 'car rental industry',
    'mortgage fraud', 'bank documents', 'loan terms',
    'federal housing finance agency', 'fhfa regulations',
    'drug approval', 'fda approval', 'clinical trials',
    'merger acquisition', 'corporate restructuring', 'bankruptcy filing'
  ];
  
  keyTerms.forEach(term => {
    if (cleanText.includes(term)) {
      searchTerms.push(term);
    }
  });
  
  // Extract specific multiword phrases that indicate the story topic
  const specificPhrases = [
    'jim cramer', 'cnbc host', 'online used car', 'used car dealer',
    'diabetes drug', 'weight loss medication', 'ozempic wegovy',
    'artificial intelligence', 'ai development', 'machine learning',
    'electric vehicle', 'ev market', 'autonomous driving',
    'rental car', 'car rental', 'fleet management',
    'cyber attack', 'data breach', 'privacy protection',
    'earnings call', 'quarterly results', 'analyst rating',
    'price target', 'stock recommendation', 'market analyst',
    'spirit airlines', 'united airlines', 'american airlines', 'southwest airlines',
    'delta airlines', 'jetblue', 'boeing', 'airbus', 'airlines',
    'automotive industry', 'car industry', 'automotive',
    'pharmaceutical industry', 'biotech industry', 'healthcare industry',
    'technology industry', 'tech industry', 'energy industry',
    'banking industry', 'finance industry', 'retail industry',
    'real estate industry', 'cryptocurrency', 'crypto', 'marijuana', 'cannabis'
  ];
  
  specificPhrases.forEach(phrase => {
    if (cleanText.includes(phrase)) {
      searchTerms.push(phrase);
    }
  });
  
  // Extract government entities and political terms
  const governmentTerms = [
    'u.s. government', 'u.k. government', 'federal government', 
    'biden administration', 'trump administration', 'congressional hearing',
    'senate committee', 'house committee', 'regulatory agency'
  ];
  governmentTerms.forEach(term => {
    if (cleanText.includes(term)) {
      searchTerms.push(term);
    }
  });
  
  // Extract action words and phrases that indicate what happened
  const actionTerms = [
    'announced today', 'reported earnings', 'revealed plans', 
    'launched product', 'acquired company', 'merged with',
    'filed lawsuit', 'sued company', 'demanded changes', 
    'resigned position', 'allegations made', 'falsified documents',
    'secured funding', 'prompting response', 'call for action',
    'issued statement', 'released report', 'conducted investigation'
  ];
  actionTerms.forEach(term => {
    if (cleanText.includes(term)) {
      searchTerms.push(term);
    }
  });
  
  // Extract individual important words as fallback
  const importantWords = [
    'encryption', 'privacy', 'cyberattacks', 'earnings', 'revenue', 
    'profit', 'analyst', 'rating', 'stock', 'market', 'trading', 
    'investor', 'government', 'policy', 'regulation', 'legal', 
    'court', 'automotive', 'mortgage', 'bank', 'loan', 'resignation', 
    'federal', 'reserve', 'housing', 'finance', 'agency', 'fda',
    'approval', 'drug', 'trial', 'merger', 'acquisition', 'bankruptcy',
    'airlines', 'airline', 'spirit', 'united', 'american', 'southwest',
    'delta', 'jetblue', 'boeing', 'airbus', 'pharmaceutical', 'biotech',
    'technology', 'tech', 'energy', 'oil', 'gas', 'banking', 'retail',
    'healthcare', 'real estate', 'cryptocurrency', 'crypto', 'marijuana', 'cannabis'
  ];
  
  importantWords.forEach(word => {
    if (cleanText.includes(word) && !searchTerms.some(term => term.includes(word))) {
      searchTerms.push(word);
    }
  });
  
  // Remove duplicates and return top search terms
  const uniqueSearchTerms = searchTerms.filter((term, index, self) => 
    index === self.findIndex(t => t === term)
  );
  
  return uniqueSearchTerms.slice(0, 10); // Return top 10 search terms
}

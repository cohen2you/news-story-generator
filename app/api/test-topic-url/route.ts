import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { phrase, sourceUrl } = await req.json();
    
    if (!phrase) {
      return NextResponse.json({ error: 'Phrase is required' }, { status: 400 });
    }
    
    console.log('Testing topic URL generation for phrase:', phrase);
    
    // Clean and normalize the topic
    const cleanTopic = phrase.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const terms = cleanTopic.split(/\s+/).filter((term: string) => term.length > 2);
    
    console.log('Clean topic:', cleanTopic);
    console.log('Terms:', terms);
    
    // Fetch articles from Benzinga API
    const url = `https://api.benzinga.com/api/v2/news?token=${process.env.BENZINGA_API_KEY}&items=20&fields=headline,title,url,channels,body&displayOutput=full`;
    
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
      return NextResponse.json({ 
        error: `Benzinga API error: ${res.status} ${res.statusText}` 
      }, { status: 500 });
    }
    
    let data;
    try {
      const responseText = await res.text();
      data = JSON.parse(responseText);
    } catch (parseError) {
      return NextResponse.json({ 
        error: `Error parsing Benzinga API response: ${parseError}` 
      }, { status: 500 });
    }
    
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ 
        error: 'No articles returned from Benzinga API' 
      }, { status: 500 });
    }
    
    console.log(`Found ${data.length} articles from Benzinga API`);
    
    // Test the filtering logic
    const topicArticles = data.filter((article: any) => {
      const headline = (article.headline || article.title || '').toLowerCase();
      const content = (article.body || '').toLowerCase();
      
      // Check for exact topic match first
      if (headline.includes(cleanTopic) || content.includes(cleanTopic)) {
        return true;
      }
      
      // Check if multiple terms appear in the headline or content
      const matchingTerms = terms.filter((term: string) => 
        headline.includes(term) || content.includes(term)
      );
      
      // If we have at least 2 matching terms, it's relevant
      if (matchingTerms.length >= 2) {
        return true;
      }
      
      // If we have at least 1 matching term and it's a significant term, it might be relevant
      if (matchingTerms.length >= 1) {
        const significantTerms = ['cramer', 'jim', 'cnbc', 'analyst', 'investor', 'stock', 'market', 'earnings', 'carvana', 'cvna'];
        return matchingTerms.some((term: string) => significantTerms.includes(term));
      }
      
      return false;
    });
    
    console.log(`Found ${topicArticles.length} topic-relevant articles`);
    
    // Score the articles
    const scoredArticles = topicArticles.map((article: any) => {
      const headline = (article.headline || article.title || '').toLowerCase();
      const content = (article.body || '').toLowerCase();
      let score = 0;
      
      // Exact topic match gets highest score
      if (headline.includes(cleanTopic) || content.includes(cleanTopic)) {
        score += 200;
      }
      
      // Headline matches get higher score than content matches
      terms.forEach((term: string) => {
        if (headline.includes(term)) score += 50;
        if (content.includes(term)) score += 20;
      });
      
      // Bonus for financial/stock market content
      const financialTerms = ['stock', 'market', 'investor', 'analyst', 'earnings', 'trading'];
      financialTerms.forEach((term: string) => {
        if (headline.includes(term)) score += 30;
        if (content.includes(term)) score += 15;
      });
      
      // Penalize articles that seem unrelated
      const unrelatedTerms = ['perplexity', 'aravind', 'srinivas', 'ceo', 'trump', 'biden', 'politics', 'election'];
      unrelatedTerms.forEach((term: string) => {
        if (headline.includes(term) || content.includes(term)) {
          score -= 100;
        }
      });
      
      return { 
        ...article, 
        score,
        headline: article.headline || article.title,
        matchingTerms: terms.filter((term: string) => 
          (article.headline || article.title || '').toLowerCase().includes(term) ||
          (article.body || '').toLowerCase().includes(term)
        )
      };
    }).sort((a, b) => b.score - a.score);
    
    // Test company fallback
    const companyTerms = ['carvana', 'cvna', 'tesla', 'tsla', 'apple', 'aapl', 'amazon', 'amzn', 'microsoft', 'msft'];
    const foundCompany = companyTerms.find((term: string) => cleanTopic.includes(term));
    
    let companyArticles = [];
    if (foundCompany) {
      companyArticles = data.filter((article: any) => {
        const headline = (article.headline || article.title || '').toLowerCase();
        const content = (article.body || '').toLowerCase();
        return headline.includes(foundCompany) || content.includes(foundCompany);
      });
    }
    
    // Get the final result
    let finalUrl = 'https://www.benzinga.com/news';
    if (scoredArticles.length > 0) {
      const bestArticle = scoredArticles[0];
      if (bestArticle && bestArticle.url && bestArticle.url.startsWith('http')) {
        finalUrl = bestArticle.url;
      }
    } else if (companyArticles.length > 0) {
      const bestCompanyArticle = companyArticles[0];
      if (bestCompanyArticle && bestCompanyArticle.url && bestCompanyArticle.url.startsWith('http')) {
        finalUrl = bestCompanyArticle.url;
      }
    }
    
    return NextResponse.json({
      phrase,
      cleanTopic,
      terms,
      totalArticlesFromAPI: data.length,
      topicRelevantArticles: topicArticles.length,
      companyArticles: companyArticles.length,
      foundCompany,
      finalUrl,
      topScoredArticles: scoredArticles.slice(0, 5).map(article => ({
        headline: article.headline,
        url: article.url,
        score: article.score,
        matchingTerms: article.matchingTerms
      })),
      allTopicArticles: topicArticles.map(article => ({
        headline: article.headline || article.title,
        url: article.url,
        body: (article.body || '').substring(0, 200) + '...'
      })),
      allCompanyArticles: companyArticles.map(article => ({
        headline: article.headline || article.title,
        url: article.url,
        body: (article.body || '').substring(0, 200) + '...'
      }))
    });
    
  } catch (error: any) {
    console.error('Error in test topic URL:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to test topic URL generation' 
    }, { status: 500 });
  }
} 
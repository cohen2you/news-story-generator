import { NextResponse } from 'next/server';
import { getFinalAssemblyPrompt } from './prompts/final';
import { getSecondaryPrompt } from './prompts/secondary';

// Model Configuration - Centralized model selection
export const MODEL_CONFIG = {
  // High-quality models for critical content generation
  HIGH_QUALITY: 'gpt-5',
  // Fast/cheap models for less critical tasks
  FAST: 'gpt-4o-mini',
  // Legacy models (fallback)
  LEGACY: 'gpt-4o'
} as const;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';

export async function callOpenAI(prompt: string) {
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set!');
    throw new Error('Missing OpenAI API key');
  }

  console.log('Calling OpenAI with prompt:', prompt.substring(0, 200));

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    console.error('OpenAI raw error:', raw);
    throw new Error(`OpenAI failed with status ${res.status}`);
  }

  const data = await res.json();
  console.log('OpenAI response received');
  return data.choices[0].message.content.trim();
}

export async function generateFinalStory({
  lead,
  whatHappened,
  whyItMatters,
  priceAction,
  primaryOutlet,
  secondaryOutlet,
}: {
  lead: string;
  whatHappened: string;
  whyItMatters: string;
  priceAction: string;
  primaryOutlet: string;
  secondaryOutlet: string;
}) {
  const prompt = getFinalAssemblyPrompt.prompt({
    lead,
    whatHappened,
    whyItMatters,
    priceAction,
    primaryOutlet,
    secondaryOutlet,
  });
  return await callOpenAI(prompt);
}

export async function generateSecondarySection({
  secondaryUrl,
  outletName,
  primaryText,
  secondaryText,
}: {
  secondaryUrl: string;
  outletName: string;
  primaryText: string;
  secondaryText: string;
}) {
  const prompt = getSecondaryPrompt.prompt({
    secondaryUrl,
    outletName,
    primaryText,
    secondaryText,
  });
  return await callOpenAI(prompt);
}

// Utility function to generate topic-based Benzinga URLs
export async function generateTopicUrl(topic: string, leadParagraph?: string): Promise<string> {
  try {
    // If we have the full lead paragraph, use it for better context
    if (leadParagraph) {
      return await generateContextualTopicUrl(topic, leadParagraph);
    }
    
    // Original logic for backward compatibility
    // Clean and normalize the topic
    const cleanTopic = topic.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    // Extract key terms from the topic
    const terms = cleanTopic.split(/\s+/).filter(term => term.length > 2);
    
    if (terms.length === 0) {
      return 'https://www.benzinga.com/news';
    }
    
    // Try to find relevant articles using the Benzinga News API with proper search
    const searchTerm = terms.slice(0, 3).join(' '); // Use up to 3 terms
    
    // Use the correct Benzinga API parameters for search
    const url = `https://api.benzinga.com/api/v2/news?token=${process.env.BENZINGA_API_KEY}&topics=${encodeURIComponent(searchTerm)}&items=100&fields=headline,title,url,channels,body&displayOutput=full`;
    
    let data;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
      console.error('Benzinga API error:', res.status, res.statusText);
      // Try fallback to general search if topics search fails
      const fallbackUrl = `https://api.benzinga.com/api/v2/news?token=${process.env.BENZINGA_API_KEY}&items=100&fields=headline,title,url,channels,body&displayOutput=full`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!fallbackRes.ok) {
        return 'https://www.benzinga.com/news';
      }
      
      const fallbackData = await fallbackRes.json();
      if (!Array.isArray(fallbackData) || fallbackData.length === 0) {
        return 'https://www.benzinga.com/news';
      }
      
      data = fallbackData;
    } else {
      try {
        const responseText = await res.text();
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing Benzinga API response:', parseError);
        return 'https://www.benzinga.com/news';
      }
    }
    
    if (!Array.isArray(data) || data.length === 0) {
      return 'https://www.benzinga.com/news';
    }
    
    // First, try to find articles that match the specific topic
    const topicArticles = data.filter((article: any) => {
      const headline = (article.headline || article.title || '').toLowerCase();
      const content = (article.body || '').toLowerCase();
      
      // Check for exact topic match first
      if (headline.includes(cleanTopic) || content.includes(cleanTopic)) {
        return true;
      }
      
      // Check if multiple terms appear in the headline or content
      const matchingTerms = terms.filter(term => 
        headline.includes(term) || content.includes(term)
      );
      
      // If we have at least 2 matching terms, it's relevant
      if (matchingTerms.length >= 2) {
        return true;
      }
      
      // If we have at least 1 matching term and it's a significant term, it might be relevant
      if (matchingTerms.length >= 1) {
        const significantTerms = ['cramer', 'jim', 'cnbc', 'analyst', 'investor', 'stock', 'market', 'earnings', 'carvana', 'cvna'];
        return matchingTerms.some(term => significantTerms.includes(term));
      }
      
      return false;
    });
    
    // If we found topic-specific articles, score and return the best one
    if (topicArticles.length > 0) {
      const scoredArticles = topicArticles.map((article: any) => {
        const headline = (article.headline || article.title || '').toLowerCase();
        const content = (article.body || '').toLowerCase();
        let score = 0;
        
        // Exact topic match gets highest score
        if (headline.includes(cleanTopic) || content.includes(cleanTopic)) {
          score += 200;
        }
        
        // Headline matches get higher score than content matches
        terms.forEach(term => {
          if (headline.includes(term)) score += 50;
          if (content.includes(term)) score += 20;
        });
        
        // Bonus for financial/stock market content
        const financialTerms = ['stock', 'market', 'investor', 'analyst', 'earnings', 'trading'];
        financialTerms.forEach(term => {
          if (headline.includes(term)) score += 30;
          if (content.includes(term)) score += 15;
        });
        
        // Penalize articles that seem unrelated
        const unrelatedTerms = ['perplexity', 'aravind', 'srinivas', 'ceo', 'trump', 'biden', 'politics', 'election'];
        unrelatedTerms.forEach(term => {
          if (headline.includes(term) || content.includes(term)) {
            score -= 100;
          }
        });
        
        return { ...article, score };
      }).sort((a, b) => b.score - a.score);
      
      const bestArticle = scoredArticles[0];
      if (bestArticle && bestArticle.url && bestArticle.url.startsWith('http')) {
        return bestArticle.url;
      }
    }
    
    // If no topic-specific articles found, try to find articles about the main company/ticker
    const companyTerms = ['carvana', 'cvna', 'tesla', 'tsla', 'apple', 'aapl', 'amazon', 'amzn', 'microsoft', 'msft'];
    const foundCompany = companyTerms.find(term => cleanTopic.includes(term));
    
    if (foundCompany) {
      const companyArticles = data.filter((article: any) => {
        const headline = (article.headline || article.title || '').toLowerCase();
        const content = (article.body || '').toLowerCase();
        return headline.includes(foundCompany) || content.includes(foundCompany);
      });
      
      if (companyArticles.length > 0) {
        // Score company articles
        const scoredCompanyArticles = companyArticles.map((article: any) => {
          const headline = (article.headline || article.title || '').toLowerCase();
          const content = (article.body || '').toLowerCase();
          let score = 0;
          
          // Company mentions get high priority
          if (headline.includes(foundCompany)) score += 100;
          if (content.includes(foundCompany)) score += 50;
          
          // Analyst mentions get bonus
          const analystTerms = ['cramer', 'jim cramer', 'analyst', 'rating'];
          analystTerms.forEach(term => {
            if (headline.includes(term)) score += 80;
            if (content.includes(term)) score += 40;
          });
          
          return { ...article, score };
        }).sort((a, b) => b.score - a.score);
        
        const bestCompanyArticle = scoredCompanyArticles[0];
        if (bestCompanyArticle && bestCompanyArticle.url && bestCompanyArticle.url.startsWith('http')) {
          return bestCompanyArticle.url;
        }
      }
    }
    
    // If no relevant articles found, return the main news page
    return 'https://www.benzinga.com/news';
    
  } catch (error) {
    console.error('Error generating topic URL:', error);
    return 'https://www.benzinga.com/news';
  }
}

// New function for context-aware topic URL generation
async function generateContextualTopicUrl(topic: string, leadParagraph: string): Promise<string> {
  try {
    console.log('Generating contextual topic URL for topic:', topic);
    console.log('Lead paragraph context:', leadParagraph.substring(0, 200) + '...');
    
    // Extract key topics from the entire lead paragraph
    const keyTopics = extractKeyTopicsFromLead(leadParagraph);
    console.log('Extracted key topics from lead paragraph:', keyTopics);
    
    // Get Benzinga articles using proper search
    const url = `https://api.benzinga.com/api/v2/news?token=${process.env.BENZINGA_API_KEY}&topics=${encodeURIComponent(topic)}&items=100&fields=headline,title,url,channels,body&displayOutput=full`;
    
    let data;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
      console.error('Benzinga API error:', res.status, res.statusText);
      // Try fallback to general search if topics search fails
      const fallbackUrl = `https://api.benzinga.com/api/v2/news?token=${process.env.BENZINGA_API_KEY}&items=100&fields=headline,title,url,channels,body&displayOutput=full`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!fallbackRes.ok) {
        return 'https://www.benzinga.com/news';
      }
      
      const fallbackData = await fallbackRes.json();
      if (!Array.isArray(fallbackData) || fallbackData.length === 0) {
        return 'https://www.benzinga.com/news';
      }
      
      data = fallbackData;
    } else {
      try {
        const responseText = await res.text();
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing Benzinga API response:', parseError);
        return 'https://www.benzinga.com/news';
      }
    }
    
    if (!Array.isArray(data) || data.length === 0) {
      return 'https://www.benzinga.com/news';
    }
    
    // Score articles based on relevance to the entire lead paragraph context
    const scoredArticles = data.map((article: any) => {
      const headline = (article.headline || article.title || '').toLowerCase();
      const content = (article.body || '').toLowerCase();
      let score = 0;
      
      // Score based on key topics from the lead paragraph
      keyTopics.forEach(topicInfo => {
        const { term, weight, type } = topicInfo;
        
        if (headline.includes(term.toLowerCase())) {
          score += weight * 2; // Headline matches get double weight
        }
        if (content.includes(term.toLowerCase())) {
          score += weight;
        }
      });
      
      // Bonus for exact topic phrase match (the 3-word phrase that's being hyperlinked)
      const cleanTopic = topic.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (headline.includes(cleanTopic) || content.includes(cleanTopic)) {
        score += 150; // High bonus for exact match
      }
      
      // Bonus for financial/stock market content
      const financialTerms = ['stock', 'market', 'investor', 'analyst', 'earnings', 'trading', 'price', 'shares'];
      financialTerms.forEach(term => {
        if (headline.includes(term)) score += 20;
        if (content.includes(term)) score += 10;
      });
      
      // Penalize articles that seem unrelated to the story context
      const unrelatedTerms = ['perplexity', 'aravind', 'srinivas', 'ceo', 'trump', 'biden', 'politics', 'election'];
      unrelatedTerms.forEach(term => {
        if (headline.includes(term) || content.includes(term)) {
          score -= 50;
        }
      });
      
      return { ...article, score };
    }).sort((a, b) => b.score - a.score);
    
    // Return the highest scoring article
    const bestArticle = scoredArticles[0];
    if (bestArticle && bestArticle.score > 0 && bestArticle.url && bestArticle.url.startsWith('http')) {
      console.log('Selected article with score:', bestArticle.score, 'URL:', bestArticle.url);
      return bestArticle.url;
    }
    
    // If no good matches found, return main news page
    return 'https://www.benzinga.com/news';
    
  } catch (error) {
    console.error('Error generating contextual topic URL:', error);
    return 'https://www.benzinga.com/news';
  }
}

// Enhanced function to extract key topics from lead paragraph with weights
function extractKeyTopicsFromLead(leadParagraph: string): Array<{term: string, weight: number, type: string}> {
  const cleanText = leadParagraph.replace(/<[^>]*>/g, '').toLowerCase();
  const topics: Array<{term: string, weight: number, type: string}> = [];
  
  // Company names and tickers (highest priority)
  const companyPatterns = [
    /apple\s+inc/i,
    /tesla\s+inc/i,
    /amazon\.com/i,
    /microsoft\s+corporation/i,
    /carvana\s+co/i,
    /novo\s+nordisk/i,
    /palo\s+alto\s+networks/i
  ];
  
  companyPatterns.forEach(pattern => {
    const match = cleanText.match(pattern);
    if (match) {
      topics.push({ term: match[0], weight: 100, type: 'company' });
    }
  });
  
  // Ticker symbols
  const tickerMatch = cleanText.match(/nasdaq:\s*([a-z]+)/i);
  if (tickerMatch) {
    topics.push({ term: tickerMatch[1].toUpperCase(), weight: 90, type: 'ticker' });
  }
  
  // Key technical/business terms (high priority)
  const technicalTerms = [
    'encryption', 'privacy', 'cyberattacks', 'back door', 'end-to-end encryption',
    'earnings', 'revenue', 'profit', 'analyst', 'rating', 'price target',
    'stock', 'market', 'trading', 'investor', 'investment',
    'government', 'policy', 'regulation', 'legal', 'court'
  ];
  
  technicalTerms.forEach(term => {
    if (cleanText.includes(term)) {
      topics.push({ term, weight: 80, type: 'technical' });
    }
  });
  
  // Specific phrases that indicate the story topic
  const specificPhrases = [
    'jim cramer', 'cnbc', 'online used car', 'used car dealer',
    'diabetes drug', 'weight loss', 'ozempic', 'wegovy',
    'artificial intelligence', 'ai', 'machine learning',
    'electric vehicle', 'ev', 'autonomous driving'
  ];
  
  specificPhrases.forEach(phrase => {
    if (cleanText.includes(phrase)) {
      topics.push({ term: phrase, weight: 70, type: 'phrase' });
    }
  });
  
  // Government entities
  const governmentTerms = ['u.s. government', 'u.k. government', 'federal government', 'biden administration'];
  governmentTerms.forEach(term => {
    if (cleanText.includes(term)) {
      topics.push({ term, weight: 60, type: 'government' });
    }
  });
  
  // Action words that indicate what happened
  const actionTerms = ['announced', 'reported', 'revealed', 'launched', 'acquired', 'merged', 'filed', 'sued'];
  actionTerms.forEach(term => {
    if (cleanText.includes(term)) {
      topics.push({ term, weight: 40, type: 'action' });
    }
  });
  
  // Remove duplicates and return top topics
  const uniqueTopics = topics.filter((topic, index, self) => 
    index === self.findIndex(t => t.term === topic.term)
  );
  
  return uniqueTopics.slice(0, 8); // Return top 8 topics
}

// Function to determine if a phrase should link to a topic page vs source URL
export function shouldLinkToTopic(phrase: string, sourceUrl?: string): boolean {
  if (!sourceUrl) return true;
  
  // Phrases that typically indicate topics rather than specific news events
  const topicIndicators = [
    'warning', 'concern', 'impact', 'effect', 'influence', 'pressure',
    'trend', 'movement', 'shift', 'change', 'development', 'situation',
    'environment', 'climate', 'condition', 'state', 'position',
    'strategy', 'approach', 'plan', 'initiative', 'effort',
    'challenge', 'obstacle', 'hurdle', 'difficulty', 'issue',
    'opportunity', 'potential', 'prospect', 'outlook', 'forecast'
  ];
  
  const phraseLower = phrase.toLowerCase();
  return topicIndicators.some(indicator => phraseLower.includes(indicator));
}

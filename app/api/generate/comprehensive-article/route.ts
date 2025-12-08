import { NextResponse } from 'next/server';
import { aiProvider } from '@/lib/aiProvider';
import { MODEL_CONFIG } from '../../../../lib/api';
const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';
const BZ_PRICE_URL = 'https://api.benzinga.com/api/v2/quoteDelayed';
const MODEL = 'gpt-4o';

// Scrape content from URL
async function scrapeUrl(url: string): Promise<string> {
  try {
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to scrape URL');
    }
    
    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('Error scraping URL:', error);
    throw new Error('Failed to scrape URL');
  }
}

// Generate CTA line
async function generateCTA(sourceText: string, ticker?: string): Promise<string> {
  try {
    const prompt = `Generate a compelling Call-to-Action (CTA) line for a financial news article based on this source text. The CTA should encourage readers to check market movements.

Source Text: "${sourceText.substring(0, 500)}..."

${ticker ? `Ticker: ${ticker}` : 'Use SPY as default ticker for market movements'}

Generate a single, engaging CTA line that:
- Is action-oriented and generic
- Mentions checking market movements or Wall Street activity
- Is relevant to the news content
- Uses professional but engaging language
- Is 1-2 sentences maximum

Example formats: 
- "Check out the latest moves on Wall Street..."
- "SPY is [movement]. Track it now here."
- "See how markets are reacting to this news..."

Return only the CTA text, no additional formatting.`;

    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : MODEL;
    const maxTokens = currentProvider === 'gemini' ? 8192 : 100;
    
    const response = await aiProvider.generateCompletion(
      [{ role: 'user', content: prompt }],
      {
        model,
        maxTokens,
        temperature: 0.7,
      }
    );

    return response.content.trim();
  } catch (error) {
    console.error('Error generating CTA:', error);
    return '';
  }
}

// Generate subheads
async function generateSubheads(sourceText: string): Promise<string[]> {
  try {
    const prompt = `Generate 3 engaging subheadings for a financial news article based on this source text. The subheads should break down the story into logical sections.

Source Text: "${sourceText.substring(0, 800)}..."

Generate 3 subheadings that:
- Are engaging and informative
- Break the story into logical sections
- Use proper capitalization (Title Case)
- Are relevant to the news content
- Are 3-8 words each
- Don't include quotes or special characters

Return only the 3 subheadings, one per line, no numbering or additional formatting.`;

    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : MODEL;
    const maxTokens = currentProvider === 'gemini' ? 8192 : 150;
    
    const response = await aiProvider.generateCompletion(
      [{ role: 'user', content: prompt }],
      {
        model,
        maxTokens,
        temperature: 0.7,
      }
    );

    const subheadsText = response.content.trim();
    return subheadsText.split('\n').filter((line: string) => line.trim()).slice(0, 3);
  } catch (error) {
    console.error('Error generating subheads:', error);
    return [];
  }
}

// Fetch related articles for context
async function fetchRelatedArticles(relevantSectors: string[], newsType: string, excludeUrl?: string): Promise<any[]> {
  try {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 7);
    const dateFromStr = dateFrom.toISOString().slice(0, 10);
    
    // Build search query based on relevant sectors and news type
    let searchQuery = '';
    if (newsType === 'political') {
      searchQuery = 'trump OR biden OR political';
    } else if (newsType === 'economic') {
      searchQuery = 'jobs OR inflation OR fed OR economy';
    } else if (newsType === 'corporate') {
      searchQuery = 'earnings OR ceo OR stock';
    } else {
      searchQuery = relevantSectors.join(' OR ');
    }
    
    const url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=20&fields=headline,title,created,url,channels&accept=application/json&displayOutput=full&dateFrom=${dateFromStr}`;
    
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    
    if (!res.ok) {
      console.error('Benzinga API error:', await res.text());
      return [];
    }
    
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    
    // Filter for relevant articles
    const relevantArticles = data
      .filter(item => {
        const headline = (item.headline || item.title || '').toLowerCase();
        const channels = (item.channels || []).join(' ').toLowerCase();
        
        // Check if news is relevant to the sectors or news type
        const sectorMatch = relevantSectors.some(sector => 
          headline.includes(sector) || channels.includes(sector)
        );
        
        const typeMatch = newsType === 'political' ? headline.includes('trump') || headline.includes('biden') || headline.includes('political') :
                         newsType === 'economic' ? headline.includes('jobs') || headline.includes('inflation') || headline.includes('fed') :
                         newsType === 'corporate' ? headline.includes('earnings') || headline.includes('ceo') || headline.includes('stock') :
                         true;
        
        // Exclude the current article URL if provided
        if (excludeUrl && item.url === excludeUrl) {
          return false;
        }
        
        return sectorMatch || typeMatch;
      })
      .map((item: any) => ({
        headline: item.headline || item.title || '[No Headline]',
        url: item.url,
        created: item.created,
      }))
      .slice(0, 5);
    
    return relevantArticles;
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
}

// Analyze source content to determine relevant financial elements
async function analyzeSourceContent(sourceText: string): Promise<{
  relevantSectors: string[];
  marketImpact: string;
  suggestedSymbols: string[];
  financialContext: string;
  newsType: string;
}> {
  const prompt = `Analyze this news source and determine the financial/market implications:

Source: "${sourceText.substring(0, 1000)}..."

Provide a JSON response with:
1. relevantSectors: Array of relevant market sectors (e.g., ["technology", "energy", "defense", "finance", "healthcare"])
2. marketImpact: Brief description of likely market impact ("bullish", "bearish", "neutral", "volatile", "uncertain")
3. suggestedSymbols: Array of relevant stock symbols or ETFs to mention (max 3-5, only if highly relevant)
4. financialContext: Brief description of what financial context would be most relevant
5. newsType: Type of news ("political", "economic", "corporate", "geopolitical", "regulatory", "general")

Focus on the actual news content, not generic market data. Only include specific symbols if they are directly mentioned or highly relevant.`;

  try {
    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : MODEL;
    const maxTokens = currentProvider === 'gemini' ? 8192 : 500;
    
    const response = await aiProvider.generateCompletion(
      [{ role: 'user', content: prompt }],
      {
        model,
        maxTokens,
        temperature: 0.3,
        responseFormat: { type: 'json_object' },
      }
    );

    // Clean JSON response (especially for Gemini)
    let cleanContent = response.content.trim();
    cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanContent = jsonMatch[0];
    const lastBracketIndex = cleanContent.lastIndexOf('}');
    if (lastBracketIndex !== -1) {
      cleanContent = cleanContent.substring(0, lastBracketIndex + 1);
    }

    const analysis = JSON.parse(cleanContent || '{}');
    return analysis;
  } catch (error) {
    console.error('Error analyzing source content:', error);
    return {
      relevantSectors: ['general'],
      marketImpact: 'neutral',
      suggestedSymbols: [],
      financialContext: 'general market sentiment and volatility',
      newsType: 'general'
    };
  }
}

// Fetch relevant market data based on content analysis
async function fetchRelevantMarketData(suggestedSymbols: string[], newsType: string, userTicker?: string): Promise<any> {
  try {
    // Always include major indices for context, plus any suggested symbols
    const baseSymbols = ['SPY', 'VIX', 'QQQ'];
    const symbols = [...new Set([...baseSymbols, ...suggestedSymbols, ...(userTicker ? [userTicker] : [])])];
    const url = `${BZ_PRICE_URL}?token=${BENZINGA_API_KEY}&symbols=${symbols.join(',')}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error('Benzinga API error:', await res.text());
      return null;
    }
    
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    return null;
  }
}

// Get current market status
function getMarketStatus(): string {
  const now = new Date();
  const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const nyOffset = -4; // EDT
  const nyTime = new Date(nowUtc + (3600000 * nyOffset));
  const day = nyTime.getDay();
  const hour = nyTime.getHours();
  const minute = nyTime.getMinutes();
  const time = hour * 100 + minute;
  
  if (day === 0 || day === 6) return 'closed';
  if (time >= 400 && time < 930) return 'premarket';
  if (time >= 930 && time < 1600) return 'open';
  if (time >= 1600 && time < 2000) return 'afterhours';
  return 'closed';
}

function buildComprehensivePrompt(
  sourceText: string, 
  analysis: any, 
  marketData: any, 
  relatedArticles: any[], 
  marketStatus: string,
  userTicker?: string,
  sourceUrl?: string,
  includeCTA?: boolean,
  ctaText?: string,
  includeSubheads?: boolean,
  subheadTexts?: string[]
) {
  const marketStatusText = marketStatus === 'open' ? 'trading session' : 
                          marketStatus === 'premarket' ? 'premarket trading' :
                          marketStatus === 'afterhours' ? 'after-hours trading' : 'market session';
  
  const tickerContext = userTicker ? `\nUSER REQUESTED TICKER: ${userTicker} - Include this ticker as a central focus if relevant to the story.` : '\nNO SPECIFIC TICKER: Focus on the news story and use SPY for any market references.';
  
  const hyperlinkRule = sourceUrl ? `\nNOTE: Hyperlinks will be added separately using the "Add Lead Hyperlink" feature for better control and relevance.` : '';
  
  const ctaSection = includeCTA && ctaText ? `\n- CTA Integration: After the lead paragraph, insert the following CTA exactly as provided:\n  ${ctaText}` : '';
  
  const subheadsSection = includeSubheads && subheadTexts && subheadTexts.length > 0 ? `\n- Subhead Integration: Insert the following subheads at strategic points throughout the article (after approximately 20%, 50%, and 80% of the content):\n  ${subheadTexts.map((subhead, index) => `${index + 1}. ${subhead}`).join('\n  ')}\n  Format each subhead as a standalone line with proper spacing before and after.` : '';
  
  const relatedArticlesSection = relatedArticles && relatedArticles.length > 0 ? `\n- After the second paragraph of additional content (not the lead paragraph), insert the "Also Read:" section with this exact format:\n  Also Read: <a href="${relatedArticles[0].url}">${relatedArticles[0].headline}</a>` : '';
  
  return `You are a professional financial news writer for Benzinga. Create a comprehensive financial news article based on the provided source material.

CRITICAL QUOTE REQUIREMENT: 
You MUST include at least one direct quote from the source material. Look for text that appears in quotation marks in the source and include it exactly as written. This is MANDATORY and takes priority over other instructions.

TASK: Transform the source article into a financial news piece that:
1. Reports the key news event from the source (start with the news, not market data)
2. CRITICAL: Avoids plagiarism by completely rewriting all content in original language - do not copy 4+ consecutive words from the source
3. MANDATORY: Include at least one direct quote from the source material using quotation marks. If multiple relevant quotes exist, include up to two quotes for better authenticity and credibility. Look for quotes that contain quotation marks in the source text and use them exactly as written.
4. Adds intelligent market context based on the story's implications
5. Provides relevant financial analysis and broader market impact

CRITICAL: The article MUST start with the news story, NOT with ticker movements or market data. Do NOT begin with phrases like "[TICKER] traded lower" or "[TICKER] is slipping." Start with the actual news event.

STRUCTURE:
- Headline: Create an engaging, news-focused headline
- Lead: Start with the key news event, then add market context
- Body: Expand on the news with quotes, analysis, and broader implications
- Market Context: Include relevant market data and broader financial implications
- Related News: Mention other relevant market developments

SOURCE MATERIAL:
${sourceText}

CONTENT ANALYSIS:
- News Type: ${analysis.newsType}
- Relevant Sectors: ${analysis.relevantSectors.join(', ')}
- Market Impact: ${analysis.marketImpact}
- Financial Context: ${analysis.financialContext}
- Suggested Symbols: ${analysis.suggestedSymbols.join(', ') || 'None specified'}

MARKET CONTEXT:
- Market Status: ${marketStatusText}
- Available Market Data: ${JSON.stringify(marketData, null, 2)}
- Related Articles: ${JSON.stringify(relatedArticles.slice(0, 3), null, 2)}${tickerContext}${hyperlinkRule}${ctaSection}${subheadsSection}${relatedArticlesSection}

WRITING GUIDELINES:
- START WITH THE NEWS STORY, not market data
- NEVER begin with ticker movements like "[TICKER] traded lower" or "[TICKER] is slipping"
- Start with the actual news event from the source material
- MANDATORY: Include at least one direct quote from the source material using quotation marks. If multiple relevant quotes exist, include up to two quotes for better authenticity and credibility. Look for text in the source that is already in quotation marks and use those exact quotes.
- CRITICAL PLAGIARISM PREVENTION: 
  * Do NOT copy 4 or more consecutive words from the source material
  * Completely rewrite all information in your own words and sentence structure
  * Use synonyms, different phrasing, and alternative sentence constructions
  * Paraphrase all content while maintaining accuracy and meaning
  * EXCEPTION: Direct quotes in quotation marks are allowed and encouraged - use them exactly as written
- Include market context only after establishing the news event
- Reference specific stocks, indices, or market movements only if highly relevant
- Keep paragraphs short (2-3 sentences max)
- Use professional, neutral tone suitable for financial news
- Include specific numbers, percentages, and data points when available
- Add analysis of broader market impact and investor sentiment
- Focus on the news story first, then add financial context

FORMAT:
- Use HTML tags for formatting (<p>, <strong>, <em>)
- Include hyperlinks where appropriate
- Structure with clear sections and subheadings
- End with a market impact summary
- Use Benzinga-style formatting

EXAMPLE STRUCTURE:
1. News event with direct quotes (e.g., "Federal Reserve Governor Adriana Kugler resigned on Friday...")
2. Broader implications and analysis
3. Market context and volatility
4. Related market developments
5. Market impact summary

QUOTE INCLUSION EXAMPLES:
If the source contains: "In 2026 you can expect a variety of Mona products launched into the Chinese and European markets," He said.
Your article should include: "In 2026 you can expect a variety of Mona products launched into the Chinese and European markets," He said.

If the source contains: "I think if we have the opportunity then we want to acquire some companies," He said.
Your article should include: "I think if we have the opportunity then we want to acquire some companies," He said.

CORRECT EXAMPLE LEAD:
"Federal Reserve Governor Adriana Kugler resigned on Friday, creating a vacancy on the Federal Reserve's Board of Governors at a pivotal time for monetary policy."

INCORRECT EXAMPLE LEAD:
"SPDR S&P 500 ETF (NYSE: SPY) traded lower on Friday following the resignation of Federal Reserve Governor Adriana Kugler."

PLAGIARISM PREVENTION EXAMPLES:
GOOD (Original): "Kugler stepped down from her position at the central bank, leaving her role months before her term was scheduled to end."
BAD (Copied): "Kugler resigned from the Federal Reserve Board months before her term was set to expire."

GOOD (Original): "The central bank announced that Kugler would return to her academic position at Georgetown University."
BAD (Copied): "The Federal Reserve announced that Kugler would return to Georgetown University as a professor."

Generate a comprehensive article that prioritizes the news story while adding intelligent financial context.`;
}

export async function POST(req: Request) {
  try {
    const { 
      sourceText, 
      sourceUrl, 
      ticker, 
      includeMarketData = true,
      includeCTA = false,
      includeSubheads = false,
      scrapeUrl = false
    } = await req.json();
    
    if (!sourceText && !sourceUrl) {
      return NextResponse.json({ error: 'Source text or URL is required.' }, { status: 400 });
    }

    let finalSourceText = sourceText;
    let finalSourceUrl = sourceUrl;

    // Scrape URL if provided and scraping is requested
    if (sourceUrl && scrapeUrl) {
      try {
        finalSourceText = await scrapeUrl(sourceUrl);
      } catch (error) {
        return NextResponse.json({ error: 'Failed to scrape URL content.' }, { status: 400 });
      }
    }

    if (!finalSourceText) {
      return NextResponse.json({ error: 'No source text available.' }, { status: 400 });
    }

    // First, analyze the source content to determine relevant financial elements
    const analysis = await analyzeSourceContent(finalSourceText);
    
    // Generate CTA and subheads if requested
    let ctaText = '';
    let subheadTexts: string[] = [];
    
    if (includeCTA) {
      // Use SPY as default if no ticker is provided
      const ctaTicker = ticker || 'SPY';
      ctaText = await generateCTA(finalSourceText, ctaTicker);
    }
    
    if (includeSubheads) {
      subheadTexts = await generateSubheads(finalSourceText);
    }
    
    // Fetch relevant market data and news based on analysis
    let marketData = {};
    let relatedArticles = [];
    
    if (includeMarketData) {
      marketData = await fetchRelevantMarketData(analysis.suggestedSymbols, analysis.newsType, ticker);
      relatedArticles = await fetchRelatedArticles(analysis.relevantSectors, analysis.newsType, finalSourceUrl);
    }
    
    const marketStatus = getMarketStatus();
    
    const prompt = buildComprehensivePrompt(
      finalSourceText, 
      analysis, 
      marketData, 
      relatedArticles, 
      marketStatus, 
      ticker,
      finalSourceUrl,
      includeCTA,
      ctaText,
      includeSubheads,
      subheadTexts
    );
    
    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : MODEL;
    const maxTokens = currentProvider === 'gemini' ? 8192 : 1500;
    
    const response = await aiProvider.generateCompletion(
      [{ role: 'user', content: prompt }],
      {
        model,
        maxTokens,
        temperature: 0.7,
      }
    );

    const article = response.content.trim();
    
    return NextResponse.json({ 
      article,
      analysis,
      marketData,
      relatedArticles: relatedArticles.slice(0, 10),
      marketStatus,
      ctaText,
      subheadTexts
    });
    
  } catch (error: any) {
    console.error('Error generating comprehensive article:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate article.' }, { status: 500 });
  }
} 
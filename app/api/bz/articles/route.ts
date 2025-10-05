import { NextResponse } from 'next/server';

const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';

export async function POST(req: Request) {
  try {
    const { ticker, count } = await req.json();
    // Ticker is optional - return empty articles if no ticker provided
  if (!ticker) return NextResponse.json({ articles: [] });
    // Fetch more items to ensure enough non-PR articles after filtering
    const desiredCount = count && typeof count === 'number' ? count : 6;
    const items = Math.max(desiredCount * 2, 20);
    // Try recent first (30 days), then fall back to 6 months if no results
    const searchDateRanges = [
      { days: 30, label: 'last 30 days' },
      { days: 180, label: 'last 6 months' }
    ];
    
    let articles: any[] = [];
    let searchUsed = '';
    
    for (const dateRange of searchDateRanges) {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - dateRange.days);
      const dateFromStr = dateFrom.toISOString().slice(0, 10);
      
      const url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&tickers=${encodeURIComponent(ticker)}&items=${items}&fields=headline,title,created,body,teaser,id,url,channels&accept=application/json&displayOutput=full&dateFrom=${dateFromStr}&sort=created`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      const text = await res.text();
      if (!res.ok) {
        console.error('Benzinga API error:', text);
        continue; // Try next date range
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Benzinga API did not return valid JSON. Response:', text);
        continue; // Try next date range
      }
      if (!Array.isArray(data)) {
        console.error('Benzinga API response (not array):', data);
        continue; // Try next date range
      }
      
      // Exclude PRs by filtering out items with PR channel names
      const prChannelNames = ['press releases', 'press-releases', 'pressrelease', 'pr'];
      const normalize = (str: string) => str.toLowerCase().replace(/[-_]/g, ' ');
      const dateThreshold = new Date(Date.now() - (dateRange.days * 24 * 60 * 60 * 1000));
      
      articles = data
        .filter(item => {
          // Exclude PRs
          if (
            Array.isArray(item.channels) &&
            item.channels.some(
              (ch: any) =>
                typeof ch.name === 'string' &&
                prChannelNames.includes(normalize(ch.name))
            )
          ) {
            return false;
          }
          
          // Only include articles from the current date range
          if (item.created) {
            const articleDate = new Date(item.created);
            if (articleDate < dateThreshold) {
              return false;
            }
          }
          
          return true;
        })
        .map((item: any) => ({
          id: item.id,
          headline: item.headline || item.title || '[No Headline]',
          created: item.created,
          body: item.body || item.teaser || '[No body text]',
          url: item.url || '',
        }));
      
      console.log(`Found ${articles.length} articles for ${ticker} in ${dateRange.label}`);
      
      // If we found articles, break out of the loop
      if (articles.length > 0) {
        searchUsed = dateRange.label;
        break;
      }
    }
    
    articles.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    return NextResponse.json({ 
      articles: articles.slice(0, desiredCount),
      searchRange: searchUsed,
      dateRange: searchUsed.includes('6 months') ? '6 months' : '30 days'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch articles' }, { status: 500 });
  }
} 
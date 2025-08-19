import { NextResponse } from 'next/server';

const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';

export async function GET() {
  try {
    // Test different API calls to see what we get
    const testUrls = [
      `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=20&fields=headline,title,url,channels,body&displayOutput=full`,
      `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=50&fields=headline,title,url,channels,body&displayOutput=full`,
      `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=20&fields=headline,title,url,channels,body&displayOutput=full&dateFrom=2024-01-01`,
      `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=20&fields=headline,title,url,channels,body&displayOutput=full&search=wegovy`
    ];

    const results = [];

    for (let i = 0; i < testUrls.length; i++) {
      const url = testUrls[i];
      console.log(`Testing URL ${i + 1}:`, url.replace(BENZINGA_API_KEY, '[API_KEY_HIDDEN]'));
      
      try {
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (!res.ok) {
          results.push({
            test: `URL ${i + 1}`,
            status: res.status,
            error: await res.text()
          });
          continue;
        }

        const data = await res.json();
        
        if (!Array.isArray(data)) {
          results.push({
            test: `URL ${i + 1}`,
            status: res.status,
            error: 'Response is not an array',
            data: JSON.stringify(data, null, 2).substring(0, 500)
          });
          continue;
        }

        // Check for weight loss related articles
        const weightLossArticles = data.filter((article: any) => {
          const headline = (article.headline || article.title || '').toLowerCase();
          const body = (article.body || '').toLowerCase();
          const terms = ['wegovy', 'ozempic', 'weight loss', 'obesity', 'novo nordisk', 'semaglutide'];
          return terms.some(term => headline.includes(term) || body.includes(term));
        });

        results.push({
          test: `URL ${i + 1}`,
          status: res.status,
          totalArticles: data.length,
          weightLossArticles: weightLossArticles.length,
          sampleArticles: data.slice(0, 3).map((article: any) => ({
            headline: article.headline || article.title,
            created: article.created,
            url: article.url
          })),
          weightLossSample: weightLossArticles.slice(0, 3).map((article: any) => ({
            headline: article.headline || article.title,
            created: article.created,
            url: article.url
          }))
        });

      } catch (error: any) {
        results.push({
          test: `URL ${i + 1}`,
          error: error.message || 'Unknown error'
        });
      }

      // Small delay between calls
      if (i < testUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error('Error testing articles:', error);
    return NextResponse.json({ error: error.message || 'Failed to test articles.' }, { status: 500 });
  }
}

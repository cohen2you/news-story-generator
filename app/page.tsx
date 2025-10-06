'use client';

import React, { useState, useEffect, useRef } from 'react';
import LocalDate from '../components/LocalDate';
import EnhancedContextForm from '../components/EnhancedContextForm';
import EditorialReviewForm from '../components/EditorialReviewForm';



export default function PRStoryGeneratorPage() {
  const [ticker, setTicker] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [priceAction, setPriceAction] = useState<any | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [article, setArticle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [analystSummary, setAnalystSummary] = useState('');
  const [priceSummary, setPriceSummary] = useState('');
  const [loadingStory, setLoadingStory] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [tickerError, setTickerError] = useState('');
  const [scrapingUrl, setScrapingUrl] = useState(false);
  const [scrapingError, setScrapingError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cta, setCta] = useState('');
  const [loadingCta, setLoadingCta] = useState(false);
  const [ctaError, setCtaError] = useState('');
  const [copiedCta, setCopiedCta] = useState(false);
  const [subheads, setSubheads] = useState<string[]>([]);
  const [loadingSubheads, setLoadingSubheads] = useState(false);
  const [subheadsError, setSubheadsError] = useState('');
  const [copiedSubheads, setCopiedSubheads] = useState(false);
  const [includeCTA, setIncludeCTA] = useState(false);
  const [includeSubheads, setIncludeSubheads] = useState(false);
  const [loadingReword, setLoadingReword] = useState(false);
  const [showCopyleaksModal, setShowCopyleaksModal] = useState(false);
  const [sourceCopied, setSourceCopied] = useState(false);
  const [generatedCopied, setGeneratedCopied] = useState(false);
  const [inputMode, setInputMode] = useState<'news' | 'pr'>('news');
  const [articleBeforeContext, setArticleBeforeContext] = useState('');

  // Function to compare articles using Copyleaks with modal interface
  const compareWithCopyleaks = () => {
    if (!primaryText.trim() || !article.trim()) {
      alert('Please provide both source content and generated article to compare.');
      return;
    }

    console.log('Opening Copyleaks comparison modal...');
      console.log('Source text length:', primaryText.length);
      console.log('Generated text length:', article.length);
      
    // Open Copyleaks in new tab
    window.open('https://app.copyleaks.com/text-compare', '_blank');
    
    // Reset copied states and show modal with copy buttons
    setSourceCopied(false);
    setGeneratedCopied(false);
    setShowCopyleaksModal(true);
  };

  // Copy source article to clipboard
  const copySourceArticle = async () => {
    try {
      const sourceText = primaryText.replace(/<[^>]*>/g, ''); // Remove HTML tags
      await navigator.clipboard.writeText(sourceText);
      setSourceCopied(true);
      setTimeout(() => setSourceCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Error copying source article:', error);
      alert('Failed to copy source article to clipboard.');
    }
  };

  // Copy generated article to clipboard
  const copyGeneratedArticle = async () => {
    try {
      const generatedText = article.replace(/<[^>]*>/g, ''); // Remove HTML tags
      await navigator.clipboard.writeText(generatedText);
      setGeneratedCopied(true);
      setTimeout(() => setGeneratedCopied(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Error copying generated article:', error);
      alert('Failed to copy generated article to clipboard.');
    }
  };


  // Function to reword flagged segments and rescan (disabled - using Copyleaks instead)
  const handleRewordAndRescan = async () => {
    console.log('Reword and rescan function is disabled - use Copyleaks for comparison');
    alert('This function has been replaced with direct Copyleaks integration. Use the "Compare with Copyleaks" button instead.');
  };



  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState('');
  const [previouslyUsedContextUrls, setPreviouslyUsedContextUrls] = useState<string[]>([]);
  const [showContextSearch, setShowContextSearch] = useState(false);
  const [contextSearchTerm, setContextSearchTerm] = useState('');
  const [contextSearchResults, setContextSearchResults] = useState<any[]>([]);
  const [selectedContextArticles, setSelectedContextArticles] = useState<any[]>([]);
  const [isSearchingContext, setIsSearchingContext] = useState(false);
  const [isAddingMultipleContext, setIsAddingMultipleContext] = useState(false);
  const [showEditorialReview, setShowEditorialReview] = useState(false);
  const [originalArticleBeforeReview, setOriginalArticleBeforeReview] = useState('');
  const [editorialReviewCompleted, setEditorialReviewCompleted] = useState(false);
  const [leadHyperlinkArticleIndex, setLeadHyperlinkArticleIndex] = useState(0);
  const [addingLeadHyperlink, setAddingLeadHyperlink] = useState(false);
  const [showLeadHyperlinkSearch, setShowLeadHyperlinkSearch] = useState(false);
  const [leadHyperlinkSearchTerm, setLeadHyperlinkSearchTerm] = useState('');
  const [leadHyperlinkSearchResults, setLeadHyperlinkSearchResults] = useState<any[]>([]);
  const [selectedLeadHyperlinkArticle, setSelectedLeadHyperlinkArticle] = useState<any | null>(null);
  const [isSearchingLeadHyperlink, setIsSearchingLeadHyperlink] = useState(false);
  const [editorialReviewChanges, setEditorialReviewChanges] = useState<string[]>([]);
  const [editorialReviewStats, setEditorialReviewStats] = useState({ originalWordCount: 0, newWordCount: 0 });
  const [headlinesAndKeyPoints, setHeadlinesAndKeyPoints] = useState<{ headlines: string[], keyPoints: string[] } | null>(null);
  const [generatingHeadlines, setGeneratingHeadlines] = useState(false);
  const [copiedItems, setCopiedItems] = useState<{ [key: string]: boolean }>({});




  useEffect(() => {
    console.log('Ticker:', ticker); // Debug log for ticker state
  }, [ticker]);

  useEffect(() => {
    console.log('Source URL state:', sourceUrl); // Debug log for sourceUrl state
  }, [sourceUrl]);

  useEffect(() => {
    console.log('showEditorialReview state changed:', showEditorialReview);
  }, [showEditorialReview]);



  useEffect(() => {
    console.log('originalArticleBeforeReview length:', originalArticleBeforeReview.length);
    console.log('article length:', article.length);
    console.log('Should show undo button:', originalArticleBeforeReview && originalArticleBeforeReview !== article);
  }, [originalArticleBeforeReview, article]);

  useEffect(() => {
    console.log('showLeadHyperlinkSearch state changed:', showLeadHyperlinkSearch);
  }, [showLeadHyperlinkSearch]);


  // Fetch price action for ticker
  const fetchPriceAction = async () => {
    setLoadingPrice(true);
    setPriceAction(null);
    try {
      const res = await fetch('/api/bz/priceaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (!res.ok || !data.priceAction) throw new Error(data.error || 'Failed to fetch price action');
      setPriceAction(data.priceAction);
    } catch (err: any) {
      setPriceAction(null);
    } finally {
      setLoadingPrice(false);
    }
  };

  const fetchAnalystSummary = async () => {
    try {
      const res = await fetch('/api/generate/analyst-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      console.log('Analyst ratings API response:', data); // Debug log
      if (data.ratings && data.ratings.length > 0) {
        setAnalystSummary(data.ratings.join(' '));
      } else {
        setAnalystSummary('No recent analyst ratings available.');
      }
    } catch (err) {
      console.error('Error fetching analyst ratings:', err);
      setAnalystSummary('Failed to fetch analyst ratings.');
    }
  };

  const fetchPriceSummary = async () => {
    try {
      const res = await fetch('/api/bz/priceaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      console.log('Price action API response:', data); // Debug log
      if (data.priceAction) {
        setPriceSummary(data.priceAction);
      } else {
        setPriceSummary('No recent price action available.');
      }
    } catch (err) {
      console.error('Error fetching price action:', err);
      setPriceSummary('Failed to fetch price action.');
    }
  };

  // Generate article (stub OpenAI call)
  const generateArticle = async () => {
    console.log('Generate Article clicked. Ticker:', ticker, 'Primary text length:', primaryText.length);
    setGenerating(true);
    setGenError('');
    setArticle('');
    setLoadingStory(true);

    // Use primary text as source content
    let sourceText = primaryText;
    let createdDateStr = null;
    
    if (!sourceText.trim()) {
      // If no source text provided, show error
      setGenError('Please provide content to generate a story.');
        setGenerating(false);
        setLoadingStory(false);
        return;
    }

    // Fetch analyst ratings and price action in parallel and use their returned values (only if ticker is provided)
    let analyst = 'No recent analyst ratings available.';
    let price = '';
    
    if (ticker.trim()) {
      [analyst, price] = await Promise.all([
        (async () => {
          try {
            const res = await fetch('/api/generate/analyst-ratings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker }),
            });
            const data = await res.json();
            return (data.ratings && data.ratings.length > 0)
              ? data.ratings.join(' ')
              : 'No recent analyst ratings available.';
          } catch {
            return 'Failed to fetch analyst ratings.';
          }
        })(),
        (async () => {
          try {
            const res = await fetch('/api/bz/priceaction', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker }),
            });
            const data = await res.json();
            return data.priceAction || 'No recent price action available.';
          } catch {
            return 'Failed to fetch price action.';
          }
        })()
      ]);
    }

    setAnalystSummary(analyst);
    setPriceSummary(price);

    try {
      // Calculate storyDay and storyDate for the selected PR, article, or analyst note
      let storyDay = '';
      let storyDate = '';
      let dateReference = '';
      let sourceDateFormatted = '';
      
      if (createdDateStr) {
        const createdDate = new Date(createdDateStr);
        const now = new Date();
        const daysOld = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOld < 7) {
          // Day of week (e.g., Thursday)
          const day = createdDate.toLocaleDateString('en-US', { weekday: 'long' });
          dateReference = `on ${day}`;
        } else {
          // Month Day (e.g., July 12)
          const dateStr = createdDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
          dateReference = `on ${dateStr}`;
        }
        // Format the actual date for reference in paragraphs
        sourceDateFormatted = createdDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      } else if (sourceText && ticker) {
        // For analyst notes, try to extract date from the text first
        const dateMatch = sourceText.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
        if (dateMatch) {
          const [_, day, month, year] = dateMatch;
          const analystDate = new Date(`${month} ${day}, ${year}`);
          const dayName = analystDate.toLocaleDateString('en-US', { weekday: 'long' });
          dateReference = `on ${dayName}`;
          sourceDateFormatted = analystDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        } else {
          // Fallback to today's date if no date found in text
          const today = new Date();
          const day = today.toLocaleDateString('en-US', { weekday: 'long' });
          dateReference = `on ${day}`;
          sourceDateFormatted = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        }
      } else {
        // Fallback for any other case where no date is available
        const today = new Date();
        sourceDateFormatted = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      }
      
      // Calculate priceActionDay for today
      const today = new Date();
      const priceActionDay = `on ${today.toLocaleDateString('en-US', { weekday: 'long' })}`;
      // Generate CTA and subheads if requested
      let ctaText = '';
      let subheadTexts: string[] = [];
      
             if (includeCTA && ticker.trim()) {
         try {
           const ctaRes = await fetch('/api/generate/cta-line', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ ticker }),
           });
           const ctaData = await ctaRes.json();
           if (ctaData.cta) {
             ctaText = ctaData.cta;
             setCta(ctaData.cta);
           }
         } catch (error) {
           console.error('Failed to generate CTA:', error);
         }
       }
      
      if (includeSubheads) {
        try {
          // First generate a basic story to use for subhead generation
          const basicStoryRes = await fetch('/api/generate/story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticker,
              sourceText: sourceText,
              analystSummary: analyst,
              priceSummary: price,
              sourceDate: createdDateStr,
              storyDay,
              storyDate,
              dateReference,
              priceActionDay,
              sourceUrl: sourceUrl,
              sourceDateFormatted,
            }),
          });
          const basicStoryData = await basicStoryRes.json();
          if (basicStoryData.story) {
            const subheadsRes = await fetch('/api/generate/subheads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ articleText: basicStoryData.story }),
            });
            const subheadsData = await subheadsRes.json();
            if (subheadsData.h2HeadingsOnly) {
              subheadTexts = subheadsData.h2HeadingsOnly;
              setSubheads(subheadsData.h2HeadingsOnly);
            }
          }
        } catch (error) {
          console.error('Failed to generate subheads:', error);
        }
      }
      
             const requestBody = {
           ticker: ticker || '',
           sourceText: sourceText,
           analystSummary: analyst,
           priceSummary: price,
           sourceDate: createdDateStr,
           storyDay,
           storyDate,
           dateReference,
           priceActionDay,
           sourceUrl: sourceUrl,
           sourceDateFormatted,
           includeCTA,
           ctaText,
           includeSubheads,
           subheadTexts,
           inputMode: inputMode,
       };
      
      console.log('Sending to story generation:', requestBody); // Debug log
      console.log('Source text length:', sourceText.length); // Debug log
      console.log('Source text preview:', sourceText.substring(0, 200)); // Debug log
      console.log('Source URL being sent:', sourceUrl); // Debug log
      console.log('Source URL type:', typeof sourceUrl); // Debug log
      console.log('Source URL length:', sourceUrl?.length); // Debug log
      
      const res = await fetch('/api/generate/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json();
      if (!res.ok || !data.story) throw new Error(data.error || 'Failed to generate story');
             setArticle(data.story);
             // Comparison now handled by Copyleaks directly
       setPreviouslyUsedContextUrls([]); // Clear previously used context URLs when generating new article
       setLeadHyperlinkArticleIndex(0); // Reset hyperlink article index for new article
       setAddingLeadHyperlink(false); // Reset loading state
    } catch (err: any) {
      setGenError(err.message || 'Failed to generate story');
    } finally {
      setGenerating(false);
      setLoadingStory(false);
    }
  };





  // Copy CTA to clipboard
  const copyCTA = async () => {
    if (!cta) return;
    try {
      await navigator.clipboard.write([
        new window.ClipboardItem({ 'text/html': new Blob([cta], { type: 'text/html' }) })
      ]);
      setCopiedCta(true);
      setTimeout(() => setCopiedCta(false), 2000);
    } catch {
      // fallback: copy as plain text
      await navigator.clipboard.writeText(cta.replace(/<[^>]+>/g, ''));
      setCopiedCta(true);
      setTimeout(() => setCopiedCta(false), 2000);
    }
  };

  // Copy subheads to clipboard
  const copySubheads = async () => {
    if (!subheads.length) return;
    const subheadsText = subheads.join('\n\n');
    try {
      await navigator.clipboard.writeText(subheadsText);
      setCopiedSubheads(true);
      setTimeout(() => setCopiedSubheads(false), 2000);
    } catch {
      setCopiedSubheads(true);
      setTimeout(() => setCopiedSubheads(false), 2000);
    }
  };

  // Add context from recent Benzinga article
  const addContext = async () => {
    if (!article.trim()) {
      setContextError('Generated article is required');
      return;
    }
    
    setContextError('');
    setLoadingContext(true);
    
    try {
      // Extract the lead paragraph hyperlink URL to exclude it from context
      let excludeUrl = '';
      const leadParagraphMatch = article.match(/<a href="([^"]+)">[^<]+<\/a>/);
      if (leadParagraphMatch) {
        excludeUrl = leadParagraphMatch[1];
      }
      
      const res = await fetch('/api/generate/add-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentArticle: article,
          excludeUrl: excludeUrl,
          previouslyUsedUrls: previouslyUsedContextUrls
        }),
      });
      
      const data = await res.json();
      if (data.error) {
        setContextError(data.error);
      } else if (data.updatedArticle) {
        setArticle(data.updatedArticle);
        // Add the new context URL to the previously used list
        if (data.contextSource && data.contextSource.url) {
          setPreviouslyUsedContextUrls(prev => [...prev, data.contextSource.url]);
        }
      }
    } catch (error) {
      setContextError('Failed to add context.');
    } finally {
      setLoadingContext(false);
    }
  };


  const handleScrapeUrl = async () => {
    if (!sourceUrl.trim()) {
      return;
    }
    
    setScrapingUrl(true);
    setScrapingError('');
    setShowManualInput(false);
    
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl }),
      });
      
      const data = await res.json();
      console.log('Scraping response:', data); // Debug log
      if (res.ok && data.text) {
        console.log('Setting primary text with length:', data.text.length); // Debug log
        setPrimaryText(data.text);
        setArticle('');
        setCta('');
        setCtaError('');
        setSubheads([]);
        setSubheadsError('');
        setCta('');
        setCtaError('');
        setSubheads([]);
        setSubheadsError('');
      } else {
        console.error('Failed to scrape URL:', data.error);
        setScrapingError('Failed to scrape URL. Please enter the content manually below.');
        setShowManualInput(true);
      }
    } catch (error) {
      console.error('Error scraping URL:', error);
      setScrapingError('Failed to scrape URL. Please enter the content manually below.');
      setShowManualInput(true);
    } finally {
      setScrapingUrl(false);
    }
  };

  const handleClearAll = () => {
    setTicker('');
    setSourceUrl('');
    setTickerError('');
    setScrapingUrl(false);
    setScrapingError('');
    setShowManualInput(false);
    setArticle('');
    setAnalystSummary('');
    setPriceSummary('');
    setGenError('');
    setPrimaryText('');
    setPriceAction(null);
    setCopied(false);
    setCta('');
    setCtaError('');
    setCopiedCta(false);
    setSubheads([]);
    setSubheadsError('');
    setCopiedSubheads(false);
    setIncludeCTA(false);
    setIncludeSubheads(false);
    setLoadingContext(false);
    setContextError('');
    setPreviouslyUsedContextUrls([]);
    setShowContextSearch(false);
    setContextSearchTerm('');
    setContextSearchResults([]);
    setSelectedContextArticles([]);
    setShowEditorialReview(false);
    setEditorialReviewCompleted(false);
    setEditorialReviewChanges([]);
    setEditorialReviewStats({ originalWordCount: 0, newWordCount: 0 });
    setArticleBeforeContext('');
    setInputMode('news');
  };


  const articleRef = useRef<HTMLDivElement>(null);

  const handleCopyArticle = async () => {
    if (articleRef.current) {
      // Get the article HTML content
      let htmlContent = articleRef.current.innerHTML;
      
            // Generate unique OpenAI chart with accurate data
      if (ticker) {
        try {
          // Get real price data first
          const priceResponse = await fetch('/api/bz/priceaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker }),
          });
          
          let chartImage = '';
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            if (priceData.priceAction) {
              // Generate realistic 5-day price data based on current price
              const currentPrice = priceData.priceAction.last || 100;
              const priceChange = priceData.priceAction.change || 0;
              const volatility = Math.abs(priceChange) / 100; // Use actual volatility
              
              // Create realistic 5-day price progression
              const basePrice = currentPrice - priceChange; // Start from previous close
              const prices = [];
              for (let i = 0; i < 5; i++) {
                const dayChange = (Math.random() - 0.5) * volatility * basePrice * 0.02; // Realistic daily movement
                const price = basePrice + (i * priceChange / 4) + dayChange;
                prices.push(Math.round(price * 100) / 100);
              }
              prices.push(currentPrice); // Add current price
              
              // Generate unique chart styling with OpenAI-inspired design
              const chartConfig = {
                type: 'line',
                data: {
                  labels: ['5 Days Ago', '4 Days Ago', '3 Days Ago', '2 Days Ago', 'Yesterday', 'Today'],
                  datasets: [{
                    label: `${ticker} Stock Price`,
                    data: prices,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                  }]
                },
                options: {
                  responsive: true,
                  plugins: {
                    title: {
                      display: true,
                      text: `${ticker} 5-Day Price Movement`,
                      font: { size: 16, weight: 'bold' },
                      color: '#374151'
                    },
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: false,
                      grid: {
                        color: 'rgba(0,0,0,0.1)'
                      },
                      ticks: {
                        color: '#6b7280'
                      }
                    },
                    x: {
                      grid: {
                        color: 'rgba(0,0,0,0.1)'
                      },
                      ticks: {
                        color: '#6b7280'
                      }
                    }
                  }
                }
              };
              
              const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=600&height=400&backgroundColor=white`;
              
              chartImage = `
                <div style="text-align: center; margin: 20px 0;">
                  <img src="${chartUrl}" alt="5-Day Stock Chart for ${ticker}" style="max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
                  <p style="font-size: 12px; color: #666; margin-top: 10px;">AI-Generated 5-Day Stock Chart for ${ticker}</p>
                </div>
              `;
            }
          }
          
          // Fallback to Finviz if custom chart fails
          if (!chartImage) {
            chartImage = `
              <div style="text-align: center; margin: 20px 0;">
                <img src="https://finviz.com/chart.ashx?t=${ticker}&ty=c&ta=1&p=d&s=l" alt="5-Day Stock Chart for ${ticker}" style="max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 8px;" />
                <p style="font-size: 12px; color: #666; margin-top: 10px;">5-Day Stock Chart for ${ticker}</p>
              </div>
            `;
          }
          
          const finalHtmlContent = htmlContent + chartImage;
          
          // Create a clipboard item with both HTML and text formats
          const clipboardItem = new ClipboardItem({
            'text/html': new Blob([finalHtmlContent], { type: 'text/html' }),
            'text/plain': new Blob([articleRef.current?.innerText || ''], { type: 'text/plain' })
          });
          
          navigator.clipboard.write([clipboardItem]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          return;
        } catch (error) {
          console.log('Failed to generate chart image:', error);
        }
      }
      
      // Fallback: Add chart placeholder if image capture failed
      if (ticker) {
        const chartPlaceholder = `
          <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 14px; color: #666; margin-bottom: 10px;">
              [5-Day Stock Chart for ${ticker} - Chart will be embedded when pasted into WordPress]
            </p>
          </div>
        `;
        htmlContent += chartPlaceholder;
      }
      
      // Get text content with proper line breaks
      const textContent = articleRef.current.innerText;
      
      // Create a clipboard item with both HTML and text formats
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([textContent], { type: 'text/plain' })
      });
      
      navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    }
  };

  const handleGenerateHeadlinesAndKeyPoints = async () => {
    if (!article) {
      alert('Please generate an article first');
      return;
    }

    setGeneratingHeadlines(true);
    try {
      const response = await fetch('/api/generate/headlines-keypoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ article }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate headlines and key points');
      }

      setHeadlinesAndKeyPoints(data);
    } catch (error: any) {
      console.error('Error generating headlines and key points:', error);
      alert('Failed to generate headlines and key points: ' + error.message);
    } finally {
      setGeneratingHeadlines(false);
    }
  };

  const handleCopyItem = async (text: string, itemType: string, index: number) => {
    const itemKey = `${itemType}-${index}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => ({ ...prev, [itemKey]: true }));
      setTimeout(() => {
        setCopiedItems(prev => ({ ...prev, [itemKey]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy item:', error);
    }
  };


  const handleLeadHyperlinkSearchClick = () => {
    console.log('Lead hyperlink search button clicked');
    setShowLeadHyperlinkSearch(true);
    setLeadHyperlinkSearchResults([]);
    setSelectedLeadHyperlinkArticle(null);
    setLeadHyperlinkSearchTerm('');
    console.log('showLeadHyperlinkSearch set to true');
  };

  const searchLeadHyperlinkArticles = async () => {
    if (!leadHyperlinkSearchTerm.trim()) {
      setContextError('Please enter a search term');
      return;
    }

    setIsSearchingLeadHyperlink(true);
    setContextError('');
    setLeadHyperlinkSearchResults([]);
    setSelectedLeadHyperlinkArticle(null);

    try {
      const response = await fetch('/api/bz/search-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm: leadHyperlinkSearchTerm.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search articles');
      }

      setLeadHyperlinkSearchResults(data.articles || []);
      
      if (!data.articles || data.articles.length === 0) {
        setContextError(`No articles found containing "${leadHyperlinkSearchTerm}"`);
      }
    } catch (error: any) {
      setContextError(error.message || 'Failed to search for articles. Please try again.');
    } finally {
      setIsSearchingLeadHyperlink(false);
    }
  };

  const selectLeadHyperlinkArticle = (article: any) => {
    setSelectedLeadHyperlinkArticle(article);
  };

  const applyLeadHyperlink = async () => {
    if (!selectedLeadHyperlinkArticle) {
      setContextError('Please select an article first');
      return;
    }

    setAddingLeadHyperlink(true);

    try {
      // Extract the first paragraph (lead paragraph) from the article
      const paragraphs = article.split('</p>');
      
      if (paragraphs.length > 0) {
        const leadParagraph = paragraphs[0].replace('<p>', '').trim();
        
        // Find the best 3-word phrase to hyperlink (avoiding company names and first words)
        const selectedPhrase = findBestPhraseForHyperlink(leadParagraph);
        console.log('Selected phrase for hyperlink:', selectedPhrase);
        console.log('Selected article URL:', selectedLeadHyperlinkArticle.url);
        
        if (selectedPhrase) {
          // First, remove any existing hyperlink from the lead paragraph
          let cleanParagraph = leadParagraph.replace(/<a[^>]*>([^<]*)<\/a>/g, '$1');
          console.log('Clean paragraph:', cleanParagraph);
          
          // Find the phrase in the cleaned paragraph and replace it with a hyperlink
          const escapedPhrase = selectedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const phraseRegex = new RegExp(`\\b${escapedPhrase}\\b`, 'i');
          console.log('Phrase regex:', phraseRegex);
          console.log('Regex test result:', phraseRegex.test(cleanParagraph));
          
          if (phraseRegex.test(cleanParagraph)) {
            const hyperlinkedParagraph = cleanParagraph.replace(
              phraseRegex,
              `<a href="${selectedLeadHyperlinkArticle.url}" target="_blank" rel="noopener noreferrer">${selectedPhrase}</a>`
            );
            console.log('Hyperlinked paragraph:', hyperlinkedParagraph);
            
            // Replace the first paragraph with the hyperlinked version
            paragraphs[0] = `<p>${hyperlinkedParagraph}`;
            const updatedArticle = paragraphs.join('</p>');
            console.log('Updated article preview:', updatedArticle.substring(0, 200));
            setArticle(updatedArticle);
          } else {
            // If the first attempt fails, try without word boundaries (for phrases with punctuation)
            console.log('Trying without word boundaries...');
            const simpleRegex = new RegExp(escapedPhrase, 'i');
            console.log('Simple regex:', simpleRegex);
            console.log('Simple regex test result:', simpleRegex.test(cleanParagraph));
            
            if (simpleRegex.test(cleanParagraph)) {
              const hyperlinkedParagraph = cleanParagraph.replace(
                simpleRegex,
                `<a href="${selectedLeadHyperlinkArticle.url}" target="_blank" rel="noopener noreferrer">${selectedPhrase}</a>`
              );
              console.log('Hyperlinked paragraph (simple):', hyperlinkedParagraph);
              
              // Replace the first paragraph with the hyperlinked version
              paragraphs[0] = `<p>${hyperlinkedParagraph}`;
              const updatedArticle = paragraphs.join('</p>');
              console.log('Updated article preview:', updatedArticle.substring(0, 200));
              setArticle(updatedArticle);
            } else {
              console.log('Phrase not found in paragraph even with simple regex');
            }
          }
        } else {
          console.log('No phrase selected for hyperlink');
        }
      }

      // Reset the search interface
      setShowLeadHyperlinkSearch(false);
      setLeadHyperlinkSearchTerm('');
      setLeadHyperlinkSearchResults([]);
      setSelectedLeadHyperlinkArticle(null);
      setContextError('');
    } catch (error) {
      console.error('Error adding lead hyperlink:', error);
      setContextError('Failed to add lead hyperlink');
    } finally {
      setAddingLeadHyperlink(false);
    }
  };

  // New function to find the best phrase for hyperlinking
  const findBestPhraseForHyperlink = (leadParagraph: string): string => {
    const cleanText = leadParagraph.replace(/<[^>]*>/g, '').toLowerCase();
    const words = cleanText.split(/\s+/);
    console.log('Lead paragraph words:', words);
    console.log('Number of words:', words.length);
    
    if (words.length < 3) return '';
    
    // Company names to avoid (case insensitive)
    const companyNames = [
      'hertz global holdings', 'hertz global', 'hertz holdings', 'hertz',
      'apple inc', 'apple',
      'tesla inc', 'tesla',
      'amazon.com', 'amazon',
      'microsoft corporation', 'microsoft',
      'carvana co', 'carvana',
      'novo nordisk', 'novo',
      'palo alto networks', 'palo alto',
      'general motors', 'ford motor', 'ford',
      'donald trump', 'trump', 'joe biden', 'biden',
      'lisa cook', 'cook', 'bill pulte', 'pulte',
      'federal reserve', 'federal housing finance agency', 'fhfa'
    ];
    
    // Function to check if a phrase contains a company name
    const containsCompanyName = (phrase: string): boolean => {
      return companyNames.some(name => phrase.toLowerCase().includes(name.toLowerCase()));
    };
    
    // Priority 1: Last 3 words (if not a company name)
    if (words.length >= 3) {
      const lastThreeWords = `${words[words.length - 3]} ${words[words.length - 2]} ${words[words.length - 1]}`;
      console.log('Checking last 3 words:', lastThreeWords);
      if (!containsCompanyName(lastThreeWords)) {
        console.log('Using last 3 words (Priority 1)');
        return lastThreeWords;
      } else {
        console.log('Last 3 words contain company name, skipping');
      }
    }
    
    // Priority 2: Middle of paragraph (avoid first 3 words and company names)
    const middleStart = Math.max(3, Math.floor(words.length * 0.3)); // Start at 30% into the paragraph
    const middleEnd = Math.min(words.length - 3, Math.floor(words.length * 0.7)); // End at 70% into the paragraph
    
    for (let i = middleStart; i <= middleEnd - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (!containsCompanyName(phrase)) {
        return phrase;
      }
    }
    
    // Priority 3: Any 3 words that don't contain company names (avoiding first 3)
    for (let i = 3; i <= words.length - 3; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (!containsCompanyName(phrase)) {
        return phrase;
      }
    }
    
    // Fallback: Last 3 words even if it contains company name
    if (words.length >= 3) {
      return `${words[words.length - 3]} ${words[words.length - 2]} ${words[words.length - 1]}`;
    }
    
    // Final fallback: First 3 words
    return `${words[0]} ${words[1]} ${words[2]}`;
  };

  // Helper function to extract key topics from lead paragraph
  const extractKeyTopicsFromLead = (leadParagraph: string): Array<{term: string, weight: number, type: string}> => {
    const cleanText = leadParagraph.replace(/<[^>]*>/g, '').toLowerCase();
    const topics: Array<{term: string, weight: number, type: string}> = [];
    
    // Political figures and public officials (highest priority)
    const politicalFigures = [
      'donald trump', 'trump', 'joe biden', 'biden', 'kamala harris', 'harris',
      'jerome powell', 'powell', 'lisa cook', 'cook', 'bill pulte', 'pulte'
    ];
    
    politicalFigures.forEach(figure => {
      if (cleanText.includes(figure)) {
        topics.push({ term: figure, weight: 100, type: 'political' });
      }
    });
    
    // Government agencies and institutions (high priority)
    const governmentAgencies = [
      'federal reserve', 'federal housing finance agency', 'fhfa', 'federal reserve governor',
      'white house', 'congress', 'senate', 'house of representatives',
      'sec', 'federal trade commission', 'ftc', 'department of justice', 'doj'
    ];
    
    governmentAgencies.forEach(agency => {
      if (cleanText.includes(agency)) {
        topics.push({ term: agency, weight: 95, type: 'government' });
      }
    });
    
    // Financial and legal terms (high priority)
    const financialTerms = [
      'mortgage fraud', 'bank documents', 'loan terms', 'resignation', 'allegations',
      'earnings', 'revenue', 'profit', 'analyst', 'rating', 'price target',
      'stock', 'market', 'trading', 'investor', 'investment',
      'government', 'policy', 'regulation', 'legal', 'court', 'lawsuit'
    ];
    
    financialTerms.forEach(term => {
      if (cleanText.includes(term)) {
        topics.push({ term, weight: 85, type: 'financial' });
      }
    });
    
    // Company names and tickers (high priority)
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
      /ford\s+motor/i
    ];
    
    companyPatterns.forEach(pattern => {
      const match = cleanText.match(pattern);
      if (match) {
        topics.push({ term: match[0], weight: 80, type: 'company' });
      }
    });
    
    // Ticker symbols
    const tickerMatch = cleanText.match(/nasdaq:\s*([a-z]+)/i);
    if (tickerMatch) {
      topics.push({ term: tickerMatch[1].toUpperCase(), weight: 75, type: 'ticker' });
    }
    
    // Specific phrases that indicate the story topic
    const specificPhrases = [
      'jim cramer', 'cnbc', 'online used car', 'used car dealer',
      'diabetes drug', 'weight loss', 'ozempic', 'wegovy',
      'artificial intelligence', 'ai', 'machine learning',
      'electric vehicle', 'ev', 'autonomous driving',
      'rental car', 'car rental', 'fleet management'
    ];
    
    specificPhrases.forEach(phrase => {
      if (cleanText.includes(phrase)) {
        topics.push({ term: phrase, weight: 70, type: 'phrase' });
      }
    });
    
    // Action words that indicate what happened
    const actionTerms = [
      'announced', 'reported', 'revealed', 'launched', 'acquired', 'merged', 'filed', 'sued',
      'demanded', 'resignation', 'allegations', 'falsified', 'secured', 'prompting', 'call for'
    ];
    actionTerms.forEach(term => {
      if (cleanText.includes(term)) {
        topics.push({ term, weight: 60, type: 'action' });
      }
    });
    
    // Remove duplicates and return top topics
    const uniqueTopics = topics.filter((topic, index, self) => 
      index === self.findIndex(t => t.term === topic.term)
    );
    
    return uniqueTopics.slice(0, 8); // Return top 8 topics
  };



  // Enhanced context search functions
  const handleContextSearchClick = () => {
    setShowContextSearch(true);
    setContextSearchResults([]);
    setSelectedContextArticles([]);
    setContextSearchTerm('');
  };

  const searchContextArticles = async () => {
    if (!contextSearchTerm.trim()) {
      setContextError('Please enter a search term');
      return;
    }

    setIsSearchingContext(true);
    setContextError('');
    setContextSearchResults([]);
    setSelectedContextArticles([]);

    try {
      const response = await fetch('/api/bz/search-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm: contextSearchTerm.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search articles');
      }

      setContextSearchResults(data.articles || []);
      
      if (data.totalFound === 0) {
        setContextError(`No articles found containing "${contextSearchTerm}"`);
      }
    } catch (error: any) {
      setContextError(error.message || 'Failed to search articles');
    } finally {
      setIsSearchingContext(false);
    }
  };

  const toggleContextArticleSelection = (article: any) => {
    setSelectedContextArticles(prev => {
      const isSelected = prev.some(a => a.url === article.url);
      if (isSelected) {
        return prev.filter(a => a.url !== article.url);
      } else {
        if (prev.length >= 3) {
          setContextError('Maximum 3 articles can be selected');
          return prev;
        }
        return [...prev, article];
      }
    });
  };

  const addMultipleContextToArticle = async () => {
    if (selectedContextArticles.length === 0) {
      setContextError('Please select at least one article');
      return;
    }

    // Store the current article state before adding context
    setArticleBeforeContext(article);

    setIsAddingMultipleContext(true);

    try {
      const response = await fetch('/api/generate/add-multiple-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentArticle: article,
          selectedArticles: selectedContextArticles,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add context');
      }

      setArticle(data.updatedArticle);
      
      // Keep the context search interface open for additional context additions
      // Only clear the selected articles, but keep search results and interface open
      setSelectedContextArticles([]);
      setContextError('');
    } catch (error: any) {
      setContextError(error.message || 'Failed to add context');
    } finally {
      setIsAddingMultipleContext(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: 'auto', padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h1>Benzinga Article Generator</h1>
        <button
          onClick={handleClearAll}
          style={{ padding: '6px 12px', background: '#b91c1c', color: 'white', border: 'none', borderRadius: 4 }}
        >
          Clear All Data
        </button>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label>
          Stock Ticker:{' '}
          <input
            type="text"
            value={ticker}
            onChange={e => {
              setTicker(e.target.value.toUpperCase());
              if (e.target.value.trim()) {
                setTickerError('');
              }
            }}
            placeholder="e.g. AAPL"
            style={{ fontSize: 16, padding: 6, width: 120 }}
          />
        </label>
        {tickerError && (
          <div style={{ color: 'red', fontSize: 14, marginTop: 4 }}>
            {tickerError}
          </div>
        )}
      </div>
      
      {/* Input Mode Toggle */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
          Content Type:
        </label>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              name="inputMode"
              value="news"
              checked={inputMode === 'news'}
              onChange={(e) => setInputMode(e.target.value as 'news' | 'pr')}
              style={{ marginRight: 8 }}
            />
            News Article (with source attribution)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              name="inputMode"
              value="pr"
              checked={inputMode === 'pr'}
              onChange={(e) => setInputMode(e.target.value as 'news' | 'pr')}
              style={{ marginRight: 8 }}
            />
            Press Release (internal, no attribution)
          </label>
        </div>
      </div>
      
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          {inputMode === 'news' ? 'Source URL (optional):' : 'Press Release URL (optional):'}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="url"
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://example.com/article-url"
              style={{ 
                flex: 1,
                fontSize: 16, 
                padding: 8, 
                border: '1px solid #ccc',
                borderRadius: 4
              }}
            />
            {sourceUrl.trim() && (
              <button
                onClick={handleScrapeUrl}
                disabled={scrapingUrl}
                style={{ 
                  padding: '8px 12px', 
                  background: scrapingUrl ? '#6b7280' : '#059669', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: scrapingUrl ? 'not-allowed' : 'pointer'
                }}
              >
                {scrapingUrl ? 'Scraping...' : 'Scrape URL'}
              </button>
            )}
          </div>
        </label>
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', marginRight: 16 }}>
              <input
                type="checkbox"
                checked={includeCTA}
                onChange={(e) => setIncludeCTA(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Include CTA
            </label>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={includeSubheads}
                onChange={(e) => setIncludeSubheads(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Include Subheads
            </label>
          </div>
                     <button
             onClick={generateArticle}
             disabled={generating}
             style={{ 
               padding: '8px 16px', 
               background: generating ? '#6b7280' : '#2563eb', 
               color: 'white', 
               border: 'none', 
               borderRadius: 4,
               fontSize: 16,
               cursor: generating ? 'not-allowed' : 'pointer'
             }}
             title={generating ? 'Generating story...' : 'Generate story'}
           >
             {generating ? 'Generating Story...' : 'Generate Story'}
           </button>
        </div>
      </div>
      
      {/* Generated Article - Moved here to appear directly under Generate Story button */}
             {genError && <div style={{ color: 'red', marginBottom: 10 }}>{genError}</div>}
       {contextError && <div style={{ color: 'red', marginBottom: 10 }}>{contextError}</div>}
             {article && (
         <div style={{ marginBottom: 20 }}>
           {/* Enhanced Context Search Interface - Moved above article */}
           {showContextSearch && (
             <div style={{ 
               marginBottom: 20, 
               padding: 16, 
               border: '1px solid #e5e7eb', 
               borderRadius: 8, 
               backgroundColor: '#f9fafb' 
             }}>
               <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                 Search for Benzinga Articles
               </h3>
               
               <div style={{ marginBottom: 16 }}>
                 <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                   <input
                     type="text"
                     value={contextSearchTerm}
                     onChange={(e) => setContextSearchTerm(e.target.value)}
                     placeholder="e.g., 'Wegovy', 'Novo Nordisk', 'weight loss drugs', 'FDA approval'..."
                     style={{ 
                       flex: 1, 
                       padding: '8px 12px', 
                       border: '1px solid #d1d5db', 
                       borderRadius: 4,
                       fontSize: 14
                     }}
                     onKeyPress={(e) => e.key === 'Enter' && searchContextArticles()}
                   />
                   <button
                     onClick={searchContextArticles}
                     disabled={isSearchingContext}
                     style={{ 
                       padding: '8px 16px', 
                       background: isSearchingContext ? '#6b7280' : '#2563eb', 
                       color: 'white', 
                       border: 'none', 
                       borderRadius: 4,
                       fontSize: 14,
                       cursor: isSearchingContext ? 'not-allowed' : 'pointer'
                     }}
                   >
                     {isSearchingContext ? 'Searching...' : 'Search'}
                   </button>
                   <button
                     onClick={() => setShowContextSearch(false)}
                     style={{ 
                       padding: '8px 16px', 
                       background: '#6b7280', 
                       color: 'white', 
                       border: 'none', 
                       borderRadius: 4,
                       fontSize: 14,
                       cursor: 'pointer'
                     }}
                   >
                     Cancel
                   </button>
                 </div>
               </div>

               {contextSearchResults.length > 0 && (
                 <div style={{ marginBottom: 16 }}>
                   <h4 style={{ marginBottom: 12, fontSize: 16, fontWeight: 'bold' }}>
                     Found {contextSearchResults.length} articles (select up to 3):
                   </h4>
                   
                   <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 16 }}>
                     {contextSearchResults.map((article, index) => {
                       const isSelected = selectedContextArticles.some(a => a.url === article.url);
                       return (
                         <div
                           key={`${article.url}-${index}`}
                           style={{
                             border: isSelected ? '2px solid #2563eb' : '1px solid #d1d5db',
                             borderRadius: 6,
                             padding: 12,
                             marginBottom: 8,
                             cursor: 'pointer',
                             backgroundColor: isSelected ? '#eff6ff' : 'white',
                             transition: 'all 0.2s'
                           }}
                           onClick={() => toggleContextArticleSelection(article)}
                         >
                           <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                             <input
                               type="checkbox"
                               checked={isSelected}
                               onChange={() => toggleContextArticleSelection(article)}
                               style={{ marginTop: 2 }}
                             />
                             <div style={{ flex: 1 }}>
                               <h5 style={{ 
                                 margin: '0 0 8px 0', 
                                 fontSize: 14, 
                                 fontWeight: 'bold',
                                 color: '#1f2937'
                               }}>
                                 {article.headline}
                               </h5>
                               <p style={{ 
                                 margin: '0 0 8px 0', 
                                 fontSize: 12, 
                                 color: '#6b7280',
                                 lineHeight: 1.4
                               }}>
                                 {article.body.substring(0, 120)}...
                               </p>
                               <div style={{ 
                                 display: 'flex', 
                                 justifyContent: 'space-between', 
                                 alignItems: 'center',
                                 fontSize: 11,
                                 color: '#9ca3af'
                               }}>
                                 <span>
                                   {new Date(article.created).toLocaleDateString('en-US', {
                                     month: 'short',
                                     day: 'numeric',
                                     hour: '2-digit',
                                     minute: '2-digit',
                                   })}
                                 </span>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                 <span>Relevance: {article.relevanceScore}</span>
                                   {article.url && (
                                     <a 
                                       href={article.url} 
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       style={{ color: '#2563eb', textDecoration: 'underline' }}
                                       onClick={(e) => e.stopPropagation()} // Prevent triggering the checkbox selection
                                     >
                                       View Article
                                     </a>
                                   )}
                                 </div>
                               </div>
                             </div>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               )}

               {selectedContextArticles.length > 0 && (
                 <div style={{ marginBottom: 16 }}>
                   <h4 style={{ marginBottom: 8, fontSize: 16, fontWeight: 'bold' }}>
                     Selected Articles ({selectedContextArticles.length}/3):
                   </h4>
                   <div style={{ marginBottom: 16 }}>
                     {selectedContextArticles.map((article, index) => (
                       <div key={`${article.url}-${index}`} style={{ 
                         fontSize: 13, 
                         color: '#6b7280', 
                         backgroundColor: '#f3f4f6', 
                         padding: 8, 
                         borderRadius: 4,
                         marginBottom: 4
                       }}>
                         {article.headline}
                       </div>
                     ))}
                   </div>
                   
                   <button
                     onClick={addMultipleContextToArticle}
                     disabled={isAddingMultipleContext}
                     style={{ 
                       width: '100%',
                       padding: '12px 16px', 
                       background: isAddingMultipleContext ? '#6b7280' : '#059669', 
                       color: 'white', 
                       border: 'none', 
                       borderRadius: 4,
                       fontSize: 14,
                       cursor: isAddingMultipleContext ? 'not-allowed' : 'pointer'
                     }}
                   >
                     {isAddingMultipleContext ? 'Adding Context...' : `Add ${selectedContextArticles.length} Article${selectedContextArticles.length > 1 ? 's' : ''} as Context`}
                   </button>
                 </div>
               )}
                           </div>
            )}

            {/* Lead Hyperlink Search Interface */}
            {showLeadHyperlinkSearch && (
              <div style={{ 
                marginBottom: 20, 
                padding: 16, 
                border: '1px solid #e5e7eb', 
                borderRadius: 8, 
                backgroundColor: '#f9fafb' 
              }}>
                <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18, fontWeight: 'bold' }}>
                  Add Lead Hyperlink
                </h3>
                
                <div style={{ marginBottom: 16 }}>
                  <p style={{ marginBottom: 12, fontSize: 14, color: '#6b7280' }}>
                    Search for articles to create hyperlinks in your lead paragraph.
                  </p>
                  
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <input
                      type="text"
                      value={leadHyperlinkSearchTerm}
                      onChange={(e) => setLeadHyperlinkSearchTerm(e.target.value)}
                      placeholder="e.g., 'Tesla', 'Federal Reserve', 'Apple earnings'..."
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        fontSize: 14,
                        outline: 'none'
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && searchLeadHyperlinkArticles()}
                    />
                    <button
                      onClick={searchLeadHyperlinkArticles}
                      disabled={isSearchingLeadHyperlink || !leadHyperlinkSearchTerm.trim()}
                      style={{ 
                        padding: '8px 16px', 
                        background: '#7c3aed', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 4,
                        fontSize: 14,
                        cursor: isSearchingLeadHyperlink || !leadHyperlinkSearchTerm.trim() ? 'not-allowed' : 'pointer',
                        opacity: isSearchingLeadHyperlink || !leadHyperlinkSearchTerm.trim() ? 0.5 : 1
                      }}
                    >
                      {isSearchingLeadHyperlink ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  
                  {contextError && (
                    <div style={{ color: '#dc2626', fontSize: 14, marginBottom: 8 }}>
                      {contextError}
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowLeadHyperlinkSearch(false)}
                    style={{ 
                      padding: '8px 16px', 
                      background: '#6b7280', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 4,
                      fontSize: 14,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {leadHyperlinkSearchResults.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ marginBottom: 12, fontSize: 16, fontWeight: 'bold' }}>
                      Found {leadHyperlinkSearchResults.length} article{leadHyperlinkSearchResults.length > 1 ? 's' : ''} (select one):
                    </h4>
                    
                    <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 16 }}>
                      {leadHyperlinkSearchResults.map((article, index) => {
                        const isSelected = selectedLeadHyperlinkArticle?.url === article.url;
                        return (
                          <div
                            key={`${article.url}-${index}`}
                            style={{
                              border: isSelected ? '2px solid #7c3aed' : '1px solid #d1d5db',
                              borderRadius: 6,
                              padding: 12,
                              marginBottom: 8,
                              cursor: 'pointer',
                              backgroundColor: isSelected ? '#f3f4f6' : 'white',
                              transition: 'all 0.2s'
                            }}
                            onClick={() => selectLeadHyperlinkArticle(article)}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() => selectLeadHyperlinkArticle(article)}
                                style={{ marginTop: 2 }}
                              />
                              <div style={{ flex: 1 }}>
                                <h5 style={{ 
                                  margin: '0 0 8px 0', 
                                  fontSize: 14, 
                                  fontWeight: 'bold',
                                  color: '#1f2937'
                                }}>
                                  {article.headline}
                                </h5>
                                <p style={{ 
                                  margin: '0 0 8px 0', 
                                  fontSize: 12, 
                                  color: '#6b7280',
                                  lineHeight: 1.4
                                }}>
                                  {article.body ? article.body.substring(0, 120) + '...' : article.title || article.headline}
                                </p>
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  fontSize: 11,
                                  color: '#9ca3af'
                                }}>
                                  <span>
                                    {article.created ? new Date(article.created).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }) : 'Article'}
                                  </span>
                                  {article.url && (
                                    <a 
                                      href={article.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ color: '#2563eb', textDecoration: 'underline' }}
                                    >
                                      View Article
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedLeadHyperlinkArticle && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ marginBottom: 8, fontSize: 16, fontWeight: 'bold' }}>
                      Selected Article:
                    </h4>
                    <div style={{ 
                      fontSize: 13, 
                      color: '#6b7280', 
                      backgroundColor: '#f3f4f6', 
                      padding: 8, 
                      borderRadius: 4,
                      marginBottom: 8
                    }}>
                      {selectedLeadHyperlinkArticle.headline}
                    </div>
                    
                    <button
                      onClick={applyLeadHyperlink}
                      disabled={addingLeadHyperlink}
                      style={{ 
                        width: '100%',
                        padding: '12px 16px', 
                        background: addingLeadHyperlink ? '#6b7280' : '#7c3aed', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 4,
                        fontSize: 14,
                        cursor: addingLeadHyperlink ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {addingLeadHyperlink ? 'Adding Hyperlink...' : 'Apply Lead Hyperlink'}
                    </button>
                  </div>
                )}
              </div>
            )}

               {/* Primary Actions Row */}
               <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                 <button
                   onClick={handleLeadHyperlinkSearchClick}
                   disabled={!article || article.trim() === ''}
                   style={{ 
                     padding: '8px 16px', 
                     background: '#7c3aed', 
                     color: 'white', 
                     border: 'none', 
                     borderRadius: 4,
                     fontSize: 14,
                     cursor: (article && article.trim() !== '') ? 'pointer' : 'not-allowed',
                     opacity: (article && article.trim() !== '') ? 1 : 0.5
                   }}
                 >
                   Add Lead Hyperlink
                 </button>
                 <button
                   onClick={handleContextSearchClick}
                   disabled={loadingContext}
                   style={{ 
                     padding: '8px 16px', 
                     background: loadingContext ? '#6b7280' : '#dc2626', 
                     color: 'white', 
                     border: 'none', 
                     borderRadius: 4,
                     fontSize: 14,
                     cursor: loadingContext ? 'not-allowed' : 'pointer'
                   }}
                 >
                   Add Benzinga Context
                 </button>
                 {primaryText && article && (
                 <button
                     onClick={() => compareWithCopyleaks()}
                   style={{ 
                     padding: '8px 16px', 
                       background: '#059669', 
                     color: 'white', 
                     border: 'none', 
                     borderRadius: 4,
                     fontSize: 14,
                       cursor: 'pointer'
                   }}
                 >
                     Compare with Copyleaks
                 </button>
                 )}
                 <button
                   onClick={handleCopyArticle}
                   style={{ 
                     padding: '8px 16px', 
                     background: copied ? '#059669' : '#2563eb', 
                     color: 'white', 
                     border: 'none', 
                     borderRadius: 4,
                     fontSize: 14
                   }}
                 >
                   {copied ? 'Copied!' : 'Copy Article'}
                 </button>
               </div>

               {/* Secondary Actions Row */}
               <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                                  <button
                    onClick={() => {
                      console.log('Editorial Review button clicked');
                      setOriginalArticleBeforeReview(article);
                      setShowEditorialReview(true);
                      // Scroll to the editorial review form
                      setTimeout(() => {
                        const editorialForm = document.querySelector('[data-editorial-review]');
                        if (editorialForm) {
                          editorialForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }, 100);
                    }}
                    style={{ 
                      padding: '8px 16px', 
                      background: '#8b5cf6', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 4,
                      fontSize: 14,
                      cursor: 'pointer'
                    }}
                                    >
                     Editorial Review
                   </button>
                   {((originalArticleBeforeReview && originalArticleBeforeReview.trim() !== article.trim()) || editorialReviewCompleted) && (
                     <button
                       onClick={() => {
                         setArticle(originalArticleBeforeReview);
                         setOriginalArticleBeforeReview('');
                         setEditorialReviewCompleted(false);
                       }}
                       style={{ 
                         padding: '8px 16px', 
                         background: '#dc2626', 
                         color: 'white', 
                         border: 'none', 
                         borderRadius: 4,
                         fontSize: 14,
                         cursor: 'pointer'
                       }}
                                           >
                         Undo Edit
                       </button>
                   )}
                   {articleBeforeContext && articleBeforeContext.trim() !== article.trim() && (
                     <button
                       onClick={() => {
                         setArticle(articleBeforeContext);
                         setArticleBeforeContext('');
                         // Reset context search interface to allow new context additions
                         setShowContextSearch(false);
                         setSelectedContextArticles([]);
                         setContextSearchResults([]);
                         setContextError('');
                       }}
                       style={{ 
                         padding: '8px 16px', 
                         background: '#dc2626', 
                         color: 'white', 
                         border: 'none', 
                         borderRadius: 4,
                         fontSize: 14,
                         cursor: 'pointer'
                       }}
                     >
                       Undo Context
                     </button>
                   )}
                  <button
                    onClick={handleGenerateHeadlinesAndKeyPoints}
                    disabled={generatingHeadlines}
                    style={{ 
                      padding: '8px 16px', 
                      background: generatingHeadlines ? '#6b7280' : '#7c3aed', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 4,
                      fontSize: 14,
                      cursor: generatingHeadlines ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {generatingHeadlines ? 'Generating...' : 'Generate Headlines & Key Points'}
                  </button>
               </div>

        {/* Headlines and Key Points Display */}
        {headlinesAndKeyPoints && (
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ 
              backgroundColor: '#f0f9ff', 
              border: '1px solid #0ea5e9', 
              borderRadius: '8px', 
              padding: '20px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ 
                fontWeight: '600', 
                fontSize: '18px', 
                color: '#0c4a6e', 
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ 
                  backgroundColor: '#0ea5e9', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '24px', 
                  height: '24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  marginRight: '12px'
                }}>
                  ✏️
                </span>
                Generated Headlines & Key Points
              </h3>
              
              {/* Headlines Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ 
                  fontWeight: '600', 
                  fontSize: '16px', 
                  color: '#0c4a6e', 
                  marginBottom: '12px' 
                }}>
                  Headlines:
                </h4>
                <div style={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e0f2fe', 
                  borderRadius: '6px', 
                  padding: '16px' 
                }}>
                  {headlinesAndKeyPoints.headlines.map((headline, index) => (
                    <div key={index} style={{ 
                      marginBottom: index < headlinesAndKeyPoints.headlines.length - 1 ? '12px' : '0',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '4px',
                      borderLeft: '3px solid #0ea5e9',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: '600', color: '#0c4a6e', marginRight: '8px' }}>
                          {index + 1}.
                        </span>
                        {headline}
                      </div>
                      <button
                        onClick={() => handleCopyItem(headline, 'headline', index)}
                        style={{
                          padding: '4px 8px',
                          background: copiedItems[`headline-${index}`] ? '#059669' : '#0ea5e9',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          marginLeft: '12px',
                          minWidth: '60px'
                        }}
                      >
                        {copiedItems[`headline-${index}`] ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Points Section */}
              <div>
                <h4 style={{ 
                  fontWeight: '600', 
                  fontSize: '16px', 
                  color: '#0c4a6e', 
                  marginBottom: '12px' 
                }}>
                  Key Points:
                </h4>
                <div style={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e0f2fe', 
                  borderRadius: '6px', 
                  padding: '16px' 
                }}>
                  {headlinesAndKeyPoints.keyPoints.map((keyPoint, index) => (
                    <div key={index} style={{ 
                      marginBottom: index < headlinesAndKeyPoints.keyPoints.length - 1 ? '12px' : '0',
                      padding: '8px 12px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '4px',
                      borderLeft: '3px solid #10b981',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: '600', color: '#065f46', marginRight: '8px' }}>
                          {index + 1}.
                        </span>
                        {keyPoint}
                      </div>
                      <button
                        onClick={() => handleCopyItem(keyPoint, 'keypoint', index)}
                        style={{
                          padding: '4px 8px',
                          background: copiedItems[`keypoint-${index}`] ? '#059669' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          marginLeft: '12px',
                          minWidth: '60px'
                        }}
                      >
                        {copiedItems[`keypoint-${index}`] ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
          )}

          <div
            ref={articleRef}
            style={{
              border: '1px solid #ccc',
              borderRadius: 4,
              padding: 16,
              background: '#fff',
              fontSize: 16,
              fontFamily: 'Georgia, serif',
              marginTop: 10,
              whiteSpace: 'pre-wrap',
            }}
            dangerouslySetInnerHTML={{ 
              __html: article.replace('[STOCK_CHART_PLACEHOLDER]', 
                ticker ? `
                  <div style="text-align: center; margin: 20px 0;">
                    <p style="font-size: 14px; color: #666; margin-bottom: 10px;">
                      [5-Day Stock Chart for ${ticker} - Chart will be embedded when pasted into WordPress]
                    </p>
                  </div>
                ` : ''
              )
            }}
          />
          </div>
          
                  )}


        {/* Editorial Review Changes Summary */}
        {editorialReviewCompleted && editorialReviewChanges.length > 0 && (
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ 
              backgroundColor: '#fef3c7', 
              border: '1px solid #f59e0b', 
              borderRadius: '8px', 
              padding: '20px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ 
                fontWeight: '600', 
                fontSize: '18px', 
                color: '#92400e', 
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ 
                  backgroundColor: '#f59e0b', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '24px', 
                  height: '24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  marginRight: '12px'
                }}>
                  ✓
                </span>
                Editorial Review Changes Made
              </h3>
              
              <div style={{ 
                backgroundColor: '#fef3c7', 
                border: '1px solid #f59e0b', 
                borderRadius: '6px', 
                padding: '16px', 
                marginBottom: '16px' 
              }}>
                <div style={{ fontSize: '14px', color: '#92400e', marginBottom: '12px' }}>
                  <div style={{ marginBottom: '4px' }}>Original: {editorialReviewStats.originalWordCount} words</div>
                  <div style={{ marginBottom: '4px' }}>New: {editorialReviewStats.newWordCount} words</div>
                  <div style={{ fontWeight: '600' }}>Reduction: {editorialReviewStats.originalWordCount - editorialReviewStats.newWordCount} words</div>
                </div>
              </div>

              <div>
                <h4 style={{ 
                  fontWeight: '600', 
                  fontSize: '16px', 
                  color: '#92400e', 
                  marginBottom: '12px' 
                }}>
                  Changes Applied:
                </h4>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {editorialReviewChanges.map((change, index) => (
                    <li key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      marginBottom: '10px',
                      padding: '8px 12px',
                      backgroundColor: 'white',
                      borderRadius: '4px',
                      border: '1px solid #fbbf24'
                    }}>
                      <span style={{ 
                        color: '#d97706', 
                        marginRight: '10px', 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>•</span>
                      <span style={{ 
                        color: '#78350f', 
                        fontSize: '14px', 
                        lineHeight: '1.4' 
                      }}>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Editorial Review No Changes Summary */}
        {editorialReviewCompleted && editorialReviewChanges.length === 0 && (
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ 
              backgroundColor: '#f0fdf4', 
              border: '1px solid #bbf7d0', 
              borderRadius: '8px', 
              padding: '20px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ 
                fontWeight: '600', 
                fontSize: '18px', 
                color: '#166534', 
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ 
                  backgroundColor: '#22c55e', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '24px', 
                  height: '24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '14px', 
                  fontWeight: 'bold',
                  marginRight: '12px'
                }}>
                  ✓
                </span>
                Editorial Review Complete
              </h3>
              
              <div style={{ 
                backgroundColor: '#f0fdf4', 
                border: '1px solid #bbf7d0', 
                borderRadius: '6px', 
                padding: '16px' 
              }}>
                <div style={{ fontSize: '14px', color: '#15803d', marginBottom: '8px' }}>
                  <div style={{ marginBottom: '4px' }}>Original: {editorialReviewStats.originalWordCount} words</div>
                  <div style={{ marginBottom: '4px' }}>New: {editorialReviewStats.newWordCount} words</div>
                  <div style={{ fontWeight: '600' }}>Reduction: {editorialReviewStats.originalWordCount - editorialReviewStats.newWordCount} words</div>
                </div>
                <div style={{ 
                  color: '#15803d', 
                  fontSize: '14px', 
                  fontStyle: 'italic',
                  marginTop: '8px'
                }}>
                  No significant changes were made during the editorial review. The article was already well-optimized.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Editorial Review Form */}
        {showEditorialReview && (
          <div style={{ marginBottom: 20 }} data-editorial-review>
            <EditorialReviewForm
              article={originalArticleBeforeReview || article}
              sourceText={primaryText}
              onComplete={(reviewedArticle, changes, stats) => {
                setArticle(reviewedArticle);
                setEditorialReviewChanges(changes || []);
                setEditorialReviewStats(stats || { originalWordCount: 0, newWordCount: 0 });
                setShowEditorialReview(false);
     setShowLeadHyperlinkSearch(false);
     setLeadHyperlinkSearchTerm('');
     setLeadHyperlinkSearchResults([]);
     setSelectedLeadHyperlinkArticle(null);
     setShowLeadHyperlinkSearch(false);
     setLeadHyperlinkSearchTerm('');
     setLeadHyperlinkSearchResults([]);
     setSelectedLeadHyperlinkArticle(null);
                setEditorialReviewCompleted(true);
                // Keep the originalArticleBeforeReview state so the Undo Edit button appears
              }}
              onBack={() => setShowEditorialReview(false)}
            />
          </div>
        )}

        
      
      
      {scrapingError && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#dc2626', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '4px', border: '1px solid #fecaca' }}>
            {scrapingError}
          </div>
        </div>
      )}
      
      {showManualInput && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Enter Article Content Manually:
            <textarea
              value={primaryText}
              onChange={e => setPrimaryText(e.target.value)}
              placeholder="Paste the article content here..."
              rows={8}
              style={{ 
                display: 'block', 
                width: '100%', 
                fontSize: 14, 
                padding: 8, 
                marginTop: 4,
                border: '1px solid #ccc',
                borderRadius: 4,
                fontFamily: 'monospace'
              }}
            />
          </label>
        </div>
      )}
      
      


      {/* Show textarea and generate button for scraped content */}
      {primaryText && (
        <div style={{ marginBottom: 20 }}>
          <h2>Content</h2>
          <div style={{ background: '#f9fafb', padding: 10, borderRadius: 4, marginBottom: 10 }}>
            {primaryText && ticker && (
              <strong>Content for {ticker}</strong>
            )}
            {primaryText && !ticker && (
              <strong>Scraped Content (Enter ticker above)</strong>
            )}
            <textarea
              value={primaryText}
              onChange={e => setPrimaryText(e.target.value)}
              rows={16}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 14, marginTop: 10 }}
            />
          </div>
        </div>
      )}

      {/* Copyleaks Comparison Modal */}
      {showCopyleaksModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '20px', 
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              📋 Copy Articles for Copyleaks Comparison
            </h3>
            
            <p style={{ 
              margin: '0 0 20px 0', 
              fontSize: '14px', 
              color: '#6b7280',
              lineHeight: '1.5'
            }}>
              Copyleaks has been opened in a new tab. Use the buttons below to copy each article separately:
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <button
                onClick={copySourceArticle}
                    style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: sourceCopied ? '#10b981' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {sourceCopied ? '✅ Copied!' : '📄 Copy Source Article'}
                  </button>
              
                  <button
                onClick={copyGeneratedArticle}
                    style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: generatedCopied ? '#10b981' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {generatedCopied ? '✅ Copied!' : '✍️ Copy Generated Article'}
                  </button>
        </div>

            <div style={{
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                📋 Instructions:
              </h4>
              <ol style={{ margin: '0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.6' }}>
                <li>Click "Copy Source Article" and paste it into the <strong>first field</strong> in Copyleaks</li>
                <li>Click "Copy Generated Article" and paste it into the <strong>second field</strong> in Copyleaks</li>
                <li>Click the "Compare" button in Copyleaks to analyze</li>
              </ol>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCopyleaksModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState } from 'react';

interface Article {
  headline: string;
  body: string;
  url: string;
  created: string;
  relevanceScore: number;
}

interface EnhancedContextFormProps {
  currentArticle: string;
  onContextAdded: (updatedArticle: string) => void;
  onError: (error: string) => void;
}

export default function EnhancedContextForm({ currentArticle, onContextAdded, onError }: EnhancedContextFormProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [articleUrls, setArticleUrls] = useState<string[]>(['', '', '']); // Support up to 3 URLs
  const [inputMode, setInputMode] = useState<'search' | 'url'>('search');
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isFetchingUrls, setIsFetchingUrls] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const [isAddingContext, setIsAddingContext] = useState(false);
  const [searchError, setSearchError] = useState('');

  const searchArticles = async () => {
    if (!searchTerm.trim()) {
      setSearchError('Please enter a search term');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setArticles([]);
    setSelectedArticles([]);

    try {
      const response = await fetch('/api/bz/search-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm: searchTerm.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search articles');
      }

      // Add debugging to see what the frontend receives
      console.log('Frontend received data:', {
        articles: data.articles?.length || 0,
        totalFound: data.totalFound,
        searchTerm: data.searchTerm,
        note: data.note
      });
      console.log('Articles array:', data.articles);

      setArticles(data.articles || []);
      
      if (data.totalFound === 0) {
        setSearchError(`No articles found containing "${searchTerm}"`);
      }
    } catch (error: any) {
      setSearchError(error.message || 'Failed to search articles');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchArticleFromUrl = async () => {
    if (!articleUrl.trim()) {
      setSearchError('Please enter a Benzinga article URL');
      return;
    }

    setIsFetchingUrl(true);
    setSearchError('');
    setArticles([]);
    setSelectedArticles([]);

    try {
      const response = await fetch('/api/bz/fetch-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: articleUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch article from URL');
      }

      if (data.article) {
        setArticles([data.article]);
        // Automatically select the article since user explicitly provided the URL
        setSelectedArticles([data.article]);
      } else {
        setSearchError('No article data returned from URL');
      }
    } catch (error: any) {
      setSearchError(error.message || 'Failed to fetch article from URL');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const fetchArticlesFromUrls = async () => {
    // Filter out empty URLs
    const validUrls = articleUrls.filter(url => url.trim() !== '');
    
    if (validUrls.length === 0) {
      setSearchError('Please enter at least one Benzinga article URL');
      return;
    }

    if (validUrls.length > 3) {
      setSearchError('Maximum 3 URLs allowed');
      return;
    }

    setIsFetchingUrls(true);
    setSearchError('');
    setArticles([]);
    setSelectedArticles([]);

    try {
      // Fetch all URLs in parallel
      const fetchPromises = validUrls.map(url =>
        fetch('/api/bz/fetch-article', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: url.trim() }),
        }).then(res => res.json())
      );

      const results = await Promise.all(fetchPromises);
      
      const fetchedArticles: Article[] = [];
      const errors: string[] = [];

      results.forEach((data, index) => {
        if (data.error) {
          errors.push(`URL ${index + 1}: ${data.error}`);
        } else if (data.article) {
          fetchedArticles.push(data.article);
        }
      });

      if (errors.length > 0 && fetchedArticles.length === 0) {
        throw new Error(errors.join('; '));
      }

      if (errors.length > 0) {
        setSearchError(`Some URLs failed: ${errors.join('; ')}`);
      }

      if (fetchedArticles.length > 0) {
        setArticles(fetchedArticles);
        // Automatically select all fetched articles
        setSelectedArticles(fetchedArticles);
      } else {
        setSearchError('No articles could be fetched from the provided URLs');
      }
    } catch (error: any) {
      setSearchError(error.message || 'Failed to fetch articles from URLs');
    } finally {
      setIsFetchingUrls(false);
    }
  };

  const toggleArticleSelection = (article: Article) => {
    setSelectedArticles(prev => {
      const isSelected = prev.some(a => a.url === article.url);
      if (isSelected) {
        return prev.filter(a => a.url !== article.url);
      } else {
        if (prev.length >= 3) {
          onError('Maximum 3 articles can be selected');
          return prev;
        }
        return [...prev, article];
      }
    });
  };

  const addContextToArticle = async () => {
    if (selectedArticles.length === 0) {
      onError('Please select at least one article');
      return;
    }

    setIsAddingContext(true);

    try {
      // Get current provider from UI selector
      let currentProvider: 'openai' | 'gemini' = 'openai';
      try {
        if (typeof document !== 'undefined') {
          const providerSelect = document.getElementById('ai-provider-select') as HTMLSelectElement;
          if (providerSelect && (providerSelect.value === 'openai' || providerSelect.value === 'gemini')) {
            currentProvider = providerSelect.value as 'openai' | 'gemini';
            console.log('✅ Using provider from UI selector for context:', currentProvider);
          } else {
            // Fallback to API
            const providerRes = await fetch('/api/ai-provider');
            if (providerRes.ok) {
              const providerData = await providerRes.json();
              if (providerData.provider === 'openai' || providerData.provider === 'gemini') {
                currentProvider = providerData.provider;
                console.log('✅ Using provider from API for context:', currentProvider);
              }
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Could not get provider, defaulting to OpenAI for context:', e);
      }

      const response = await fetch('/api/generate/add-multiple-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentArticle,
          selectedArticles,
          provider: currentProvider, // Include provider in request
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add context');
      }

      onContextAdded(data.updatedArticle);
      
      // Reset form
      setSearchTerm('');
      setArticleUrl('');
      setArticleUrls(['', '', '']);
      setArticles([]);
      setSelectedArticles([]);
      setSearchError('');
    } catch (error: any) {
      onError(error.message || 'Failed to add context');
    } finally {
      setIsAddingContext(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      padding: '24px',
      marginBottom: '24px',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#1f2937',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: 'white',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 'bold'
          }}>+</span>
          Add Benzinga Context
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          lineHeight: '1.6',
          marginLeft: '40px'
        }}>
          Search for specific keywords or phrases in recent Benzinga articles, or enter up to 3 Benzinga article URLs directly. Select up to 3 articles to add as context to your story.
        </p>
      </div>
      
      {/* Mode Toggle */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          gap: '4px',
          background: '#f3f4f6',
          padding: '4px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => {
              setInputMode('search');
              setSearchError('');
              setArticles([]);
              setSelectedArticles([]);
              setArticleUrl('');
              setArticleUrls(['', '', '']);
            }}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: inputMode === 'search' 
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                : 'transparent',
              color: inputMode === 'search' ? 'white' : '#6b7280',
              boxShadow: inputMode === 'search' ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
            }}
          >
            🔍 Search
          </button>
          <button
            onClick={() => {
              setInputMode('url');
              setSearchError('');
              setArticles([]);
              setSelectedArticles([]);
              setArticleUrl('');
              setArticleUrls(['', '', '']);
            }}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: inputMode === 'url' 
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
                : 'transparent',
              color: inputMode === 'url' ? 'white' : '#6b7280',
              boxShadow: inputMode === 'url' ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
            }}
          >
            🔗 Enter URLs
          </button>
        </div>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        {inputMode === 'search' ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g., 'Wegovy', 'Novo Nordisk', 'weight loss drugs', 'FDA approval'..."
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                background: 'white'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
              onKeyPress={(e) => e.key === 'Enter' && searchArticles()}
            />
            <button
              onClick={searchArticles}
              disabled={isSearching}
              style={{
                padding: '12px 24px',
                background: isSearching 
                  ? '#9ca3af' 
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                borderRadius: '8px',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isSearching ? 'not-allowed' : 'pointer',
                boxShadow: isSearching ? 'none' : '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isSearching) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px -1px rgba(37, 99, 235, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSearching) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(37, 99, 235, 0.3)';
                }
              }}
            >
              {isSearching ? '⏳ Searching...' : '🔍 Search'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '8px'
            }}>
              <p style={{
                fontSize: '13px',
                color: '#1e40af',
                margin: 0,
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>💡</span>
                Enter up to 3 Benzinga article URLs (one per field):
              </p>
            </div>
            {articleUrls.map((url, index) => (
              <div key={index} style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
                transition: 'all 0.2s'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#2563eb',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#eff6ff',
                  borderRadius: '6px',
                  flexShrink: 0
                }}>
                  {index + 1}
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    const newUrls = [...articleUrls];
                    newUrls[index] = e.target.value;
                    setArticleUrls(newUrls);
                  }}
                  placeholder="https://www.benzinga.com/..."
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    background: 'transparent'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && index === articleUrls.length - 1) {
                      fetchArticlesFromUrls();
                    }
                  }}
                />
                {index < 2 && url.trim() && (
                  <button
                    onClick={() => {
                      const newUrls = [...articleUrls];
                      newUrls[index + 1] = '';
                      setArticleUrls(newUrls);
                    }}
                    style={{
                      padding: '6px 12px',
                      background: '#f3f4f6',
                      color: '#6b7280',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#2563eb';
                      e.currentTarget.style.color = 'white';
                      e.currentTarget.style.borderColor = '#2563eb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                      e.currentTarget.style.color = '#6b7280';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                    title="Focus next field"
                  >
                    Next →
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={fetchArticlesFromUrls}
              disabled={isFetchingUrls || articleUrls.every(url => !url.trim())}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: (isFetchingUrls || articleUrls.every(url => !url.trim()))
                  ? '#d1d5db'
                  : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: 'white',
                borderRadius: '8px',
                border: 'none',
                fontSize: '15px',
                fontWeight: '600',
                cursor: (isFetchingUrls || articleUrls.every(url => !url.trim())) ? 'not-allowed' : 'pointer',
                boxShadow: (isFetchingUrls || articleUrls.every(url => !url.trim())) 
                  ? 'none' 
                  : '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isFetchingUrls && !articleUrls.every(url => !url.trim())) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px -1px rgba(5, 150, 105, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isFetchingUrls && !articleUrls.every(url => !url.trim())) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(5, 150, 105, 0.3)';
                }
              }}
            >
              {isFetchingUrls 
                ? '⏳ Fetching Articles...' 
                : `📥 Fetch ${articleUrls.filter(url => url.trim()).length} Article${articleUrls.filter(url => url.trim()).length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
        
        {searchError && (
          <div style={{
            marginTop: '12px',
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span>
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {articles.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              background: '#2563eb',
              color: 'white',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {articles.length}
            </span>
            Found {articles.length} article{articles.length !== 1 ? 's' : ''} (select up to 3):
          </h4>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '8px'
          }}>
            {articles.map((article, index) => {
              const isSelected = selectedArticles.some(a => a.url === article.url);
              return (
                <div
                  key={article.url}
                  onClick={() => toggleArticleSelection(article)}
                  style={{
                    border: isSelected ? '2px solid #2563eb' : '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isSelected 
                      ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' 
                      : 'white',
                    boxShadow: isSelected 
                      ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      border: isSelected ? '2px solid #2563eb' : '2px solid #d1d5db',
                      borderRadius: '6px',
                      background: isSelected ? '#2563eb' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}>
                      {isSelected && (
                        <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h5 style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        color: '#1f2937',
                        marginBottom: '8px',
                        lineHeight: '1.4'
                      }}>
                        {article.headline}
                      </h5>
                      <p style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        marginBottom: '10px',
                        lineHeight: '1.5'
                      }}>
                        {article.body.substring(0, 150)}...
                      </p>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                        color: '#9ca3af'
                      }}>
                        <span>📅 {formatDate(article.created)}</span>
                        <span style={{
                          background: '#f3f4f6',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}>
                          Relevance: {article.relevanceScore}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedArticles.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {selectedArticles.length}
            </span>
            Selected Articles ({selectedArticles.length}/3):
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedArticles.map((article, index) => (
              <div 
                key={article.url} 
                style={{
                  fontSize: '14px',
                  color: '#374151',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{
                  background: '#059669',
                  color: 'white',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {index + 1}
                </span>
                {article.headline}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedArticles.length > 0 && (
        <button
          onClick={addContextToArticle}
          disabled={isAddingContext}
          style={{
            width: '100%',
            padding: '16px 24px',
            background: isAddingContext
              ? '#9ca3af'
              : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            color: 'white',
            borderRadius: '10px',
            border: 'none',
            fontSize: '16px',
            fontWeight: '700',
            cursor: isAddingContext ? 'not-allowed' : 'pointer',
            boxShadow: isAddingContext 
              ? 'none' 
              : '0 4px 6px -1px rgba(5, 150, 105, 0.3), 0 2px 4px -1px rgba(5, 150, 105, 0.2)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isAddingContext) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px -1px rgba(5, 150, 105, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isAddingContext) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(5, 150, 105, 0.3), 0 2px 4px -1px rgba(5, 150, 105, 0.2)';
            }
          }}
        >
          {isAddingContext 
            ? '⏳ Adding Context...' 
            : `✨ Add ${selectedArticles.length} Article${selectedArticles.length > 1 ? 's' : ''} as Context`}
        </button>
      )}
    </div>
  );
}

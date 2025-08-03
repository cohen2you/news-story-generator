'use client';

import { useState } from 'react';

export default function TestTopicUrl() {
  const [phrase, setPhrase] = useState('CNBC\'s Jim Cramer');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testTopicUrl = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-topic-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phrase }),
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error testing topic URL:', error);
      setResult({ error: 'Failed to test topic URL' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Test Topic URL Generation</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Test Phrase:</label>
        <input
          type="text"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          placeholder="Enter phrase to test (e.g., 'CNBC's Jim Cramer')"
        />
      </div>
      
      <button
        onClick={testTopicUrl}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {loading ? 'Testing...' : 'Test Topic URL'}
      </button>
      
      {result && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Results:</h2>
          
          {result.error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {result.error}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded">
                <h3 className="font-semibold">Input:</h3>
                <p><strong>Phrase:</strong> {result.phrase}</p>
                <p><strong>Clean Topic:</strong> {result.cleanTopic}</p>
                <p><strong>Terms:</strong> {result.terms.join(', ')}</p>
              </div>
              
              <div className="bg-gray-100 p-4 rounded">
                <h3 className="font-semibold">API Results:</h3>
                <p><strong>Total Articles from API:</strong> {result.totalArticlesFromAPI}</p>
                <p><strong>Topic Relevant Articles:</strong> {result.topicRelevantArticles}</p>
                <p><strong>Company Articles:</strong> {result.companyArticles}</p>
                <p><strong>Found Company:</strong> {result.foundCompany || 'None'}</p>
                <p><strong>Final URL:</strong> <a href={result.finalUrl} target="_blank" className="text-blue-600 hover:underline">{result.finalUrl}</a></p>
              </div>
              
              {result.topScoredArticles && result.topScoredArticles.length > 0 && (
                <div className="bg-gray-100 p-4 rounded">
                  <h3 className="font-semibold">Top Scored Articles:</h3>
                  <div className="space-y-2">
                    {result.topScoredArticles.map((article: any, index: number) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-3">
                        <p><strong>Score:</strong> {article.score}</p>
                        <p><strong>Headline:</strong> {article.headline}</p>
                        <p><strong>URL:</strong> <a href={article.url} target="_blank" className="text-blue-600 hover:underline">{article.url}</a></p>
                        <p><strong>Matching Terms:</strong> {article.matchingTerms.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {result.allTopicArticles && result.allTopicArticles.length > 0 && (
                <div className="bg-gray-100 p-4 rounded">
                  <h3 className="font-semibold">All Topic Articles ({result.allTopicArticles.length}):</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {result.allTopicArticles.map((article: any, index: number) => (
                      <div key={index} className="border border-gray-300 p-2 rounded">
                        <p><strong>Headline:</strong> {article.headline}</p>
                        <p><strong>URL:</strong> <a href={article.url} target="_blank" className="text-blue-600 hover:underline">{article.url}</a></p>
                        <p><strong>Body:</strong> {article.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {result.allCompanyArticles && result.allCompanyArticles.length > 0 && (
                <div className="bg-gray-100 p-4 rounded">
                  <h3 className="font-semibold">All Company Articles ({result.allCompanyArticles.length}):</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {result.allCompanyArticles.map((article: any, index: number) => (
                      <div key={index} className="border border-gray-300 p-2 rounded">
                        <p><strong>Headline:</strong> {article.headline}</p>
                        <p><strong>URL:</strong> <a href={article.url} target="_blank" className="text-blue-600 hover:underline">{article.url}</a></p>
                        <p><strong>Body:</strong> {article.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 
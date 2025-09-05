import React, { useState } from 'react';
import SideBySideComparison from './SideBySideComparison';

interface CopyleaksResultsProps {
  sourceResult?: ScanResult;
  finalResult?: ScanResult;
  sourceText?: string;
  finalText?: string;
  onClose?: () => void;
}

interface ScanResult {
  scanId: string;
  status: string;
  aiDetected: boolean;
  aiProbability?: number;
  plagiarismResults: Array<{
    resultId: string;
    url: string;
    title: string;
    matchedWords: number;
    identicalWords: number;
    minorChangesWords: number;
    relatedMeaningWords: number;
    totalWords: number;
    similarityPercentage: number;
    matchedText?: string;
    sourceText?: string;
    detailedFetched?: boolean;
  }>;
  totalMatchedWords: number;
  totalWords: number;
  overallSimilarityPercentage: number;
  timestamp: string;
  hasDetailedText?: boolean;
  hasExportedData?: boolean;
}

export default function CopyleaksResults({ sourceResult, finalResult, sourceText, finalText, onClose }: CopyleaksResultsProps) {
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());

  // Component only displays results - no polling needed
  // Results are fetched externally and passed in when scan is complete

  const fetchResults = () => {
    // This function is called by the refresh button
    // The actual fetching is handled by the parent component
    window.location.reload();
  };

  const toggleMatchExpansion = (matchKey: string) => {
    const newExpanded = new Set(expandedMatches);
    if (newExpanded.has(matchKey)) {
      newExpanded.delete(matchKey);
    } else {
      newExpanded.add(matchKey);
    }
    setExpandedMatches(newExpanded);
  };

  const fetchExportedData = async (scanId: string, resultId: string) => {
    try {
      const response = await fetch(`/api/copyleaks/export-data?scanId=${scanId}&resultId=${resultId}`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error fetching exported data:', error);
    }
    return null;
  };

  const calculateSimilarityPercentage = (result: ScanResult) => {
    return result.overallSimilarityPercentage || 0;
  };

  const getSimilarityColor = (percentage: number) => {
    if (percentage < 10) return 'text-green-600';
    if (percentage < 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSimilarityLabel = (percentage: number) => {
    if (percentage < 10) return 'Low similarity';
    if (percentage < 30) return 'Moderate similarity';
    return 'High similarity';
  };

  // Component only displays results - no loading states needed

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Copyleaks Scan Results</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Article Results */}
        {sourceResult && (
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-3 text-blue-600">Source Article</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Status:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  sourceResult.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {sourceResult.status}
                </span>
              </div>
              
              {sourceResult.status === 'completed' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Similarity:</span>
                    <span className={`font-bold ${getSimilarityColor(calculateSimilarityPercentage(sourceResult))}`}>
                      {calculateSimilarityPercentage(sourceResult)}% - {getSimilarityLabel(calculateSimilarityPercentage(sourceResult))}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p>Total matched words: {sourceResult.totalMatchedWords}</p>
                    <p>Total words: {sourceResult.totalWords}</p>
                    <p>Plagiarism matches: {sourceResult.plagiarismResults.length}</p>
                  </div>

                  {sourceResult.aiDetected && (
                    <div className="bg-orange-100 border border-orange-200 rounded p-3">
                      <p className="text-orange-800 font-medium">
                        AI-generated content detected ({Math.round((sourceResult.aiProbability || 0) * 100)}% probability)
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Final Article Results */}
        {finalResult && (
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-3 text-green-600">Final Article</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Status:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  finalResult.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {finalResult.status}
                </span>
              </div>
              
              {finalResult.status === 'completed' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Similarity:</span>
                    <span className={`font-bold ${getSimilarityColor(calculateSimilarityPercentage(finalResult))}`}>
                      {calculateSimilarityPercentage(finalResult)}% - {getSimilarityLabel(calculateSimilarityPercentage(finalResult))}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p>Total matched words: {finalResult.totalMatchedWords}</p>
                    <p>Total words: {finalResult.totalWords}</p>
                    <p>Plagiarism matches: {finalResult.plagiarismResults.length}</p>
                  </div>

                  {finalResult.aiDetected && (
                    <div className="bg-orange-100 border border-orange-200 rounded p-3">
                      <p className="text-orange-800 font-medium">
                        AI-generated content detected ({Math.round((finalResult.aiProbability || 0) * 100)}% probability)
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Plagiarism Results */}
      {(sourceResult?.plagiarismResults?.length || finalResult?.plagiarismResults?.length) && (
        <div className="mt-6">
          <h3 className="font-semibold text-lg mb-3">Plagiarism Matches</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sourceResult?.plagiarismResults?.map((result, index) => {
              const matchKey = `source-${result.resultId}`;
              const isExpanded = expandedMatches.has(matchKey);
              return (
                <div key={`source-${index}`} className="border-l-4 border-blue-500 pl-3 py-2 bg-blue-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{result.title}</p>
                      <p className="text-xs text-gray-600">{result.url}</p>
                      <p className="text-xs text-gray-500">
                        {result.matchedWords} matched words ({result.identicalWords} identical) - {result.similarityPercentage}% similarity
                      </p>
                    </div>
                    {(result.detailedFetched || sourceResult?.hasExportedData) && (
                      <button
                        onClick={() => toggleMatchExpansion(matchKey)}
                        className="ml-2 text-blue-600 hover:text-blue-800 text-xs"
                      >
                        {isExpanded ? 'Hide Details' : 'Show Details'}
                      </button>
                    )}
                  </div>
                  
                  {isExpanded && result.matchedText && result.sourceText && (
                    <div className="mt-3 border-t border-blue-200 pt-3">
                      <h4 className="font-medium text-sm mb-2">Text Comparison:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="font-medium text-blue-700 mb-1">Your Article:</p>
                          <div className="bg-white p-2 rounded border max-h-32 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{result.matchedText}</p>
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-blue-700 mb-1">Source Article:</p>
                          <div className="bg-white p-2 rounded border max-h-32 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{result.sourceText}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {finalResult?.plagiarismResults?.map((result, index) => {
              const matchKey = `final-${result.resultId}`;
              const isExpanded = expandedMatches.has(matchKey);
              return (
                <div key={`final-${index}`} className="border-l-4 border-green-500 pl-3 py-2 bg-green-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{result.title}</p>
                      <p className="text-xs text-gray-600">{result.url}</p>
                      <p className="text-xs text-gray-500">
                        {result.matchedWords} matched words ({result.identicalWords} identical) - {result.similarityPercentage}% similarity
                      </p>
                    </div>
                    {(result.detailedFetched || finalResult?.hasExportedData) && (
                      <button
                        onClick={() => toggleMatchExpansion(matchKey)}
                        className="ml-2 text-green-600 hover:text-green-800 text-xs"
                      >
                        {isExpanded ? 'Hide Details' : 'Show Details'}
                      </button>
                    )}
                  </div>
                  
                  {isExpanded && result.matchedText && result.sourceText && (
                    <div className="mt-3 border-t border-green-200 pt-3">
                      <h4 className="font-medium text-sm mb-2">Text Comparison:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="font-medium text-green-700 mb-1">Your Article:</p>
                          <div className="bg-white p-2 rounded border max-h-32 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{result.matchedText}</p>
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-green-700 mb-1">Source Article:</p>
                          <div className="bg-white p-2 rounded border max-h-32 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{result.sourceText}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Side-by-Side Article Comparison */}
      {sourceText && finalText && (
        <div className="mt-8">
          <SideBySideComparison
            sourceText={sourceText}
            finalText={finalText}
            sourceTitle="Source Article"
            finalTitle="Final Article"
          />
        </div>
      )}

      <div className="mt-6 flex justify-between items-center text-sm text-gray-500">
        <span>Last updated: {new Date().toLocaleString()}</span>
        <button
          onClick={fetchResults}
          className="text-blue-600 hover:text-blue-800"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

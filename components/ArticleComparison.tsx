'use client';

import { useState } from 'react';

interface ArticleComparisonProps {
  sourceText: string;
  finalText: string;
  sourceTitle?: string;
  finalTitle?: string;
}

interface TextSegment {
  text: string;
  type: 'identical' | 'modified' | 'added' | 'removed';
}

export default function ArticleComparison({ 
  sourceText, 
  finalText, 
  sourceTitle = "Source Article", 
  finalTitle = "Final Article" 
}: ArticleComparisonProps) {
  const [showIdentical, setShowIdentical] = useState(true);
  const [showModified, setShowModified] = useState(true);
  const [showAdded, setShowAdded] = useState(true);
  const [showRemoved, setShowRemoved] = useState(true);

  // Clean text by removing HTML tags and normalizing whitespace
  const cleanText = (text: string): string => {
    return text
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  // Simple word-by-word comparison
  const createComparison = (source: string, final: string): TextSegment[] => {
    const cleanSource = cleanText(source);
    const cleanFinal = cleanText(final);
    
    const sourceWords = cleanSource.split(/(\s+)/);
    const finalWords = cleanFinal.split(/(\s+)/);
    const segments: TextSegment[] = [];
    
    let sourceIndex = 0;
    let finalIndex = 0;
    
    while (sourceIndex < sourceWords.length || finalIndex < finalWords.length) {
      // Check for exact match at current positions
      if (sourceIndex < sourceWords.length && 
          finalIndex < finalWords.length && 
          sourceWords[sourceIndex] === finalWords[finalIndex]) {
        // Identical word
        segments.push({
          text: sourceWords[sourceIndex],
          type: 'identical'
        });
        sourceIndex++;
        finalIndex++;
      } else {
        // Look ahead to find the next match
        let foundMatch = false;
        let bestSourceEnd = sourceIndex;
        let bestFinalEnd = finalIndex;
        let maxMatchLength = 0;
        
        // Search for matches within a reasonable window
        for (let s = sourceIndex; s < Math.min(sourceIndex + 10, sourceWords.length); s++) {
          for (let f = finalIndex; f < Math.min(finalIndex + 10, finalWords.length); f++) {
            if (sourceWords[s] === finalWords[f]) {
              // Found a match, check how long the sequence is
              let matchLength = 0;
              while (s + matchLength < sourceWords.length && 
                     f + matchLength < finalWords.length && 
                     sourceWords[s + matchLength] === finalWords[f + matchLength]) {
                matchLength++;
              }
              
              if (matchLength > maxMatchLength) {
                maxMatchLength = matchLength;
                bestSourceEnd = s;
                bestFinalEnd = f;
                foundMatch = true;
              }
            }
          }
        }
        
        if (foundMatch && maxMatchLength >= 2) {
          // Add removed text (source only)
          if (sourceIndex < bestSourceEnd) {
            const removedText = sourceWords.slice(sourceIndex, bestSourceEnd).join('');
            if (removedText.trim()) {
              segments.push({
                text: removedText,
                type: 'removed'
              });
            }
          }
          
          // Add added text (final only)
          if (finalIndex < bestFinalEnd) {
            const addedText = finalWords.slice(finalIndex, bestFinalEnd).join('');
            if (addedText.trim()) {
              segments.push({
                text: addedText,
                type: 'added'
              });
            }
          }
          
          // Add identical sequence
          for (let i = 0; i < maxMatchLength; i++) {
            segments.push({
              text: sourceWords[bestSourceEnd + i],
              type: 'identical'
            });
          }
          
          sourceIndex = bestSourceEnd + maxMatchLength;
          finalIndex = bestFinalEnd + maxMatchLength;
        } else {
          // No good match found, treat as separate changes
          if (sourceIndex < sourceWords.length) {
            segments.push({
              text: sourceWords[sourceIndex],
              type: 'removed'
            });
            sourceIndex++;
          }
          if (finalIndex < finalWords.length) {
            segments.push({
              text: finalWords[finalIndex],
              type: 'added'
            });
            finalIndex++;
          }
        }
      }
    }
    
    return segments;
  };

  const segments = createComparison(sourceText, finalText);

  const getSegmentStyle = (type: string) => {
    switch (type) {
      case 'identical':
        return 'bg-gray-50 text-gray-700 px-1 py-0.5 rounded';
      case 'modified':
        return 'bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded';
      case 'added':
        return 'bg-green-100 text-green-800 px-1 py-0.5 rounded';
      case 'removed':
        return 'bg-red-100 text-red-800 line-through px-1 py-0.5 rounded';
      default:
        return 'bg-gray-50 text-gray-700 px-1 py-0.5 rounded';
    }
  };

  const getSegmentIcon = (type: string) => {
    switch (type) {
      case 'identical':
        return '✓';
      case 'modified':
        return '~';
      case 'added':
        return '+';
      case 'removed':
        return '-';
      default:
        return '';
    }
  };

  const filteredSegments = segments.filter(segment => {
    switch (segment.type) {
      case 'identical':
        return showIdentical;
      case 'modified':
        return showModified;
      case 'added':
        return showAdded;
      case 'removed':
        return showRemoved;
      default:
        return true;
    }
  });

  const stats = {
    identical: segments.filter(s => s.type === 'identical').length,
    modified: segments.filter(s => s.type === 'modified').length,
    added: segments.filter(s => s.type === 'added').length,
    removed: segments.filter(s => s.type === 'removed').length,
  };

  const totalWords = segments.length;
  const identicalWords = stats.identical;
  const similarityPercentage = totalWords > 0 ? Math.round((identicalWords / totalWords) * 100) : 0;

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Article Comparison</h2>
        <div className="text-sm text-gray-600">
          <strong>Similarity: {similarityPercentage}%</strong> ({identicalWords} identical words out of {totalWords} total)
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showIdentical}
            onChange={(e) => setShowIdentical(e.target.checked)}
            className="mr-2"
          />
          <span className="text-gray-600">Identical ({stats.identical})</span>
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showModified}
            onChange={(e) => setShowModified(e.target.checked)}
            className="mr-2"
          />
          <span className="text-yellow-600">Modified ({stats.modified})</span>
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showAdded}
            onChange={(e) => setShowAdded(e.target.checked)}
            className="mr-2"
          />
          <span className="text-green-600">Added ({stats.added})</span>
        </label>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showRemoved}
            onChange={(e) => setShowRemoved(e.target.checked)}
            className="mr-2"
          />
          <span className="text-red-600">Removed ({stats.removed})</span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Article */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-blue-600">{sourceTitle}</h3>
          <div className="text-sm leading-relaxed max-h-96 overflow-y-auto">
            <div className="whitespace-pre-wrap">
              {cleanText(sourceText)}
            </div>
          </div>
        </div>

        {/* Final Article */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-green-600">{finalTitle}</h3>
          <div className="text-sm leading-relaxed max-h-96 overflow-y-auto">
            <div className="whitespace-pre-wrap">
              {cleanText(finalText)}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-gray-600">{stats.identical}</div>
          <div className="text-sm text-gray-500">Identical</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.modified}</div>
          <div className="text-sm text-yellow-500">Modified</div>
        </div>
        <div className="bg-green-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-green-600">{stats.added}</div>
          <div className="text-sm text-green-500">Added</div>
        </div>
        <div className="bg-red-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-red-600">{stats.removed}</div>
          <div className="text-sm text-red-500">Removed</div>
        </div>
      </div>
    </div>
  );
}

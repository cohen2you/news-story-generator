'use client';

import { useState, useEffect } from 'react';
import { AIProvider } from '@/lib/aiProvider'; // Import AIProvider type

export function AIProviderSelector() {
  const [provider, setProvider] = useState<AIProvider>('openai');
  const [available, setAvailable] = useState({ openai: false, gemini: false });

  useEffect(() => {
    fetch('/api/ai-provider')
      .then(res => {
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setProvider(data.provider || 'openai');
        setAvailable({ openai: data.hasOpenAI || false, gemini: data.hasGemini || false });
      })
      .catch(error => {
        console.error('Failed to fetch AI provider:', error);
        // Set defaults on error
        setProvider('openai');
        setAvailable({ openai: true, gemini: false });
      });
  }, []);

  const handleChange = async (newProvider: AIProvider) => {
    try {
      const res = await fetch('/api/ai-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider }),
      });
      const data = await res.json();
      if (data.success) {
        setProvider(newProvider);
      }
    } catch (error) {
      console.error('Failed to set provider:', error);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <label htmlFor="ai-provider-select" style={{ fontSize: 14, color: '#374151' }}>AI Provider:</label>
      <select
        id="ai-provider-select"
        value={provider}
        onChange={(e) => handleChange(e.target.value as AIProvider)}
        style={{
          padding: '4px 8px',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          fontSize: 14,
          backgroundColor: 'white',
          cursor: 'pointer'
        }}
      >
        {available.openai && <option value="openai">OpenAI (GPT-4)</option>}
        {available.gemini && <option value="gemini">Gemini (2.5 Flash)</option>}
        {!available.openai && !available.gemini && <option value="">No Providers Available</option>}
      </select>
    </div>
  );
}


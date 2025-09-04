interface CopyleaksAuthResponse {
  access_token: string;
  expires_in: number;
}

interface CopyleaksScanResponse {
  scanId: string;
  status: string;
}

interface CopyleaksWebhookData {
  scannedDocument?: {
    scanId: string;
    totalWords: number;
    totalExcluded: number;
    credits: number;
    expectedCredits: number;
    creationTime: string;
    metadata: {
      filename: string;
    };
    enabled: {
      plagiarismDetection: boolean;
      aiDetection: boolean;
      explainableAi: boolean;
      writingFeedback: boolean;
      pdfReport: boolean;
      cheatDetection: boolean;
      aiSourceMatch: boolean;
    };
    detectedLanguage: string;
  };
  results?: {
    score: {
      identicalWords: number;
      minorChangedWords: number;
      relatedMeaningWords: number;
      aggregatedScore: number;
    };
    internet: Array<{
      url: string;
      id: string;
      title: string;
      introduction: string;
      matchedWords: number;
      identicalWords: number;
      similarWords: number;
      paraphrasedWords: number;
      totalWords: number;
      metadata: {
        publishDate?: string;
        creationDate?: string;
        lastModificationDate?: string;
        author?: string;
        organization?: string;
        filename?: string;
        authors: string[];
      };
      tags: string[];
    }>;
    database: any[];
    batch: any[];
    repositories: any[];
  };
  notifications: {
    alerts: any[];
  };
  status: number;
  developerPayload: string;
}

interface CopyleaksScanResult {
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
  }>;
  totalMatchedWords: number;
  totalWords: number;
  overallSimilarityPercentage: number;
}

interface CopyleaksDetailedResult {
  resultId: string;
  scanId: string;
  url: string;
  title: string;
  matchedWords: number;
  identicalWords: number;
  minorChangesWords: number;
  relatedMeaningWords: number;
  totalWords: number;
  similarityPercentage: number;
  matchedText: string;
  sourceText: string;
}

class CopyleaksService {
  private apiKey: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const authBody = {
      email: process.env.COPYLEAKS_EMAIL || '',
      key: this.apiKey,
    };

    console.log('Copyleaks authentication request:', { email: authBody.email, keyLength: authBody.key.length });

    const response = await fetch('https://id.copyleaks.com/v3/account/login/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(authBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Copyleaks authentication error:', errorText);
      throw new Error(`Copyleaks authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: CopyleaksAuthResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer

    console.log('Copyleaks authentication successful, token expires in:', data.expires_in, 'seconds');
    return this.accessToken;
  }

  async submitScan(content: string, filename: string, scanId: string): Promise<CopyleaksScanResponse> {
    const token = await this.authenticate();
    const base64Content = Buffer.from(content).toString('base64');

    // Validate scan ID format (should be alphanumeric with hyphens)
    const validScanId = scanId.replace(/[^a-zA-Z0-9-]/g, '-');
    console.log('Original scan ID:', scanId);
    console.log('Validated scan ID:', validScanId);

    // Copyleaks requires webhooks even in sandbox mode
    // For local development, we need a public webhook URL since Copyleaks blocks internal IPs
    const isLocalDevelopment = process.env.NODE_ENV === 'development' && 
      (process.env.NEXT_PUBLIC_BASE_URL?.includes('localhost') || 
       process.env.NEXT_PUBLIC_BASE_URL?.includes('127.0.0.1'));

    // Use environment variable for webhook URL
    // For local development, you need to set COPYLEAKS_WEBHOOK_URL to a public URL (e.g., ngrok tunnel)
    const webhookUrl = process.env.COPYLEAKS_WEBHOOK_URL;
    
    if (!webhookUrl) {
      throw new Error('COPYLEAKS_WEBHOOK_URL environment variable is required. For local development, use ngrok or similar service to create a public tunnel to your local webhook endpoint.');
    }

    const requestBody = {
      base64: base64Content,
      filename: filename,
      properties: {
        webhooks: {
          status: webhookUrl,
        },
        sandbox: process.env.NODE_ENV === 'development',
      },
    };

    console.log('Using webhook URL:', webhookUrl);
    console.log('Copyleaks scan request body:', JSON.stringify(requestBody, null, 2));
    console.log('Copyleaks scan URL:', `https://api.copyleaks.com/v3/scans/submit/file/${validScanId}`);
    console.log('Content length:', content.length);
    console.log('Base64 length:', base64Content.length);

    const response = await fetch(`https://api.copyleaks.com/v3/scans/submit/file/${validScanId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Copyleaks API error response:', errorText);
      throw new Error(`Copyleaks scan submission failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Handle empty response body
    let responseData = null;
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 0) {
      responseData = await response.json();
      console.log('Copyleaks scan response:', responseData);
    } else {
      console.log('Copyleaks scan submitted successfully (empty response body)');
    }

    return {
      scanId: validScanId,
      status: 'submitted',
    };
  }

  async getDetailedResult(scanId: string, resultId: string): Promise<CopyleaksDetailedResult> {
    const token = await this.authenticate();

    const response = await fetch(`https://api.copyleaks.com/v3/scans/${scanId}/results/${resultId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get detailed result: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      resultId,
      scanId,
      url: data.url || '',
      title: data.title || '',
      matchedWords: data.matchedWords || 0,
      identicalWords: data.identicalWords || 0,
      minorChangesWords: data.minorChangesWords || 0,
      relatedMeaningWords: data.relatedMeaningWords || 0,
      totalWords: data.totalWords || 0,
      similarityPercentage: data.totalWords > 0 ? Math.round(((data.matchedWords || 0) / data.totalWords) * 100) : 0,
      matchedText: data.matchedText || '',
      sourceText: data.sourceText || '',
    };
  }

  async getScanStatus(scanId: string): Promise<any> {
    const token = await this.authenticate();

    const response = await fetch(`https://api.copyleaks.com/v3/scans/${scanId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get scan status: ${response.statusText}`);
    }

    return await response.json();
  }

  async exportResult(scanId: string, resultId: string, format: 'pdf' | 'html' | 'json' = 'json'): Promise<any> {
    const token = await this.authenticate();

    const response = await fetch(`https://api.copyleaks.com/v3/scans/${scanId}/results/${resultId}/export`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: format,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to export result: ${response.statusText}`);
    }

    return await response.json();
  }

  async requestExport(scanId: string, resultIds: string[]): Promise<any> {
    const token = await this.authenticate();
    const exportId = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const webhookUrl = process.env.COPYLEAKS_WEBHOOK_URL || 'https://news-story-generator.onrender.com';
    
    const requestBody = {
      results: resultIds.map(resultId => ({
        id: resultId,
        verb: "POST",
        headers: [
          ["Content-Type", "application/json"]
        ],
        endpoint: `${webhookUrl}/api/copyleaks/export/${scanId}/results/${resultId}`
      })),
      completionWebhook: `${webhookUrl}/api/copyleaks/export/${scanId}/completed`,
      maxRetries: 3
    };

    console.log('Requesting export for scanId:', scanId);
    console.log('Export request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`https://api.copyleaks.com/v3/downloads/${scanId}/export/${exportId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Export request response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Export request error response:', errorText);
      throw new Error(`Failed to request export: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Handle empty response body (204 No Content)
    let responseData = null;
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 0) {
      responseData = await response.json();
      console.log('Export request successful:', responseData);
    } else {
      console.log('Export request successful (empty response body)');
    }

    return {
      exportId,
      scanId,
      status: 'requested',
    };
  }

  async compareArticles(sourceArticle: string, finalArticle: string): Promise<{
    sourceScanId: string;
    finalScanId: string;
    status: string;
  }> {
    const sourceScanId = `source-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const finalScanId = `final-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Submit both scans
    await Promise.all([
      this.submitScan(sourceArticle, 'source.txt', sourceScanId),
      this.submitScan(finalArticle, 'final.txt', finalScanId),
    ]);

    return {
      sourceScanId,
      finalScanId,
      status: 'submitted',
    };
  }
}

export default CopyleaksService;
export type { CopyleaksScanResult, CopyleaksScanResponse, CopyleaksWebhookData, CopyleaksDetailedResult };

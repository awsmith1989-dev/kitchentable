const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        keyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 8) || null,
      }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { prompt } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing prompt' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing Anthropic API key' }),
      };
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `You are a warm, encouraging academic advisor speaking directly to a student. Your insights should:
- Celebrate strengths and progress
- Connect academic data to real interests and goals
- Be asset-based and never shame-focused
- Provide one actionable suggestion
- Stay brief (3-4 sentences)
- Avoid mentioning specific grades or numbers; instead speak about trends and strengths`,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate insight' }),
      };
    }

    const data = await response.json();
    const insight = typeof data.content?.[0]?.text === 'string'
      ? data.content[0].text.trim()
      : 'Unable to generate insight';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ insight }),
    };
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Failed to generate insight' }),
    };
  }
};

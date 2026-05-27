interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function generateLlmResponse(
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  // Detect if we are using Ollama (local model, no API key required)
  const isOllama =
    baseUrl.includes('localhost') ||
    baseUrl.includes('127.0.0.1') ||
    baseUrl.includes('ollama');

  if (!apiKey && !isOllama) {
    console.warn('LLM_API_KEY is not defined and LLM_BASE_URL is not an Ollama endpoint. Returning mock response.');
    return 'Hello! This is a mock response (LLM API key is not configured).';
  }

  // Format messages according to OpenAI Chat Completion spec (Ollama supports this too)
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((msg) => ({
      role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content,
    })),
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Only add Authorization header for non-Ollama providers
  if (apiKey && !isOllama) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    console.log(`Calling LLM at: ${url} with model: ${model}`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    return reply.trim();
  } catch (error) {
    console.error('Error generating LLM response:', error);
    throw error;
  }
}

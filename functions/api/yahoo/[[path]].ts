export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const yahooUrl = `https://query1.finance.yahoo.com${url.pathname.replace('/api/yahoo', '')}${url.search}`;

  const modifiedHeaders = new Headers(context.request.headers);
  
  // Yahoo hates these headers from browsers
  modifiedHeaders.delete('Origin');
  modifiedHeaders.delete('Referer');
  
  // Set a believable User-Agent
  modifiedHeaders.set(
    'User-Agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  try {
    const response = await fetch(yahooUrl, {
      method: context.request.method,
      headers: modifiedHeaders,
      body: context.request.method !== 'GET' && context.request.method !== 'HEAD' 
        ? await context.request.blob() 
        : null,
    });

    // Return the response back to our app
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to proxy to Yahoo' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

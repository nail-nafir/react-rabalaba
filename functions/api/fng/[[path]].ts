export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const fngUrl = `https://api.alternative.me${url.pathname.replace('/api/fng', '')}${url.search}`;

  try {
    const response = await fetch(fngUrl, {
      method: context.request.method,
      headers: context.request.headers,
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to proxy to Alternative.me' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

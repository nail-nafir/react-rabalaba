export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const binanceUrl = `https://fapi.binance.com${url.pathname.replace(
    "/api/binance",
    "",
  )}${url.search}`;

  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  );

  try {
    const response = await fetch(binanceUrl, { method: "GET", headers });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to proxy to Binance" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

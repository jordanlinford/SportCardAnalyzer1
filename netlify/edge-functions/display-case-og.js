export default async (request) => {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1] || 'display-case';

  const title = `Display Case – ${id.substr(0, 6)}`;
  const description = 'Check out this sports card display case on Sports Card Analyzer';
  const image = `${url.origin}/og-default.jpg`;

  const baseRoute = pathParts[1] || 'display-cases';

  const html = `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${url.href}" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${image}" />
  </head><body>
    <script>window.location.pathname='/${baseRoute}/${id}';</script>
  </body></html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html',
    },
  });
}; 
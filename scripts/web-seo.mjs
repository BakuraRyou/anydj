// Metadata is emitted as HTML so crawlers and link previews need no JavaScript.
export function siteURL(value = 'https://anydj.de/') {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw Error('ANYDJ_SITE_URL muss eine öffentliche HTTPS-Adresse ohne Zugangsdaten oder Parameter sein.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const indexablePages = ['index.html', 'downloads.html', 'dj.html', 'impressum.html', 'datenschutz.html'];
export function pageURL(name, base) { return new URL(name === 'index.html' ? './' : name, base).href; }
export function seoHTML(html, name, base) {
  const canonical = pageURL(name, base);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  if (!title || !description) throw Error(`SEO: Titel oder Beschreibung fehlt in ${name}`);
  const image = new URL('product-preview.webp', base).href;
  const graph = [
    {'@type': 'WebSite', '@id': new URL('#website', base).href, url: base.href, name: 'AnyDj', inLanguage: 'de'},
    {'@type': 'WebPage', '@id': canonical, url: canonical, name: title, description,
      inLanguage: 'de', isPartOf: {'@id': new URL('#website', base).href}}
  ];
  if (name === 'index.html') graph.push({
    '@type': 'SoftwareApplication', '@id': new URL('#software', base).href,
    name: 'AnyDj', url: base.href, applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Windows, Linux, Web browser', inLanguage: 'de',
    description: 'Mixe deine Musik auf zwei Decks, plane Übergänge und gestalte automatische Lichtshows mit 3D-Vorschau.',
    screenshot: image, featureList: ['Zwei DJ-Decks und Crossfader', 'Übergangsplanung', 'Automatische Lichtshows', '3D-Raumplanung', 'DMX-Ausgabe in der Desktop-App']
  });
  const tags = [
    `<link rel="canonical" href="${escape(canonical)}">`,
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    '<meta name="theme-color" content="#14181d">',
    '<link rel="icon" type="image/svg+xml" href="./animatus-small.svg">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="AnyDj">',
    '<meta property="og:locale" content="de_DE">',
    `<meta property="og:url" content="${escape(canonical)}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${escape(image)}">`,
    '<meta property="og:image:alt" content="AnyDj mit zwei DJ-Decks, Warteschlange und Lichtvorschau">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${escape(image)}">`,
    '<meta name="twitter:image:alt" content="AnyDj mit zwei DJ-Decks, Warteschlange und Lichtvorschau">',
    `<script type="application/ld+json">${JSON.stringify({'@context': 'https://schema.org', '@graph': graph}).replaceAll('<', '\\u003c')}</script>`
  ];
  return html.replace('</head>', tags.join('\n') + '\n</head>');
}
export function sitemap(base) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    indexablePages.map(name => `  <url><loc>${escape(pageURL(name, base))}</loc></url>`).join('\n') + '\n</urlset>\n';
}
export function robots(base) {
  // Auth callbacks remain crawlable so their noindex directive can be read.
  return `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', base).href}\n`;
}

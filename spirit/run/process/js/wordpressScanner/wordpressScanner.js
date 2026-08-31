const spirit = require('../../../js/kernel.js');

// Approximate, regex-based HTML-to-text — not a full parser, but WordPress's
// REST API already renders shortcodes into plain HTML, so stripping tags and
// decoding the common entities is enough fidelity for training-corpus text.
const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&apos;': "'",
  '&#8216;': '‘', '&lsquo;': '‘', '&#8217;': '’', '&rsquo;': '’',
  '&#8220;': '“', '&ldquo;': '“', '&#8221;': '”', '&rdquo;': '”',
  '&#8211;': '–', '&ndash;': '–', '&#8212;': '—', '&mdash;': '—',
  '&#8230;': '…', '&hellip;': '…', '&#8226;': '•',
  '&copy;': '©', '&reg;': '®', '&trade;': '™', '&nbsp;': ' ',
};

function decodeEntities(text) {
  return text.replace(/&(#?\w+;)/g, function (match) {
    return HTML_ENTITIES[match] !== undefined ? HTML_ENTITIES[match] : match;
  });
}

function htmlToPlainText(html) {
  if (!html) return '';
  let text = html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  text = decodeEntities(text);
  return text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
}

function filenameFromUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '_') + '.json';
}

async function fetchAllPages(baseUrl, endpoint) {
  const items = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = baseUrl + '/wp-json/wp/v2/' + endpoint + '?page=' + page + '&per_page=100';
    const response = await fetch(url);
    if (!response.ok) {
      if (page === 1) throw new Error(endpoint + ' request failed: ' + response.status);
      break; // past the last real page
    }
    if (page === 1) {
      const headerValue = response.headers.get('x-wp-totalpages');
      totalPages = headerValue ? (parseInt(headerValue, 10) || 1) : 1;
    }
    const batch = await response.json();
    items.push(...batch);
    page++;
  } while (page <= totalPages);

  return items;
}

async function fetchTaxonomyMap(baseUrl, endpoint) {
  const items = await fetchAllPages(baseUrl, endpoint);
  const map = {};
  items.forEach(function (item) { map[item.id] = item.name; });
  return map;
}

function buildRecord(item, tagMap, categoryMap, siteUrl, language) {
  return {
    text: htmlToPlainText(item.content.rendered),
    title: htmlToPlainText(item.title.rendered),
    datePublished: item.date,
    language: language,
    source: siteUrl,
    sourceType: 'wordpress',
    url: item.link,
    slug: item.slug,
    site: new URL(siteUrl).hostname,
    tags: (item.tags || []).map(function (id) { return tagMap[id]; }).filter(Boolean),
    categories: (item.categories || []).map(function (id) { return categoryMap[id]; }).filter(Boolean),
  };
}

async function main() {
  const args = JSON.parse(process.argv[2] || '{}');
  const siteUrl = (args.siteUrl || '').replace(/\/$/, '');
  const language = args.language || 'en';

  if (!siteUrl) throw new Error('siteUrl is required');

  await spirit.core.jobs.log('fetching category/tag names from ' + siteUrl);
  const [categoryMap, tagMap] = await Promise.all([
    fetchTaxonomyMap(siteUrl, 'categories'),
    fetchTaxonomyMap(siteUrl, 'tags'),
  ]);

  await spirit.core.jobs.log('fetching posts and pages from ' + siteUrl);
  const [posts, pages] = await Promise.all([
    fetchAllPages(siteUrl, 'posts'),
    fetchAllPages(siteUrl, 'pages'),
  ]);
  const allItems = posts.concat(pages);

  await spirit.core.jobs.log('found ' + allItems.length + ' item(s) (' + posts.length + ' posts, ' + pages.length + ' pages)');

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const percent = Math.round((i / allItems.length) * 100);

    await spirit.core.jobs.log(percent + '% done, processing ' + item.link);

    try {
      const record = buildRecord(item, tagMap, categoryMap, siteUrl, language);
      const filePath = 'published/' + filenameFromUrl(item.link);

      const result = spirit.core.fs.saveFile(filePath, JSON.stringify(record, null, 2));
      if (!result.ok) throw new Error('saveFile failed: ' + result.reason);

      processed++;
      await spirit.core.jobs.log('processed ' + processed + '/' + allItems.length + ': ' + item.link);
    } catch (err) {
      failed++;
      await spirit.core.jobs.log('FAILED on ' + item.link + ': ' + err.message);
    }
  }

  await spirit.core.jobs.log('Completed: ' + processed + ' processed, ' + failed + ' failed, ' + allItems.length + ' total');
  await spirit.core.jobs.complete({ total: allItems.length, processed: processed, failed: failed });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    spirit.core.jobs.fail(err).finally(() => process.exit(1));
  });

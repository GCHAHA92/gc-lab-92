import { getCollection } from 'astro:content';

const staticPaths = [
  '',
  'about/',
  'changelog/',
  'notes/',
  'tools/',
  'tools/travel/',
  'tools/lunch/',
  'tools/leave/',
  'tools/qr/',
  'tools/fingerprint/',
];

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET({ site }: { site: URL }) {
  const notes = await getCollection('notes', ({ data }) => !data.draft);
  const paths = [
    ...staticPaths,
    ...notes.map((note) => `notes/${note.id}/`),
  ];
  const urls = paths.map((path) => {
    const location = escapeXml(new URL(path, site).toString());
    return `  <url><loc>${location}</loc></url>`;
  });
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

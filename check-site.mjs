import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = dirname(fileURLToPath(import.meta.url));
const domain = 'https://perfectmode.app';
const pages = [
  ['index.html', 'de', `${domain}/`],
  ['privacy/index.html', 'de', `${domain}/privacy`],
  ['terms/index.html', 'de', `${domain}/terms`],
  ['support/index.html', 'de', `${domain}/support`],
  ['account-deletion/index.html', 'de', `${domain}/account-deletion`],
  ['imprint/index.html', 'de', `${domain}/imprint`],
  ['pl/index.html', 'pl', `${domain}/pl/`],
  ['pl/privacy/index.html', 'pl', `${domain}/pl/privacy`],
  ['pl/terms/index.html', 'pl', `${domain}/pl/terms`],
  ['pl/support/index.html', 'pl', `${domain}/pl/support`],
  ['pl/account-deletion/index.html', 'pl', `${domain}/pl/account-deletion`],
  ['pl/imprint/index.html', 'pl', `${domain}/pl/imprint`],
  ['en/index.html', 'en', `${domain}/en/`],
  ['en/privacy/index.html', 'en', `${domain}/en/privacy`],
  ['en/terms/index.html', 'en', `${domain}/en/terms`],
  ['en/support/index.html', 'en', `${domain}/en/support`],
  ['en/account-deletion/index.html', 'en', `${domain}/en/account-deletion`],
  ['en/imprint/index.html', 'en', `${domain}/en/imprint`],
];

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

function targetForWebPath(webPath) {
  const pathname = decodeURIComponent(webPath.split('#')[0].split('?')[0]);
  const normalizedPath = pathname.replace(/^\/+/, '');
  const target = normalizedPath === ''
    ? join(siteRoot, 'index.html')
    : pathname.endsWith('/')
      ? join(siteRoot, normalizedPath, 'index.html')
      : join(siteRoot, normalizedPath);
  const relativeTarget = relative(siteRoot, normalize(target));
  if (relativeTarget.startsWith('..')) return null;
  return target;
}

for (const [file, language, canonical] of pages) {
  const absolute = join(siteRoot, file);
  assert(existsSync(absolute), `${file}: file is missing`);
  if (!existsSync(absolute)) continue;

  const html = readFileSync(absolute, 'utf8');
  assert(html.startsWith('<!doctype html>'), `${file}: missing HTML5 doctype`);
  assert(html.includes(`<html lang="${language}">`), `${file}: wrong or missing lang attribute`);
  assert(/<title>[^<]+<\/title>/.test(html), `${file}: missing title`);
  assert(/<meta name="description" content="[^"]+">/.test(html), `${file}: missing description`);
  assert(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'), `${file}: missing viewport`);
  assert(html.includes(`<link rel="canonical" href="${canonical}">`), `${file}: canonical mismatch`);
  assert(html.includes('href="#main"'), `${file}: missing skip link`);
  assert(html.includes('<main id="main">'), `${file}: missing main landmark`);
  assert(html.includes('<footer class="site-footer">'), `${file}: missing footer`);
  assert(html.includes('PerfectMode'), `${file}: brand is missing`);
  assert(html.includes('Lukasz Urbaniak'), `${file}: provider is missing`);
  assert(html.includes('hreflang="de"') && html.includes('hreflang="pl"') && html.includes('hreflang="en"'), `${file}: incomplete language links`);
  assert(!/(?:example\.com|@example|\bTODO\b|coming soon|placeholder)/i.test(html), `${file}: forbidden placeholder text`);
  assert(!/<(?:script|iframe|img|form)\b/i.test(html), `${file}: script, embed, image or form found`);
  assert(!/url\(\s*["']?https?:/i.test(html), `${file}: external CSS asset found`);

  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)) {
    const href = match[1];
    if (href.startsWith('mailto:')) {
      assert(/^mailto:(?:support|privacy)@perfectmode\.app$/.test(href), `${file}: unexpected mail link ${href}`);
      continue;
    }
    if (href.startsWith('#')) {
      assert(ids.has(href.slice(1)), `${file}: missing fragment target ${href}`);
      continue;
    }
    assert(href.startsWith('/'), `${file}: external or relative anchor ${href}`);
    if (href.startsWith('/')) {
      const [pathPart, fragment] = href.split('#');
      const target = targetForWebPath(pathPart);
      assert(Boolean(target) && existsSync(target), `${file}: broken internal link ${href}`);
      if (target && fragment && existsSync(target)) {
        const targetHtml = readFileSync(target, 'utf8');
        assert(targetHtml.includes(`id="${fragment}"`), `${file}: broken target fragment ${href}`);
      }
    }
  }
}

for (const file of ['terms/index.html', 'pl/terms/index.html', 'en/terms/index.html']) {
  const html = readFileSync(join(siteRoot, file), 'utf8');
  assert(html.includes('<!-- LEGAL REVIEW REQUIRED BEFORE PRODUCTION -->'), `${file}: legal-review source marker is missing`);
}

const truthfulStatements = [
  ['privacy/index.html', ['noch nicht implementiert', 'werden nicht an OpenAI übertragen']],
  ['pl/privacy/index.html', ['nie została jeszcze wdrożona', 'nie są przesyłane do OpenAI']],
  ['en/privacy/index.html', ['has not yet been implemented', 'are not sent to OpenAI']],
  ['account-deletion/index.html', ['nicht automatisch entfernt', 'nicht zusätzlich widerrufen']],
  ['pl/account-deletion/index.html', ['nie są automatycznie usuwane', 'nie cofa dodatkowo']],
  ['en/account-deletion/index.html', ['not removed automatically', 'does not additionally revoke']],
];
for (const [file, statements] of truthfulStatements) {
  const html = readFileSync(join(siteRoot, file), 'utf8');
  for (const statement of statements) {
    assert(html.includes(statement), `${file}: required current-state disclosure missing: ${statement}`);
  }
}

for (const file of ['styles.css', 'robots.txt', 'sitemap.xml']) {
  assert(existsSync(join(siteRoot, file)), `${file}: required site asset is missing`);
}

const sitemap = readFileSync(join(siteRoot, 'sitemap.xml'), 'utf8');
for (const [, , canonical] of pages) {
  assert(sitemap.includes(`<loc>${canonical}</loc>`), `sitemap.xml: missing ${canonical}`);
}

if (failures.length > 0) {
  console.error(`Legal site validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Legal site validation passed: ${pages.length} HTML pages, all internal links, metadata, language links and required disclosures verified.`);
  console.log('No scripts, embeds, forms, external assets or placeholder content detected.');
}

export const TITLE_MAX = 65;
export const TITLE_MIN = 25;
export const DESCRIPTION_MIN = 70;
export const DESCRIPTION_MAX = 165;
export const THIN_WORDS = 600;
export const AI_REFERRERS = [
    ["chatgpt.com", "ChatGPT"], ["chat.openai.com", "ChatGPT"], ["openai.com", "ChatGPT"],
    ["perplexity.ai", "Perplexity"], ["copilot.microsoft.com", "Copilot"], ["gemini.google.com", "Gemini"],
    ["bard.google.com", "Gemini"], ["claude.ai", "Claude"], ["chat.deepseek.com", "DeepSeek"], ["you.com", "You.com"],
    ["meta.ai", "Meta AI"], ["grok.com", "Grok"], ["phind.com", "Phind"],
];
export const bareHost = (value) => {
    try {
        const host = /^[a-z]+:\/\//i.test(String(value)) ? new URL(value).hostname : String(value || "");
        return host.toLowerCase().replace(/^www\./, "");
    }
    catch {
        return "";
    }
};
export const sameSite = (a, b) => Boolean(bareHost(a)) && bareHost(a) === bareHost(b);
export function aiReferrals(referrers = []) {
    const rows = [];
    for (const row of referrers) {
        const host = bareHost(row.value || "");
        const match = AI_REFERRERS.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
        if (match)
            rows.push({ assistant: match[1], host, pageviews: Number(row.pageviews || 0), visitors: Number(row.visitors || 0) });
    }
    const byAssistant = {};
    for (const row of rows)
        byAssistant[row.assistant] = (byAssistant[row.assistant] || 0) + row.pageviews;
    return { total_pageviews: rows.reduce((sum, row) => sum + row.pageviews, 0), by_assistant: byAssistant, rows };
}
const decode = (text) => String(text || "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
const textOf = (html) => decode(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
function metaContent(html, key) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const pattern of [
        new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["']`, "i"),
    ]) {
        const match = String(html || "").match(pattern);
        if (match)
            return decode(match[1]).trim();
    }
    return "";
}
function linkHref(html, rel) {
    for (const pattern of [
        new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*href=["']([^"']*)["']`, "i"),
        new RegExp(`<link[^>]+href=["']([^"']*)["'][^>]*rel=["']${rel}["']`, "i"),
    ]) {
        const match = String(html || "").match(pattern);
        if (match)
            return match[1].trim();
    }
    return "";
}
export function jsonLdNodes(html) {
    const nodes = [];
    let invalid = 0;
    const walk = (value) => {
        if (Array.isArray(value))
            return value.forEach(walk);
        if (!value || typeof value !== "object")
            return;
        nodes.push(value);
        if (Array.isArray(value["@graph"]))
            value["@graph"].forEach(walk);
    };
    for (const match of String(html || "").matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            walk(JSON.parse(match[1]));
        }
        catch {
            invalid += 1;
        }
    }
    return { nodes, invalid };
}
const typesOf = (node) => [].concat(node?.["@type"] || []).map(String);
const authorName = (author) => {
    const first = [].concat(author || [])[0];
    return typeof first === "string" ? first : String(first?.name || "");
};
export const GENERIC_AUTHOR = /\b(agente|agent|bot|ia|ai|admin|redacci[oó]n|test)\b/i;
const TEST_SLUG = /(^|[-/])(prueba|draft|borrador|lorem|ipsum)([-/]|$)|-\d{10,}$/i;
const MANGLED_SLUG = /(^|-)[b-df-np-tv-xz](-|$)/i;
const PLACEHOLDER_SEGMENT = /^(url|undefined|null|slug|nan|\[slug\]|:slug)$/i;
export function pageKind(url, allUrls = []) {
    let pathname = "";
    try {
        pathname = new URL(url).pathname.replace(/\/$/, "");
    }
    catch {
        return "page";
    }
    const lower = pathname.toLowerCase();
    const segments = lower.split("/").filter(Boolean);
    if (segments.some((segment) => /^(legal|terms|privacy|privacidad|terminos|cookies|aviso-legal)$/.test(segment)))
        return "legal";
    if (segments.some((segment) => /^(categoria|category|tag|tags|etiqueta)$/.test(segment)))
        return "hub";
    if (lower && allUrls.some((other) => other !== url && sameSite(other, url) && (() => { try {
        return new URL(other).pathname.toLowerCase().startsWith(`${lower}/`);
    }
    catch {
        return false;
    } })()))
        return "hub";
    if (segments.some((segment) => /^(herramientas|guia|guias|tools)$/.test(segment)))
        return "tool";
    const blogAt = segments.findIndex((segment) => /^(blog|relatos|articulos?|posts?)$/.test(segment));
    if (blogAt >= 0 && blogAt < segments.length - 1)
        return segments[blogAt] === "relatos" ? "story" : "article";
    return "page";
}
export function auditArticleHtml(html, url, { defaultImages = [], kind = "article" } = {}) {
    const raw = String(html || "");
    const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? textOf(titleMatch[1]) : "";
    const description = metaContent(raw, "description");
    const canonical = linkHref(raw, "canonical");
    const ogImage = metaContent(raw, "og:image");
    const robots = metaContent(raw, "robots");
    const h1 = (raw.match(/<h1[\s>]/gi) || []).length;
    const h2 = (raw.match(/<h2[\s>]/gi) || []).length;
    const bodyMatch = raw.match(/<article[\s\S]*?<\/article>/i) || raw.match(/<main[\s\S]*?<\/main>/i);
    const words = textOf(bodyMatch ? bodyMatch[0] : raw).split(" ").filter((word) => /\p{L}/u.test(word)).length;
    const { nodes, invalid } = jsonLdNodes(raw);
    const types = [...new Set(nodes.flatMap(typesOf))];
    const article = nodes.find((node) => typesOf(node).some((type) => /^(Article|BlogPosting|NewsArticle|TechArticle)$/.test(type))) || null;
    const metaAuthor = metaContent(raw, "author");
    const author = authorName(article?.author) || metaAuthor;
    const published = article?.datePublished || metaContent(raw, "article:published_time");
    const modified = article?.dateModified || metaContent(raw, "article:modified_time");
    const questions = (raw.match(/<h[23][^>]*>[^<]*\?\s*<\/h[23]>/gi) || []).length;
    const issues = [];
    const add = (id, detail) => issues.push({ id, detail });
    if (!title)
        add("title_missing", "sin <title>");
    else if (title.length > TITLE_MAX)
        add("title_long", `title de ${title.length} caracteres (Google corta ~60)`);
    else if (title.length < TITLE_MIN)
        add("title_short", `title de ${title.length} caracteres`);
    if (!description)
        add("description_missing", "sin meta description");
    else if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX)
        add("description_length", `meta description de ${description.length} caracteres`);
    const canonicalAbs = canonical && url ? (() => { try {
        return new URL(canonical, url).toString();
    }
    catch {
        return canonical;
    } })() : canonical;
    const trim = (value) => String(value).replace(/\/$/, "");
    if (!canonical)
        add("canonical_missing", "sin canonical");
    else if (url && !sameSite(canonicalAbs, url))
        add("canonical_other_site", `canonical a otro dominio: ${canonical}`);
    else if (url && trim(new URL(canonicalAbs).pathname) !== trim(new URL(url).pathname))
        add("canonical_other_path", `canonical apunta a ${canonical}`);
    if (h1 !== 1)
        add("h1_count", `${h1} H1`);
    if (/noindex/i.test(robots))
        add("noindex", "meta robots noindex");
    if (invalid)
        add("schema_invalid", `${invalid} bloque(s) JSON-LD invalidos`);
    if (!ogImage)
        add("og_image_missing", "sin og:image");
    else if (defaultImages.some((image) => image && ogImage.includes(image)))
        add("og_image_default", "og:image generica del sitio");
    if (TEST_SLUG.test(new URL(url || "https://x/").pathname) || /\(test\)/i.test(author))
        add("test_content", "parece contenido de prueba publicado");
    if (kind === "tool" && !types.some((type) => /^(WebApplication|SoftwareApplication|HowTo)$/.test(type)))
        add("schema_tool_missing", "herramienta sin schema WebApplication/HowTo");
    if (kind === "tool" && words < 300)
        add("tool_thin", `${words} palabras explicando la herramienta`);
    if (kind === "story" && !article && !types.includes("CreativeWork") && !types.includes("ShortStory"))
        add("schema_story_missing", "relato sin schema CreativeWork/Article");
    if (kind === "article") {
        if (!article)
            add("schema_article_missing", "sin schema Article/BlogPosting");
        if (!types.includes("BreadcrumbList"))
            add("schema_breadcrumb_missing", "sin BreadcrumbList");
        if (!types.includes("FAQPage") && questions >= 2)
            add("schema_faq_missing", `${questions} subtitulos-pregunta sin FAQPage`);
        if (!author)
            add("author_missing", "sin autor");
        else if (GENERIC_AUTHOR.test(author) || /an[oó]nimo/i.test(author))
            add("author_generic", `autor "${author}" (no es una persona: pesa poco en E-E-A-T y en LLMs)`);
        if (article && !article.image)
            add("schema_image_missing", "Article sin image");
        if (published && modified && Date.parse(modified) < Date.parse(published))
            add("dates_inverted", "dateModified anterior a datePublished");
        if (!published)
            add("date_missing", "sin fecha de publicacion");
        if (words < THIN_WORDS)
            add("thin_content", `${words} palabras`);
        if (h2 < 3 && words >= THIN_WORDS)
            add("few_sections", `${h2} H2`);
    }
    return {
        url, kind, title, title_length: title.length, description_length: description.length, canonical, author, published, modified,
        words, h1, h2, questions, schema_types: types, og_image: ogImage, issues,
    };
}
export function sitemapHealth(urls = [], statuses = new Map()) {
    const placeholders = [];
    const testUrls = [];
    const broken = [];
    const mangled = [];
    const bySlug = new Map();
    for (const url of urls) {
        let pathname = "";
        try {
            pathname = new URL(url).pathname;
        }
        catch {
            placeholders.push(url);
            continue;
        }
        const segments = pathname.split("/").filter(Boolean);
        if (segments.some((segment) => PLACEHOLDER_SEGMENT.test(segment)))
            placeholders.push(url);
        else if (TEST_SLUG.test(pathname))
            testUrls.push(url);
        if (MANGLED_SLUG.test(segments.at(-1) || ""))
            mangled.push(url);
        const status = statuses.get(url);
        if (status !== undefined && status !== 200)
            broken.push({ url, status });
        const last = segments.at(-1) || "";
        const key = last.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
        if (key.length > 12)
            bySlug.set(key, [...(bySlug.get(key) || []), url]);
    }
    const duplicates = [...bySlug.values()].filter((list) => list.length > 1);
    return { total: urls.length, placeholders, test_urls: testUrls, mangled_slugs: mangled, broken, duplicate_slugs: duplicates };
}
export function llmsCoverage(llmsText, articleUrls = []) {
    const text = String(llmsText || "");
    const listed = articleUrls.filter((url) => {
        try {
            return text.includes(new URL(url).pathname.replace(/\/$/, ""));
        }
        catch {
            return false;
        }
    });
    return { present: Boolean(text.trim()), bytes: text.length, articles: articleUrls.length, listed: listed.length, missing: articleUrls.filter((url) => !listed.includes(url)) };
}
export function summarizeArticleAudits(audits = [], health = null, llms = null) {
    const articles = audits.filter((audit) => (audit.kind || "article") === "article");
    const n = articles.length;
    const counts = {};
    for (const audit of audits)
        for (const issue of audit.issues)
            counts[issue.id] = (counts[issue.id] || 0) + 1;
    const byTitle = new Map();
    for (const audit of audits)
        if (audit.title)
            byTitle.set(audit.title.toLowerCase(), [...(byTitle.get(audit.title.toLowerCase()) || []), audit.url]);
    const duplicateTitles = [...byTitle.values()].filter((list) => list.length > 1);
    const authors = {};
    for (const audit of articles)
        if (audit.author)
            authors[audit.author] = (authors[audit.author] || 0) + 1;
    const alerts = [];
    const pct = (id) => (n ? Math.round(((counts[id] || 0) / n) * 100) : 0);
    if (health?.broken?.length)
        alerts.push(`Sitemap con ${health.broken.length} URL(s) que no responden 200 (ej. ${health.broken[0].url} -> ${health.broken[0].status})`);
    if (health?.placeholders?.length)
        alerts.push(`Sitemap con URL(s) placeholder publicadas: ${health.placeholders.slice(0, 3).join(", ")}`);
    if (health?.test_urls?.length)
        alerts.push(`Contenido de prueba publicado: ${health.test_urls.slice(0, 3).join(", ")}`);
    if (health?.mangled_slugs?.length)
        alerts.push(`${health.mangled_slugs.length} URL(s) con la tilde convertida en guion (ej. ${health.mangled_slugs[0]}); suelen ser copias de otro articulo`);
    if (health?.duplicate_slugs?.length)
        alerts.push(`Slugs casi duplicados: ${health.duplicate_slugs.map((list) => list.join(" = ")).slice(0, 2).join(" ; ")}`);
    if (counts.test_content)
        alerts.push(`${counts.test_content} articulo(s) parecen de prueba (slug o autor "Test")`);
    if (counts.author_generic)
        alerts.push(`${pct("author_generic")}% de los articulos firmados por un autor generico (${Object.keys(authors).filter((name) => GENERIC_AUTHOR.test(name) || /an[oó]nimo/i.test(name)).join(", ")})`);
    if (counts.title_long)
        alerts.push(`${counts.title_long} de ${audits.length} paginas con title de mas de ${TITLE_MAX} caracteres`);
    if (counts.description_missing || counts.description_length)
        alerts.push(`${(counts.description_missing || 0) + (counts.description_length || 0)} meta description(s) ausentes o fuera de ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} caracteres`);
    if (counts.schema_article_missing)
        alerts.push(`${counts.schema_article_missing} articulo(s) sin schema Article/BlogPosting`);
    if (counts.schema_breadcrumb_missing)
        alerts.push(`${pct("schema_breadcrumb_missing")}% sin BreadcrumbList`);
    if (n && !articles.some((audit) => audit.schema_types.includes("FAQPage")))
        alerts.push("Ningun articulo tiene FAQPage (preguntas y respuestas que buscadores y LLMs citan)");
    if (counts.dates_inverted)
        alerts.push(`${counts.dates_inverted} articulo(s) con dateModified anterior a datePublished`);
    if (counts.og_image_default || counts.og_image_missing)
        alerts.push(`${(counts.og_image_default || 0) + (counts.og_image_missing || 0)} pagina(s) con imagen social generica o ausente`);
    if (counts.schema_tool_missing)
        alerts.push(`${counts.schema_tool_missing} herramienta(s) sin schema WebApplication/HowTo`);
    if (counts.tool_thin)
        alerts.push(`${counts.tool_thin} herramienta(s) con menos de 300 palabras de explicacion (poco para posicionar)`);
    if (counts.thin_content)
        alerts.push(`${counts.thin_content} articulo(s) delgados (< ${THIN_WORDS} palabras)`);
    if (counts.canonical_missing)
        alerts.push(`${counts.canonical_missing} pagina(s) sin canonical`);
    if (counts.h1_count)
        alerts.push(`${counts.h1_count} pagina(s) sin H1 unico`);
    if (counts.canonical_other_site || counts.canonical_other_path)
        alerts.push(`${(counts.canonical_other_site || 0) + (counts.canonical_other_path || 0)} canonical(es) apuntan a otra URL (esas paginas no se indexan)`);
    if (counts.noindex)
        alerts.push(`${counts.noindex} articulo(s) con noindex`);
    if (duplicateTitles.length)
        alerts.push(`${duplicateTitles.length} title(s) repetidos en ${duplicateTitles.reduce((sum, list) => sum + list.length, 0)} URLs: copias del mismo articulo o paginas con title generico (se canibalizan en Google)`);
    if (llms && !llms.present)
        alerts.push("Sin llms.txt");
    else if (llms && llms.articles && llms.listed / llms.articles < 0.5)
        alerts.push(`llms.txt solo lista ${llms.listed} de ${llms.articles} articulos`);
    const kinds = {};
    for (const audit of audits)
        kinds[audit.kind || "article"] = (kinds[audit.kind || "article"] || 0) + 1;
    return { pages: audits.length, articles: n, kinds, issue_counts: counts, authors, duplicate_titles: duplicateTitles, alerts };
}
async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            out[index] = await fn(items[index], index);
        }
    }));
    return out;
}
export async function runSiteAudit({ url, fetchImpl = fetch, limit = 150, concurrency = 6, timeoutMs = 15000, defaultImages = [], ignore = null }) {
    const get = async (target) => {
        try {
            const response = await fetchImpl(target, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "SocioPageReview/1.0 (+site audit)" }, redirect: "follow" });
            return { status: response.status, finalUrl: response.url || target, text: await response.text() };
        }
        catch (error) {
            return { status: 0, finalUrl: target, text: "", error: error instanceof Error ? error.message : String(error) };
        }
    };
    const origin = new URL(url).origin;
    const sitemap = await get(new URL("/sitemap.xml", origin).toString());
    if (sitemap.status !== 200)
        return { ok: false, site: origin, error: `sitemap HTTP ${sitemap.status || sitemap.error}` };
    const urls = [...sitemap.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => decode(match[1]).trim()).filter((loc) => sameSite(loc, url));
    const pages = await mapLimit(urls.slice(0, limit), concurrency, async (loc) => ({ loc, ...(await get(loc)) }));
    const statuses = new Map(pages.map((page) => [page.loc, page.status]));
    const health = sitemapHealth(urls, statuses);
    const audited = pages
        .filter((page) => page.status === 200 && !health.placeholders.includes(page.loc) && !(ignore && ignore.test(page.loc)))
        .map((page) => auditArticleHtml(page.text, page.loc, { defaultImages, kind: pageKind(page.loc, urls) }));
    const llmsText = (await get(new URL("/llms.txt", origin).toString()));
    const llms = llmsCoverage(llmsText.status === 200 ? llmsText.text : "", audited.filter((audit) => audit.kind === "article").map((audit) => audit.url));
    const summary = summarizeArticleAudits(audited, health, llms);
    return {
        ok: true,
        site: origin,
        checked_urls: pages.length,
        sitemap_urls: urls.length,
        sitemap_health: health,
        llms: { ...llms, missing: llms.missing.slice(0, 20) },
        summary,
        pages: audited.filter((audit) => audit.issues.length).map(({ url: pageUrl, kind, title, author, words, issues }) => ({ url: pageUrl, kind, title, author, words, issues: issues.map((issue) => issue.id) })),
    };
}

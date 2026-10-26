export const TITLE_MAX = 60;
export const META_MIN = 110;
export const META_MAX = 160;
export const INTRO_MAX_WORDS = 90;
export const FAQ_MIN_QUESTIONS = 3;
const TEST_MARKERS = /\b(lorem ipsum|lorem|todo:|tbd|placeholder|prueba de publicacion|texto de prueba)\b|\(test\)|\{\{|\[insertar|\[slug\]/i;
const TIMESTAMP_SLUG = /-\d{10,}$/;
const CITY_PATTERN = /\b(bogot[aá]|medell[ií]n|cali|barranquilla|cartagena|bucaramanga|cucuta|c[uú]cuta|pereira|manizales)\b/i;
const PLACEHOLDER_SLUG = /^(url|undefined|null|slug|nan|test|prueba)$/i;
const MANGLED = /(^|-)[b-df-np-tv-xz](-|$)/i;
export function slugify(value) {
    return String(value || "").trim().toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/ñ/g, "n")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
        .replace(/-+[^-]*$/, (tail) => (tail.length > 1 && tail.length < 4 ? "" : tail))
        .replace(/-+$/g, "");
}
export const slugKey = (slug) => String(slug || "").toLowerCase().normalize("NFD").replace(/[^a-z]/g, "").replace(/[aeiou]/g, "");
export function slugProblems(slug) {
    const value = String(slug || "");
    const problems = [];
    if (!value)
        return problems;
    if (PLACEHOLDER_SLUG.test(value))
        problems.push(`slug placeholder "${value}"`);
    if (TIMESTAMP_SLUG.test(value))
        problems.push(`slug con timestamp "${value}"`);
    if (value.includes("-") && MANGLED.test(value))
        problems.push(`slug con tilde convertida en guion "${value}"`);
    if (/[^a-z0-9-]/.test(value))
        problems.push(`slug con caracteres no validos "${value}"`);
    return problems;
}
const words = (text) => String(text || "").split(/\s+/).filter((word) => /\p{L}/u.test(word));
export function fitMeta(text, fallbackBody = "") {
    let base = String(text || "").replace(/\s+/g, " ").trim();
    if (base.length < META_MIN && fallbackBody) {
        const firstParagraph = String(fallbackBody).split(/\n\s*\n/).map((part) => part.replace(/^#+.*$/gm, "").replace(/[*_`>#\[\]]|\(https?:[^)]*\)/g, "").trim()).find((part) => part.length > 60) || "";
        base = `${base} ${firstParagraph}`.trim();
    }
    if (base.length <= META_MAX)
        return base;
    const cut = base.slice(0, META_MAX - 1);
    return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "")}.`;
}
function sections(body) {
    const lines = String(body || "").split(/\r?\n/);
    const out = [];
    let current = { level: 0, text: "", lines: [] };
    for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
            out.push(current);
            current = { level: match[1].length, text: match[2].trim(), lines: [] };
        }
        else
            current.lines.push(line);
    }
    out.push(current);
    return out;
}
export const isFaqHeading = (text) => /preguntas\s+frecuentes|faq\b|dudas\s+frecuentes/i.test(String(text || ""));
export function faqQuestions(body) {
    const all = sections(body);
    const start = all.findIndex((section) => section.level === 2 && isFaqHeading(section.text));
    if (start < 0)
        return [];
    const questions = [];
    for (const section of all.slice(start + 1)) {
        if (section.level <= 2)
            break;
        if (section.level === 3 && /\?\s*$/.test(section.text))
            questions.push({ question: section.text, answer: section.lines.join(" ").trim() });
    }
    return questions;
}
export function checkDraftSeo({ title = "", metaDescription = "", slug = "", body = "", keyword = "", project = "" } = {}) {
    const findings = [];
    const add = (severity, id, message, fix) => findings.push({ severity, id, message, fix });
    const error = (id, message, fix) => add("error", id, message, fix);
    const warning = (id, message, fix) => add("warning", id, message, fix);
    if (title && title.length > TITLE_MAX)
        error("title_largo", `El title tiene ${title.length} caracteres; maximo ${TITLE_MAX} (Google lo corta y el sitio le suma el nombre de la marca).`, `Reescribe el title en ${TITLE_MAX} caracteres o menos, con la keyword al inicio.`);
    if (metaDescription && metaDescription.length > META_MAX)
        error("meta_larga", `meta_description tiene ${metaDescription.length} caracteres; maximo ${META_MAX}.`, `Resume la respuesta y la promesa del articulo en ${META_MIN}-${META_MAX} caracteres.`);
    else if (metaDescription && metaDescription.length < META_MIN)
        warning("meta_corta", `meta_description tiene ${metaDescription.length} caracteres; lo ideal es ${META_MIN}-${META_MAX} para ocupar el snippet.`, `Amplia la meta description a ${META_MIN}-${META_MAX} caracteres con la respuesta y un motivo para entrar.`);
    for (const problem of slugProblems(slug))
        error("slug_invalido", `El ${problem}.`, "Usa un slug corto de letras sin tilde, numeros y guiones, sin timestamp ni la palabra test.");
    const marker = `${title}\n${metaDescription}\n${body}`.match(TEST_MARKERS);
    if (marker)
        error("contenido_de_prueba", `El borrador contiene una marca de prueba o placeholder ("${marker[0]}"); no puede publicarse asi.`, "Quita el texto de prueba o los placeholders y escribe el contenido real.");
    const questions = faqQuestions(body);
    if (questions.length < FAQ_MIN_QUESTIONS) {
        error("faq_faltante", `Falta la seccion "## Preguntas frecuentes" con al menos ${FAQ_MIN_QUESTIONS} preguntas del lector (hay ${questions.length}).`, `Agrega al final "## Preguntas frecuentes" con ${FAQ_MIN_QUESTIONS} a 5 preguntas reales como "### ...?" y 2-4 frases de respuesta debajo de cada una: es lo que Google muestra como FAQ y lo que citan ChatGPT, Gemini y Perplexity.`);
    }
    else {
        const empty = questions.filter((item) => words(item.answer).length < 12);
        if (empty.length)
            error("faq_sin_respuesta", `${empty.length} pregunta(s) frecuentes sin respuesta util (minimo 12 palabras): ${empty.map((item) => item.question).slice(0, 2).join(" | ")}`, "Responde cada pregunta con 2-4 frases completas.");
    }
    const intro = sections(body)[0]?.lines.join("\n").split(/\n\s*\n/).map((part) => part.trim()).find(Boolean) || "";
    const introWords = words(intro).length;
    if (!intro)
        warning("sin_apertura", "No hay parrafo de apertura antes del primer H2.", "Abre respondiendo la pregunta principal en 40-80 palabras.");
    else if (introWords > INTRO_MAX_WORDS)
        warning("apertura_larga", `El parrafo de apertura tiene ${introWords} palabras.`, "Abre con la respuesta directa en 40-80 palabras y deja el contexto para despues.");
    if (keyword && intro) {
        const lead = words(keyword.toLowerCase()).filter((word) => word.length > 3);
        const introLower = intro.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        const hits = lead.filter((word) => introLower.includes(word.normalize("NFD").replace(/[̀-ͯ]/g, ""))).length;
        if (lead.length && hits / lead.length < 0.5)
            warning("apertura_sin_keyword", `El parrafo de apertura casi no menciona la busqueda "${keyword}".`, "Nombra la busqueda en la primera frase y respondela ahi mismo.");
    }
    const external = (String(body).match(/\]\(https?:\/\/[^)]+\)/g) || []).length;
    if (external < 2)
        warning("pocas_fuentes", `Solo ${external} enlace(s) a fuentes externas.`, "Cita al menos 2 fuentes con autoridad (normas, estudios, organismos): las usan Google y los LLMs para confiar en el texto.");
    if (/^(triarvon|spartan)$/i.test(project) && CITY_PATTERN.test(`${title} ${slug}`)) {
        error("alcance_geografico", `El title o el slug limitan el tema a una ciudad (${`${title} ${slug}`.match(CITY_PATTERN)[0]}).`, "Reescribe el tema para todo el publico hispanohablante; Colombia puede aparecer como ejemplo dentro del texto, no en el titulo.");
    }
    return findings;
}
export async function liveSlugs(domain, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
    try {
        const response = await fetchImpl(new URL("/sitemap.xml", domain).toString(), { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "SocioPublisher/1.0" } });
        if (!response.ok)
            return null;
        const xml = await response.text();
        return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => {
            try {
                return new URL(match[1]).pathname.split("/").filter(Boolean).pop() || "";
            }
            catch {
                return "";
            }
        }).filter(Boolean);
    }
    catch {
        return null;
    }
}
export function prepareForSite(article, { existing = {}, author = "", selfSlug = "" } = {}) {
    const fixes = [];
    const warnings = [];
    const blockers = [];
    const next = { ...article };
    const wanted = next.slug || next.title;
    let slug = slugify(wanted);
    if (TIMESTAMP_SLUG.test(slug)) {
        slug = slug.replace(TIMESTAMP_SLUG, "");
        fixes.push("slug sin timestamp");
    }
    if (next.slug && slug !== next.slug)
        fixes.push(`slug normalizado: ${next.slug} -> ${slug}`);
    next.slug = slug;
    for (const problem of slugProblems(slug))
        blockers.push(problem);
    const meta = fitMeta(next.excerpt, next.content);
    if (meta !== String(next.excerpt || "").trim())
        fixes.push(`meta description ajustada a ${meta.length} caracteres`);
    next.excerpt = meta;
    const marker = `${next.title}\n${next.excerpt}\n${next.content}`.match(TEST_MARKERS);
    if (marker)
        blockers.push(`contenido de prueba o placeholder ("${marker[0]}")`);
    if (String(next.title || "").length > TITLE_MAX)
        warnings.push(`title de ${next.title.length} caracteres (maximo ${TITLE_MAX})`);
    if (faqQuestions(next.content).length < FAQ_MIN_QUESTIONS)
        warnings.push("sin seccion de Preguntas frecuentes completa");
    if (!next.coverImage)
        warnings.push("sin imagen de portada propia (la pone socio_article_images al dia siguiente)");
    const ownKey = slugKey(selfSlug);
    const key = slugKey(slug);
    const sameSlug = key.length < 8 ? null : (existing.slugs || []).find((other) => slugKey(other) === key && slugKey(other) !== ownKey);
    if (sameSlug)
        blockers.push(`ya existe un articulo con ese slug en el sitio (${sameSlug}): publicarlo crea una copia que compite en Google`);
    const titleKey = String(next.title || "").trim().toLowerCase();
    const sameTitle = (existing.titles || []).find((other) => String(other || "").trim().toLowerCase() === titleKey);
    if (titleKey && sameTitle && !sameSlug && key !== ownKey)
        blockers.push(`ya hay un articulo publicado con el mismo titulo ("${sameTitle}")`);
    if (author)
        next.author = author;
    else
        warnings.push("sin autor configurado en brandkits/site_authors.json");
    if (/\b(agente|bot|ia|ai|test|admin)\b/i.test(next.author || ""))
        warnings.push(`autor generico "${next.author}": Google y los LLMs confian mas en una persona con biografia`);
    return { article: next, fixes, warnings, blockers };
}

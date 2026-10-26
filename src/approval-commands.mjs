export function cleanSlackText(text) {
    return String(text || "")
        .replace(/<@[A-Z0-9]+>\s*/g, "")
        .replace(/<tel:([^|>]+)\|([^>]+)>/g, "$2")
        .trim();
}
function normalizedCommand(text) {
    return cleanSlackText(text)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.!]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
export function extractPendingId(text) {
    return String(text || "").match(/Pending ID:\s*`([^`]+)`/i)?.[1]?.trim() || "";
}
export function extractContact(text) {
    const value = String(text || "");
    const patterns = [
        /\*Contacto pendiente\*:\s+\*([^*]+)\*/i,
        /\*Contacto pendiente de decisi[oó]n\*:\s+\*([^*]+)\*/i,
        /Contacto (?:aprobado|rechazado)[^:]*:\s+\*([^*]+)\*/i,
    ];
    for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match?.[1])
            return match[1].trim();
    }
    return "";
}
export function parseContactCommand(text, defaultContact = "") {
    const raw = cleanSlackText(text);
    const normalized = normalizedCommand(raw);
    let match = normalized.match(/^(?:aprobar|aprueba|aprobado|aprobada|aceptar|acepta|admitir|admite)(?: a)?(?: (.+))?$/i);
    if (match)
        return { action: "approve", contact: match[1]?.trim() || defaultContact };
    match = normalized.match(/^(?:rechazar|rechaza|rechazado|rechazada|desaprobar|desaprueba|bloquear|bloquea|ignorar|ignora)(?: a)?(?: (.+))?$/i);
    if (match)
        return { action: "reject", contact: match[1]?.trim() || defaultContact };
    if (defaultContact) {
        match = normalized.match(/^(.+?) (aprobar|aprueba|aprobado|aprobada|aceptar|acepta|admitir|admite)$/i);
        if (match && normalizedCommand(match[1]) === normalizedCommand(defaultContact)) {
            return { action: "approve", contact: defaultContact };
        }
        match = normalized.match(/^(.+?) (rechazar|rechaza|rechazado|rechazada|desaprobar|desaprueba|bloquear|bloquea|ignorar|ignora)$/i);
        if (match && normalizedCommand(match[1]) === normalizedCommand(defaultContact)) {
            return { action: "reject", contact: defaultContact };
        }
    }
    if (!defaultContact) {
        match = normalized.match(/^(.+?) (aprobar|aprueba|aprobado|aprobada|aceptar|acepta|admitir|admite)$/i);
        if (match)
            return { action: "approve", contact: match[1].trim() };
        match = normalized.match(/^(.+?) (rechazar|rechaza|rechazado|rechazada|desaprobar|desaprueba|bloquear|bloquea|ignorar|ignora)$/i);
        if (match)
            return { action: "reject", contact: match[1].trim() };
    }
    let update = raw.match(/^(perfil|contexto|notas|objetivo|goal)\s+(?:de|para|of)\s+(.+?)\s*:\s*([\s\S]+)$/i);
    if (update) {
        const field = normalizedCommand(update[1]);
        return {
            action: ["objetivo", "goal"].includes(field) ? "goal" : field === "notas" ? "notes" : "profile",
            contact: update[2].trim(),
            text: update[3].trim(),
        };
    }
    const profile = raw.match(/^(?:perfil|contexto)\s*:\s*([\s\S]+)$/i);
    if (profile)
        return { action: "profile", contact: defaultContact, text: profile[1].trim() };
    const notes = raw.match(/^notas\s*:\s*([\s\S]+)$/i);
    if (notes)
        return { action: "notes", contact: defaultContact, text: notes[1].trim() };
    const goal = raw.match(/^(?:objetivo|goal)\s*:\s*([\s\S]+)$/i);
    if (goal)
        return { action: "goal", contact: defaultContact, text: goal[1].trim() };
    const alias = raw.match(/^(?:(?:es|is)\s+(?:la|el|the)?\s*(?:mism[oa]|same)(?:\s+persona)?|(?:nombre|alias)\s*:)\s*(?:que\s+)?(.+)$/i);
    if (alias && defaultContact && alias[1]?.trim()) {
        return { action: "alias", contact: defaultContact, text: alias[1].trim() };
    }
    return null;
}
export function parseContactQuery(text, defaultContact = "") {
    const raw = cleanSlackText(text);
    const normalized = normalizedCommand(raw);
    let field = "";
    if (/\b(objetivo|goal)\b/.test(normalized))
        field = "goal";
    else if (/\b(estrategia|strategy|fase)\b/.test(normalized))
        field = "strategy";
    else if (/\b(perfil|profile|quien es|who is)\b/.test(normalized))
        field = "profile";
    else if (/\b(notas|notes|bitacora|log)\b/.test(normalized))
        field = "notes";
    else if (/\b(dossier|dosier|informacion|information|que sabes|what do you know)\b/.test(normalized))
        field = "all";
    if (!field)
        return null;
    const isQuestion = /^(?:cual|cu[aá]l|que|qué|dime|muestra|mu[eé]strame|what|which|wich|show|tell)\b/i.test(raw)
        || /[?¿]/.test(raw)
        || /^(?:objetivo|goal|perfil|profile|estrategia|strategy|notas|notes|dossier|dosier)$/i.test(raw.trim());
    if (!isQuestion)
        return null;
    const contact = raw.match(/\b(?:de|del|sobre|para|con|with|of)\s+(.+?)\s*[?¿]*$/i)?.[1]?.trim() || defaultContact;
    return { action: "show", field, contact };
}
export function parseContactFields(text) {
    const raw = cleanSlackText(text);
    const boundary = "(?=\\n\\s*(?:nombre|alias|perfil|contexto|notas|objetivo|goal)\\s*:|$)";
    const name = raw.match(new RegExp(`(?:^|\\n)\\s*(?:nombre|alias)\\s*:\\s*([\\s\\S]*?)${boundary}`, "i"))?.[1]?.trim() || "";
    const profile = raw.match(new RegExp(`(?:^|\\n)\\s*(?:perfil|contexto)\\s*:\\s*([\\s\\S]*?)${boundary}`, "i"))?.[1]?.trim() || "";
    const notes = raw.match(new RegExp(`(?:^|\\n)\\s*notas\\s*:\\s*([\\s\\S]*?)${boundary}`, "i"))?.[1]?.trim() || "";
    const goal = raw.match(new RegExp(`(?:^|\\n)\\s*(?:objetivo|goal)\\s*:\\s*([\\s\\S]*?)${boundary}`, "i"))?.[1]?.trim() || "";
    return { name, profile, notes, goal };
}
export function parseMessageCommand(text) {
    const raw = cleanSlackText(text);
    const normalized = normalizedCommand(raw);
    if (/^(?:si,? )?(?:envialo|enviala|mandalo|mandala)$/.test(normalized))
        return { action: "send" };
    const option = normalized.match(/^(?:me gusta )?(?:la )?opcion ([a-z])(?:,? )?(?:enviala|envialo|mandala|mandalo)$/);
    if (option)
        return { action: "send-option", option: option[1].toUpperCase() };
    const draft = raw.match(/^(?:borrador|respuesta|draft)\s*:\s*([\s\S]+)$/i);
    if (draft)
        return { action: "draft", text: draft[1].trim() };
    if (/^(?:descartar|cerrar|ignorar|no enviar|no lo envies|no la envies)$/.test(normalized))
        return { action: "close" };
    return raw ? { action: "adjust", instruction: raw } : null;
}
export function optionTextFromReplies(replies, optionLetter) {
    const letter = String(optionLetter || "").toUpperCase();
    for (const reply of [...(replies || [])].reverse()) {
        if (!reply.bot_id)
            continue;
        const text = String(reply.text || "").replace(/&gt;/g, ">");
        const pattern = new RegExp(`(?:Opcion|Opción)\\s+${letter}[^\\n]*\\n\\s*>?\\s*[\"“]?([^\"”\\n]+)`, "i");
        const match = text.match(pattern);
        if (match?.[1])
            return match[1].trim();
    }
    return "";
}

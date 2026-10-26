export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DEFAULT_PATTERN = Object.freeze({
    mon: ["C", "N1"], tue: ["A"], wed: ["C", "N2"], thu: ["A"], fri: ["C"], sat: ["N3"], sun: ["A"],
});
export function weekSlots({ pattern = DEFAULT_PATTERN, baseHour, premiumHour }) {
    const slots = [];
    DAYS.forEach((day, offset) => {
        for (const code of pattern[day] || []) {
            const isNew = code.startsWith("N");
            slots.push({ kind: isNew ? "N" : code, n: isNew ? Number(code.slice(1)) : 0, day, offset, hour: isNew ? premiumHour : baseHour });
        }
    });
    return slots;
}
const addDays = (date, days) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};
export const mondayOf = (date) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
export function checkSequence(items) {
    const problems = [];
    const sorted = [...items].sort((a, b) => String(a.at).localeCompare(String(b.at)));
    sorted.forEach((item, index) => {
        const previous = sorted[index - 1];
        if (previous && previous.kind === "C" && item.kind === "C")
            problems.push(`dos carruseles seguidos: ${previous.at.slice(0, 16)} y ${item.at.slice(0, 16)}`);
    });
    const byDay = new Map();
    for (const item of sorted)
        byDay.set(item.at.slice(0, 10), [...(byDay.get(item.at.slice(0, 10)) || []), item]);
    for (const [day, list] of byDay) {
        if (list.length > 1 && list.at(-1).kind !== "N" && list.some((entry) => entry.kind === "N"))
            problems.push(`${day}: el reel nuevo no es la ultima publicacion del dia`);
    }
    return problems;
}
export function assignWeek({ weekStart, pieces, baseHour, premiumHour, pattern = DEFAULT_PATTERN, now = Date.now() }) {
    const slots = weekSlots({ pattern, baseHour, premiumHour }).map((slot) => ({ ...slot, at: `${addDays(weekStart, slot.offset)}T${slot.hour}:00-05:00` }));
    const usable = (slot) => Date.parse(slot.at) > now + 5 * 60_000;
    const moves = [];
    const keep = [];
    const surplus = [];
    const gaps = [];
    for (const kind of ["C", "A", "N"]) {
        const mine = pieces.filter((piece) => piece.kind === kind);
        const free = slots.filter((slot) => slot.kind === kind && usable(slot));
        if (kind === "N") {
            for (const piece of mine) {
                const slot = free.find((entry) => entry.n === Number(piece.n)) || null;
                if (!slot) {
                    surplus.push({ ...piece, reason: `no hay hueco libre para el reel nuevo ${piece.n}` });
                    continue;
                }
                free.splice(free.indexOf(slot), 1);
                (piece.at && Date.parse(piece.at) === Date.parse(slot.at) ? keep : moves).push({ ...piece, from: piece.at || "", to: slot.at, slot: `${kind}${slot.n || ""}` });
            }
        }
        else {
            const ordered = [...mine].sort((a, b) => String(a.at).localeCompare(String(b.at)));
            for (const piece of ordered) {
                const slot = free.shift();
                if (!slot) {
                    surplus.push({ ...piece, reason: `hay mas ${kind === "C" ? "carruseles" : "reels antiguos"} de los que caben en la semana` });
                    continue;
                }
                (piece.at && Date.parse(piece.at) === Date.parse(slot.at) ? keep : moves).push({ ...piece, from: piece.at || "", to: slot.at, slot: kind });
            }
        }
        for (const slot of free)
            gaps.push({ kind, n: slot.n, at: slot.at });
    }
    return { moves, keep, surplus, gaps, slots };
}

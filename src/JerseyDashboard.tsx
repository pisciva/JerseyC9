import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X, AlertCircle, Loader2, Ruler } from "lucide-react";
import "./JerseyDashboard.css"; // <-- Import CSS-nya di sini!

const DATA_PATH = "/data/orders.xlsx";

export interface JerseyOrder {
    id: number;
    name: string;
    session: string;
    backName: string;
    jerseyNumber: string;
    orderType: string;
    gender: string;
    size: string;
    sleeve: string;
    color: string;
    proof: string;
}

type SortKey =
    | "id"
    | "name"
    | "session"
    | "backName"
    | "jerseyNumber"
    | "orderType"
    | "gender"
    | "size"
    | "sleeve"
    | "color";

interface ColumnDef {
    key: SortKey;
    label: string;
    sortable: boolean;
    width: string;
}

const HEADER_MAP: { field: keyof Omit<JerseyOrder, "id">; matchers: string[] }[] = [
    { field: "name", matchers: ["submitted by", "nama pemesan", "nama"] },
    { field: "session", matchers: ["which session", "sesi"] },
    { field: "backName", matchers: ["back name", "nama punggung"] },
    { field: "jerseyNumber", matchers: ["jersey number", "no jersey", "nomor jersey"] },
    { field: "orderType", matchers: ["order type", "tipe order"] },
    { field: "gender", matchers: ["gender"] },
    { field: "size", matchers: ["jersey size", "ukuran"] },
    { field: "sleeve", matchers: ["sleeve type", "lengan"] },
    { field: "color", matchers: ["jersey color", "warna"] },
    { field: "proof", matchers: ["proof of payment", "bukti pembayaran", "proof"] },
];

function normalizeHeader(h: string): string {
    return h.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function buildColumnIndex(headerRow: string[]): Partial<Record<keyof Omit<JerseyOrder, "id">, number>> {
    const normalized = headerRow.map(normalizeHeader);
    const index: Partial<Record<keyof Omit<JerseyOrder, "id">, number>> = {};
    const claimed = new Set<number>();

    for (const { field, matchers } of HEADER_MAP) {
        for (const matcher of matchers) {
            const normMatcher = normalizeHeader(matcher);
            const foundAt = normalized.findIndex((h, i) => !claimed.has(i) && h === normMatcher);
            if (foundAt !== -1) {
                index[field] = foundAt;
                claimed.add(foundAt);
                break;
            }
        }
    }

    for (const { field, matchers } of HEADER_MAP) {
        if (index[field] !== undefined) continue;
        for (const matcher of matchers) {
            const normMatcher = normalizeHeader(matcher);
            const foundAt = normalized.findIndex((h, i) => !claimed.has(i) && h.includes(normMatcher));
            if (foundAt !== -1) {
                index[field] = foundAt;
                claimed.add(foundAt);
                break;
            }
        }
    }

    return index;
}

function parseWorkbookToOrders(workbook: XLSX.WorkBook): JerseyOrder[] {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("The file doesn't contain any sheets.");
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: "",
    });

    if (rows.length < 2) throw new Error("The sheet is empty or only has a header row — no data found.");

    const [headerRow, ...dataRows] = rows;
    const colIndex = buildColumnIndex(headerRow.map(String));

    const requiredFound = ["name", "session"].every(
        f => colIndex[f as keyof Omit<JerseyOrder, "id">] !== undefined
    );
    if (!requiredFound) {
        throw new Error(
            "Required columns (Submitted by / Which Session?) weren't found in the header row."
        );
    }

    const get = (row: string[], field: keyof Omit<JerseyOrder, "id">): string => {
        const idx = colIndex[field];
        if (idx === undefined) return "";
        return (row[idx] ?? "").toString().trim();
    };

    return dataRows
        .filter(row => row.some(cell => (cell ?? "").toString().trim() !== ""))
        .map((row, i) => ({
            id: i + 1,
            name: get(row, "name"),
            session: get(row, "session"),
            backName: get(row, "backName"),
            jerseyNumber: get(row, "jerseyNumber"),
            orderType: get(row, "orderType"),
            gender: get(row, "gender"),
            size: get(row, "size"),
            sleeve: get(row, "sleeve"),
            color: get(row, "color"),
            proof: get(row, "proof"),
        }));
}

function shortGender(g: string): string {
    if (g.startsWith("Men")) return "Men";
    if (g.startsWith("Women")) return "Women";
    return g || "—";
}

function shortSize(s: string): string {
    return s.replace(/\s*\(\+.*\)/, "");
}

function shortSleeve(s: string): string {
    return s.replace(" Sleeve", "").replace(/\s*\(\+.*\)/, "");
}

function shortOrderType(o: string): string {
    return o.startsWith("Full Set") ? "Full Set" : o || "—";
}

const COLUMNS: ColumnDef[] = [
    { key: "id", label: "No", sortable: true, width: "48px" },
    { key: "name", label: "Name", sortable: true, width: "180px" },
    { key: "session", label: "Session", sortable: true, width: "110px" },
    { key: "backName", label: "Back Name", sortable: true, width: "130px" },
    { key: "jerseyNumber", label: "No.", sortable: true, width: "60px" },
    { key: "orderType", label: "Order", sortable: true, width: "110px" },
    { key: "gender", label: "Gender", sortable: true, width: "80px" },
    { key: "size", label: "Size", sortable: true, width: "70px" },
    { key: "sleeve", label: "Sleeve", sortable: true, width: "80px" },
    { key: "color", label: "Color", sortable: true, width: "70px" },
];

// ============================================================================
// 🎨 PUSAT KONTROL WARNA — UBAH SEMUA WARNA BADGE CUKUP DI SINI
// ============================================================================
// Urutan penting! Rule paling atas dicek duluan.
// "match" bisa satu keyword atau array keyword — huruf besar/kecil gak masalah,
// karena value dari data selalu di-lowercase dulu sebelum dibandingkan.

type ColorRule = { match: string | string[]; bg: string; text: string };

const COLOR_RULES: ColorRule[] = [
    { match: "morning", bg: "#fef08a", text: "#854d0e" },     // Pagi: soft yellow cerah (matahari pagi)
    { match: "afternoon", bg: "#fdba74", text: "#9a3412" },   // Siang: soft orange lebih pekat (matahari sore)

    // --- Gender ---
    { match: "men", bg: "#dbeafe", text: "#1d4ed8" },         // Cowok: soft blue
    { match: "women", bg: "#fbcfe8", text: "#be185d" },       // Cewek: soft pink

    // --- Sleeve ---
    { match: "short", bg: "#fed7aa", text: "#c2410c" },       // Lengan pendek: soft orange
    { match: "long", bg: "#bbf7d0", text: "#15803d" },        // Lengan panjang: soft green

    // --- Order Type ---
    { match: "full set", bg: "#e9d5ff", text: "#7e22ce" },    // Full Set: soft purple
    { match: "jersey only", bg: "#bae6fd", text: "#0369a1" }, // Jersey Only: soft sky blue

    // --- Jersey Color (A / Broken White & B / Navy) ---
    { match: ["broken white", "a"], bg: "#f0e9dd", text: "#78716c" }, // Broken White: soft cream, teks abu gelap
    { match: ["navy", "b"], bg: "#c7d2fe", text: "#1e1b4b" },         // Navy: soft indigo, teks navy pekat

    // --- Size ---
    { match: ["s", "m", "l", "xl", "xxl", "3xl", "4xl", "5xl", "6xl"], bg: "#e2e8f0", text: "#334155" },
];

// Fallback kalau value gak ketemu di COLOR_RULES (random tapi konsisten, tetap soft)
const CATEGORY_PALETTE: { bg: string; text: string }[] = [
    { bg: "#cffafe", text: "#0e7490" },
    { bg: "#ffe4e6", text: "#be123c" },
    { bg: "#d1fae5", text: "#047857" },
    { bg: "#fef3c7", text: "#b45309" },
    { bg: "#ede9fe", text: "#6d28d9" },
    { bg: "#e0f2fe", text: "#0369a1" },
    { bg: "#ecfccb", text: "#4d7c0f" },
    { bg: "#fae8ff", text: "#a21caf" },
    { bg: "#ccfbf1", text: "#0f766e" },
    { bg: "#f1f5f9", text: "#334155" },
];

function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h << 5) - h + s.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function colorForCategory(value: string): { bg: string; text: string } {
    if (!value) return { bg: "rgba(0,0,0,0.05)", text: "var(--muted)" };

    const v = value.toLowerCase().trim();

    // 1) Exact match dulu
    for (const rule of COLOR_RULES) {
        const matchers = Array.isArray(rule.match) ? rule.match : [rule.match];
        if (matchers.includes(v)) {
            return { bg: rule.bg, text: rule.text };
        }
    }

    // 2) Kalau gak exact, coba "mengandung kata" (misal value = "Color A - Broken White")
    for (const rule of COLOR_RULES) {
        const matchers = Array.isArray(rule.match) ? rule.match : [rule.match];
        if (matchers.some(m => v.includes(m))) {
            return { bg: rule.bg, text: rule.text };
        }
    }

    // 3) Gak ketemu sama sekali → warna random tapi konsisten
    return CATEGORY_PALETTE[hashString(value) % CATEGORY_PALETTE.length];
}

function CategoryBadge({ value }: { value: string }) {
    if (!value) return <span style={{ color: "var(--muted)" }}>—</span>;
    const c = colorForCategory(value);
    return (
        <span className="jd-badge" style={{ background: c.bg, color: c.text }}>
            {value}
        </span>
    );
}

function getPreviewDesign(sleeve: string, color: string) {
    if (!sleeve || !color) return null;

    const isLong = sleeve.toLowerCase().includes("long");
    const isNavy = color.toLowerCase().includes("navy") || color.toLowerCase().includes("b");

    if (!isLong && !isNavy) {
        return { label: "Short Sleeve - Broken White", img: "/Image 1.png" };
    }
    if (!isLong && isNavy) {
        return { label: "Short Sleeve - Navy", img: "/Image 2.png" };
    }
    if (isLong && !isNavy) {
        return { label: "Long Sleeve - Broken White", img: "/Image 3.png" };
    }
    if (isLong && isNavy) {
        return { label: "Long Sleeve - Navy", img: "/Image 4.png" };
    }

    return null;
}

const SIZE_CHART_MEN = [
    { size: "S", lebar: 45, panjang: 69 },
    { size: "M", lebar: 48, panjang: 72 },
    { size: "L", lebar: 51, panjang: 74 },
    { size: "XL", lebar: 54, panjang: 76 },
    { size: "XXL", lebar: 57, panjang: 78 },
    { size: "3XL", lebar: 60, panjang: 80 },
    { size: "4XL", lebar: 63, panjang: 82 },
    { size: "5XL", lebar: 66, panjang: 84 },
    { size: "6XL", lebar: 69, panjang: 86 },
];

const SIZE_CHART_WOMEN = [
    { size: "S", lebar: 41, panjang: 67 },
    { size: "M", lebar: 44, panjang: 70 },
    { size: "L", lebar: 47, panjang: 72 },
    { size: "XL", lebar: 50, panjang: 74 },
    { size: "XXL", lebar: 53, panjang: 76 },
    { size: "3XL", lebar: 56, panjang: 78 },
    { size: "4XL", lebar: 59, panjang: 80 },
    { size: "5XL", lebar: 62, panjang: 82 },
    { size: "6XL", lebar: 65, panjang: 84 },
];

type LoadState = "loading" | "ready" | "error";

export default function JerseyDashboard() {
    const [orders, setOrders] = useState<JerseyOrder[]>([]);
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [error, setError] = useState<string>("");

    const [search, setSearch] = useState("");
    const [sessionFilter, setSessionFilter] = useState("All");
    const [orderTypeFilter, setOrderTypeFilter] = useState("All");
    const [genderFilter, setGenderFilter] = useState("All");
    const [sizeFilter, setSizeFilter] = useState("All");
    const [sleeveFilter, setSleeveFilter] = useState("All");
    const [colorFilter, setColorFilter] = useState("All");
    const [sortKey, setSortKey] = useState<SortKey>("id");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const [showSizeChart, setShowSizeChart] = useState(false);
    const [previewItem, setPreviewItem] = useState<JerseyOrder | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoadState("loading");
            setError("");
            try {
                const res = await fetch(DATA_PATH);
                if (!res.ok) throw new Error(`File not found at ${DATA_PATH} (status ${res.status}).`);
                const buffer = await res.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: "array" });
                const parsed = parseWorkbookToOrders(workbook);
                if (!cancelled) {
                    setOrders(parsed);
                    setLoadState("ready");
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "Failed to read the file.");
                    setLoadState("error");
                }
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const sessions = useMemo(() => ["All", ...Array.from(new Set(orders.map(d => d.session).filter(Boolean)))], [orders]);
    const orderTypes = useMemo(() => ["All", ...Array.from(new Set(orders.map(d => d.orderType).filter(Boolean)))], [orders]);
    const genders = useMemo(() => ["All", ...Array.from(new Set(orders.map(d => d.gender).filter(Boolean)))], [orders]);
    const sizes = useMemo(() => {
        const order = ["S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"];
        const present = Array.from(new Set(orders.map(d => shortSize(d.size)).filter(Boolean)));
        present.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        return ["All", ...present];
    }, [orders]);
    const sleeves = useMemo(() => ["All", ...Array.from(new Set(orders.map(d => shortSleeve(d.sleeve)).filter(Boolean)))], [orders]);
    const colors = useMemo(() => ["All", ...Array.from(new Set(orders.map(d => d.color).filter(Boolean))).sort()], [orders]);

    const filtered = useMemo(() => {
        let rows = orders.filter(d => {
            if (sessionFilter !== "All" && d.session !== sessionFilter) return false;
            if (orderTypeFilter !== "All" && d.orderType !== orderTypeFilter) return false;
            if (genderFilter !== "All" && d.gender !== genderFilter) return false;
            if (sizeFilter !== "All" && shortSize(d.size) !== sizeFilter) return false;
            if (sleeveFilter !== "All" && shortSleeve(d.sleeve) !== sleeveFilter) return false;
            if (colorFilter !== "All" && d.color !== colorFilter) return false;
            if (search.trim()) {
                const q = search.trim().toLowerCase();
                const hay = `${d.name} ${d.backName} ${d.jerseyNumber}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        rows = rows.slice().sort((a, b) => {
            let av: string | number = a[sortKey];
            let bv: string | number = b[sortKey];
            if (sortKey === "id" || sortKey === "jerseyNumber") {
                av = parseFloat(String(a[sortKey])) || 0;
                bv = parseFloat(String(b[sortKey])) || 0;
            } else {
                av = (av || "").toString().toLowerCase();
                bv = (bv || "").toString().toLowerCase();
            }
            if (av < bv) return sortDir === "asc" ? -1 : 1;
            if (av > bv) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return rows;
    }, [orders, search, sessionFilter, orderTypeFilter, genderFilter, sizeFilter, sleeveFilter, colorFilter, sortKey, sortDir]);

    function toggleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir(d => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    }

    function resetFilters() {
        setSearch("");
        setSessionFilter("All");
        setOrderTypeFilter("All");
        setGenderFilter("All");
        setSizeFilter("All");
        setSleeveFilter("All");
        setColorFilter("All");
    }

    const activeFilterCount =
        [sessionFilter, orderTypeFilter, genderFilter, sizeFilter, sleeveFilter, colorFilter].filter(v => v !== "All").length +
        (search.trim() ? 1 : 0);

    const stats = useMemo(() => {
        const total = orders.length;
        const fullSet = orders.filter(d => d.orderType.startsWith("Full Set")).length;
        return { total, fullSet, jerseyOnly: total - fullSet };
    }, [orders]);

    const activePreview = previewItem ? getPreviewDesign(previewItem.sleeve, previewItem.color) : null;

    return (
        <div className="jd-container">
            <div className="jd-bg" />

            <div className="jd-wrap">
                {loadState === "loading" && (
                    <div className="jd-glass" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "40px 0", color: "var(--muted)", fontSize: 13 }}>
                        <Loader2 size={16} className="jd-spin" /> Loading {DATA_PATH}...
                    </div>
                )}

                {loadState === "error" && (
                    <div className="jd-glass" style={{ padding: "20px 22px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#c2542c", fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>
                            <AlertCircle size={15} /> Couldn't read the file
                        </div>
                        <div style={{ fontSize: 12.5, marginBottom: 6 }}>{error}</div>
                    </div>
                )}

                {loadState === "ready" && (
                    <>
                        <div className="jd-glass jd-toolbar">
                            <div className="jd-search">
                                <Search size={14} />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, back name, number…" />
                            </div>

                            <select className="jd-select" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
                                {sessions.map(s => <option key={s} value={s}>{s === "All" ? "All Sessions" : s}</option>)}
                            </select>
                            <select className="jd-select" value={orderTypeFilter} onChange={e => setOrderTypeFilter(e.target.value)}>
                                {orderTypes.map(s => <option key={s} value={s}>{s === "All" ? "All Order Types" : s}</option>)}
                            </select>
                            <select className="jd-select" value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
                                {genders.map(s => <option key={s} value={s}>{s === "All" ? "All Genders" : s}</option>)}
                            </select>
                            <select className="jd-select" value={sizeFilter} onChange={e => setSizeFilter(e.target.value)}>
                                {sizes.map(s => <option key={s} value={s}>{s === "All" ? "All Sizes" : s}</option>)}
                            </select>
                            <select className="jd-select" value={sleeveFilter} onChange={e => setSleeveFilter(e.target.value)}>
                                {sleeves.map(s => <option key={s} value={s}>{s === "All" ? "All Sleeves" : s}</option>)}
                            </select>
                            <select className="jd-select" value={colorFilter} onChange={e => setColorFilter(e.target.value)}>
                                {colors.map(s => <option key={s} value={s}>{s === "All" ? "All Colors" : s}</option>)}
                            </select>

                            <button className="jd-btn" onClick={() => setShowSizeChart(true)}>
                                <Ruler size={14} /> Size Chart
                            </button>

                            {activeFilterCount > 0 && (
                                <button className="jd-btn" onClick={resetFilters} style={{ background: '#fff' }}>
                                    <X size={12} /> Reset ({activeFilterCount})
                                </button>
                            )}
                        </div>

                        <div className="jd-count">
                            <strong>{filtered.length}</strong> of {stats.total} orders
                        </div>

                        <div className="jd-glass">
                            <div className="jd-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            {COLUMNS.map(col => (
                                                <th key={col.key} onClick={() => col.sortable && toggleSort(col.key)} style={{ minWidth: col.width }}>
                                                    <span className="jd-th-inner">
                                                        {col.label}
                                                        {col.sortable &&
                                                            (sortKey === col.key ? (
                                                                sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                                                            ) : (
                                                                <ArrowUpDown size={11} style={{ opacity: 0.35 }} />
                                                            ))}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody onMouseLeave={() => setPreviewItem(null)}>
                                        {filtered.map(d => (
                                            <tr
                                                key={d.id}
                                                onMouseEnter={() => setPreviewItem(d)}
                                                onClick={() => setPreviewItem(d)}
                                            >
                                                <td>{d.id}</td>
                                                <td style={{ fontWeight: 600 }}>{d.name}</td>
                                                <td><CategoryBadge value={d.session} /></td>
                                                <td>{d.backName || "—"}</td>
                                                <td className="jd-mono">{d.jerseyNumber || "—"}</td>
                                                <td><CategoryBadge value={shortOrderType(d.orderType)} /></td>
                                                <td><CategoryBadge value={shortGender(d.gender)} /></td>
                                                <td><CategoryBadge value={shortSize(d.size)} /></td>
                                                <td><CategoryBadge value={shortSleeve(d.sleeve)} /></td>
                                                <td><CategoryBadge value={d.color} /></td>
                                            </tr>
                                        ))}
                                        {filtered.length === 0 && (
                                            <tr>
                                                <td colSpan={COLUMNS.length} style={{ textAlign: "center", padding: "36px 0", color: "var(--muted)" }}>
                                                    No matching orders.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="jd-cards" onMouseLeave={() => setPreviewItem(null)}>
                                {filtered.map(d => (
                                    <div className="jd-card" key={d.id} onClick={() => setPreviewItem(d)}>
                                        <div className="jd-card-top">
                                            <div>
                                                <div className="jd-card-name">{d.name}</div>
                                                {d.backName && <div className="jd-card-backname">{d.backName}</div>}
                                            </div>
                                            <span className="jd-card-num">{d.jerseyNumber || "—"}</span>
                                        </div>
                                        <div className="jd-card-grid">
                                            <div className="jd-card-grid-item"><label>Session</label><CategoryBadge value={d.session} /></div>
                                            <div className="jd-card-grid-item"><label>Order</label><CategoryBadge value={shortOrderType(d.orderType)} /></div>
                                            <div className="jd-card-grid-item"><label>Gender</label><CategoryBadge value={shortGender(d.gender)} /></div>
                                            <div className="jd-card-grid-item"><label>Size</label><CategoryBadge value={shortSize(d.size)} /></div>
                                            <div className="jd-card-grid-item"><label>Sleeve</label><CategoryBadge value={shortSleeve(d.sleeve)} /></div>
                                            <div className="jd-card-grid-item"><label>Color</label><CategoryBadge value={d.color} /></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {activePreview && (
                <div className="jd-preview-float">
                    <img src={activePreview.img} alt={activePreview.label} />
                    <div>
                        <div className="jd-p-title">{activePreview.label}</div>
                        <div className="jd-p-sub">
                            {previewItem?.name} &bull; {previewItem?.jerseyNumber || "No Num"}
                        </div>
                    </div>
                </div>
            )}

            {showSizeChart && (
                <div className="jd-modal-overlay" onClick={() => setShowSizeChart(false)}>
                    <div className="jd-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="jd-modal-header">
                            <div className="jd-modal-title">
                                <Ruler size={20} className="jd-accent" /> Jersey Size Chart
                            </div>
                            <button className="jd-modal-close" onClick={() => setShowSizeChart(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="jd-modal-body">
                            <div className="jd-size-table-wrap">
                                <h4>Laki-laki</h4>
                                <table className="jd-size-table jd-male-table">
                                    <thead>
                                        <tr>
                                            <th>SIZE</th>
                                            <th>LEBAR</th>
                                            <th>PANJANG</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {SIZE_CHART_MEN.map((row) => (
                                            <tr key={row.size}>
                                                <td>{row.size}</td>
                                                <td>{row.lebar}</td>
                                                <td>{row.panjang}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="jd-size-table-wrap">
                                <h4>Perempuan</h4>
                                <table className="jd-size-table jd-female-table">
                                    <thead>
                                        <tr>
                                            <th>SIZE</th>
                                            <th>LEBAR</th>
                                            <th>PANJANG</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {SIZE_CHART_WOMEN.map((row) => (
                                            <tr key={row.size}>
                                                <td>{row.size}</td>
                                                <td>{row.lebar}</td>
                                                <td>{row.panjang}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
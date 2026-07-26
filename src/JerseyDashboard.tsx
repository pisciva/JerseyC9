import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { WorkBook } from "xlsx";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Camera,
    CheckCircle2,
    Clock,
    Hash,
    Loader2,
    LockKeyhole,
    LogOut,
    Palette,
    RefreshCcw,
    Ruler,
    Search,
    ShieldCheck,
    Shirt,
    Signature,
    Tag,
    Upload,
    UserRound,
    X,
    XCircle,
} from "lucide-react";
import "./JerseyDashboard.css";

const DATA_PATH = "/data/orders.xlsx";
const ADMIN_STORAGE_KEY = "jd-admin-session";
const RECORDS_STORAGE_KEY = "jd-distribution-records";
const CHANNEL_NAME = "jd-distribution-sync";
const LOCAL_FALLBACK_ENABLED = import.meta.env.DEV;

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
    orderKey: string;
}

interface AdminSession {
    name: string;
    codeLabel: string;
    loginAt: string;
}

interface DistributionChecklist {
    name: boolean;
    backName: boolean;
    jerseyNumber: boolean;
    orderType: boolean;
    size: boolean;
    sleeve: boolean;
    color: boolean;
}

interface DistributionRecord {
    orderKey: string;
    pickedUp: boolean;
    pickedUpAt: string | null;
    pickedUpBy: string | null;
    checklist: DistributionChecklist;
    photoUrl: string | null;
    notes: string;
    updatedAt: string;
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

type LoadState = "loading" | "ready" | "error";
type StatusFilter = "All" | "PickedUp" | "Pending";
type SaveState = "idle" | "saving" | "error" | "saved";

interface ColumnDef {
    key: SortKey;
    label: string;
    sortable: boolean;
    width: string;
}

const EMPTY_CHECKLIST: DistributionChecklist = {
    name: false,
    backName: false,
    jerseyNumber: false,
    orderType: false,
    size: false,
    sleeve: false,
    color: false,
};

const HEADER_MAP: { field: keyof Omit<JerseyOrder, "id" | "orderKey">; matchers: string[] }[] = [
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

const COLUMNS: ColumnDef[] = [
    { key: "id", label: "No", sortable: true, width: "48px" },
    { key: "name", label: "Zoom Name", sortable: true, width: "180px" },
    { key: "session", label: "Session", sortable: true, width: "110px" },
    { key: "backName", label: "Back Name", sortable: true, width: "130px" },
    { key: "jerseyNumber", label: "No.", sortable: true, width: "60px" },
    { key: "orderType", label: "Order", sortable: true, width: "110px" },
    { key: "gender", label: "Size Type", sortable: true, width: "95px" },
    { key: "size", label: "Size", sortable: true, width: "70px" },
    { key: "sleeve", label: "Sleeve", sortable: true, width: "80px" },
    { key: "color", label: "Color", sortable: true, width: "70px" },
];

type ColorRule = { match: string | string[]; bg: string; text: string };

const COLOR_RULES: ColorRule[] = [
    { match: "morning", bg: "#fef08a", text: "#854d0e" },
    { match: "afternoon", bg: "#fdba74", text: "#9a3412" },
    { match: "women", bg: "#fbcfe8", text: "#be185d" },
    { match: "men", bg: "#dbeafe", text: "#1d4ed8" },
    { match: "short", bg: "#fed7aa", text: "#c2410c" },
    { match: "long", bg: "#bbf7d0", text: "#15803d" },
    { match: "full set", bg: "#e9d5ff", text: "#7e22ce" },
    { match: "jersey only", bg: "#bae6fd", text: "#0369a1" },
    { match: ["broken white", "option a", "a"], bg: "#f0e9dd", text: "#78716c" },
    { match: ["navy", "option b", "b"], bg: "#c7d2fe", text: "#1e1b4b" },
    { match: ["s", "m", "l", "xl", "xxl", "3xl", "4xl", "5xl", "6xl"], bg: "#e2e8f0", text: "#334155" },
];

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

function normalizeHeader(h: string): string {
    return h.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h << 5) - h + s.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function makeOrderKey(row: Omit<JerseyOrder, "orderKey">): string {
    const raw = [row.id, row.name, row.backName, row.jerseyNumber, row.size, row.sleeve, row.color].join("|").toLowerCase();
    return `order-${row.id}-${hashString(raw).toString(36)}`;
}

function buildColumnIndex(headerRow: string[]): Partial<Record<keyof Omit<JerseyOrder, "id" | "orderKey">, number>> {
    const normalized = headerRow.map(normalizeHeader);
    const index: Partial<Record<keyof Omit<JerseyOrder, "id" | "orderKey">, number>> = {};
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

function parseWorkbookToOrders(workbook: WorkBook, xlsxUtils: typeof import("xlsx")["utils"]): JerseyOrder[] {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("The file doesn't contain any sheets.");
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = xlsxUtils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: "",
    });

    if (rows.length < 2) throw new Error("The sheet is empty or only has a header row; no data found.");

    const [headerRow, ...dataRows] = rows;
    const colIndex = buildColumnIndex(headerRow.map(String));
    const requiredFound = ["name", "session"].every(
        f => colIndex[f as keyof Omit<JerseyOrder, "id" | "orderKey">] !== undefined
    );

    if (!requiredFound) {
        throw new Error("Required columns (Submitted by / Which Session?) weren't found in the header row.");
    }

    const get = (row: string[], field: keyof Omit<JerseyOrder, "id" | "orderKey">): string => {
        const idx = colIndex[field];
        if (idx === undefined) return "";
        return (row[idx] ?? "").toString().trim();
    };

    return dataRows
        .filter(row => row.some(cell => (cell ?? "").toString().trim() !== ""))
        .map((row, i) => {
            const base = {
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
            };
            return { ...base, orderKey: makeOrderKey(base) };
        });
}

function shortGender(g: string): string {
    if (g.startsWith("Men")) return "Men's Size";
    if (g.startsWith("Women")) return "Women's Size";
    return g || "-";
}

function shortSize(s: string): string {
    return s.replace(/\s*\(\+.*\)/, "");
}

function shortSleeve(s: string): string {
    return s.replace(" Sleeve", "").replace(/\s*\(\+.*\)/, "");
}

function shortOrderType(o: string): string {
    return o.startsWith("Full Set") ? "Full Set" : o || "-";
}

function colorForCategory(value: string): { bg: string; text: string } {
    if (!value) return { bg: "rgba(0,0,0,0.05)", text: "var(--muted)" };

    const v = value.toLowerCase().trim();
    for (const rule of COLOR_RULES) {
        const matchers = Array.isArray(rule.match) ? rule.match : [rule.match];
        if (matchers.includes(v)) return { bg: rule.bg, text: rule.text };
    }

    for (const rule of COLOR_RULES) {
        const matchers = Array.isArray(rule.match) ? rule.match : [rule.match];
        if (matchers.some(m => v.includes(m))) return { bg: rule.bg, text: rule.text };
    }

    return CATEGORY_PALETTE[hashString(value) % CATEGORY_PALETTE.length];
}

function CategoryBadge({ value }: { value: string }) {
    if (!value) return <span style={{ color: "var(--muted)" }}>-</span>;
    const c = colorForCategory(value);
    return (
        <span className="jd-badge" style={{ background: c.bg, color: c.text }}>
            {value}
        </span>
    );
}

function StatusBadge({ record }: { record: DistributionRecord | undefined }) {
    const pickedUp = Boolean(record?.pickedUp);
    return (
        <span className={`jd-status-badge ${pickedUp ? "is-done" : "is-pending"}`}>
            {pickedUp ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            {pickedUp ? "Picked Up" : "Not Picked Up"}
        </span>
    );
}

function getPreviewDesign(sleeve: string, color: string) {
    if (!sleeve || !color) return null;

    const isLong = sleeve.toLowerCase().includes("long");
    const isNavy = color.toLowerCase().includes("navy") || color.toLowerCase().includes("b");

    if (!isLong && !isNavy) return { label: "Short Sleeve - Broken White", img: "/Image 1.png" };
    if (!isLong && isNavy) return { label: "Short Sleeve - Navy", img: "/Image 2.png" };
    if (isLong && !isNavy) return { label: "Long Sleeve - Broken White", img: "/Image 3.png" };
    if (isLong && isNavy) return { label: "Long Sleeve - Navy", img: "/Image 4.png" };

    return null;
}

function emptyRecord(orderKey: string): DistributionRecord {
    return {
        orderKey,
        pickedUp: false,
        pickedUpAt: null,
        pickedUpBy: null,
        checklist: { ...EMPTY_CHECKLIST },
        photoUrl: null,
        notes: "",
        updatedAt: new Date().toISOString(),
    };
}

function serializeRecords(records: Record<string, DistributionRecord>): DistributionRecord[] {
    return Object.values(records);
}

function recordsFromArray(records: DistributionRecord[]): Record<string, DistributionRecord> {
    return Object.fromEntries(records.map(record => [record.orderKey, record]));
}

function readLocalRecords(): Record<string, DistributionRecord> {
    try {
        const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
        if (!raw) return {};
        return recordsFromArray(JSON.parse(raw) as DistributionRecord[]);
    } catch {
        return {};
    }
}

function writeLocalRecords(records: Record<string, DistributionRecord>) {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(serializeRecords(records)));
    window.dispatchEvent(new Event("jd-distribution-local-sync"));
}

async function loadDistributionRecords(): Promise<Record<string, DistributionRecord>> {
    try {
        const res = await fetch("/api/distribution", { credentials: "include" });
        if (!res.ok) {
            const payload = await res.json().catch(() => null) as { error?: string } | null;
            throw new Error(payload?.error || "Remote distribution API unavailable.");
        }
        const payload = await res.json() as { records?: DistributionRecord[] };
        return recordsFromArray(payload.records ?? []);
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error instanceof Error ? error : new Error("Remote distribution API unavailable.");
        }
        return readLocalRecords();
    }
}

async function saveDistributionRecord(record: DistributionRecord): Promise<DistributionRecord> {
    try {
        const res = await fetch("/api/distribution", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(record),
        });
        if (!res.ok) {
            const payload = await res.json().catch(() => null) as { error?: string } | null;
            throw new Error(payload?.error || "Remote distribution save failed.");
        }
        const payload = await res.json() as { record?: DistributionRecord };
        return payload.record ?? record;
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error instanceof Error ? error : new Error("Remote distribution save failed.");
        }
        const records = readLocalRecords();
        records[record.orderKey] = record;
        writeLocalRecords(records);
        return record;
    }
}

async function uploadPhoto(orderKey: string, dataUrl: string): Promise<string> {
    try {
        const res = await fetch("/api/upload-photo", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderKey, image: dataUrl }),
        });
        if (!res.ok) throw new Error("Photo upload failed.");
        const payload = await res.json() as { url?: string };
        return payload.url ?? dataUrl;
    } catch (error) {
        if (!LOCAL_FALLBACK_ENABLED) {
            throw error instanceof Error ? error : new Error("Photo upload failed.");
        }
        return dataUrl;
    }
}

async function loginAdmin(code: string): Promise<AdminSession> {
    const trimmed = code.trim();
    try {
        const res = await fetch("/api/admin-login", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "x-admin-code": trimmed,
            },
            body: JSON.stringify({ code: trimmed }),
        });
        if (!res.ok) throw new Error("Invalid access code.");
        const payload = await res.json() as { session?: AdminSession };
        if (!payload.session) throw new Error("Session tidak tersedia.");
        return payload.session;
    } catch (error) {
        const fallbackCode = import.meta.env.VITE_ADMIN_CODE || "scimutdanlucu";
        if (LOCAL_FALLBACK_ENABLED && trimmed === fallbackCode) {
            return { name: "Committee", codeLabel: "local", loginAt: new Date().toISOString() };
        }
        throw error instanceof Error ? error : new Error("Invalid access code.");
    }
}

async function logoutAdmin() {
    try {
        await fetch("/api/admin-logout", { method: "POST", credentials: "include" });
    } catch {
        return;
    }
}

function formatPickedUp(record: DistributionRecord | undefined): string {
    if (!record?.pickedUpAt) return "No pickup time yet";
    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(record.pickedUpAt));
}

function allChecked(checklist: DistributionChecklist): boolean {
    return Object.values(checklist).every(Boolean);
}

export default function JerseyDashboard() {
    const [orders, setOrders] = useState<JerseyOrder[]>([]);
    const [records, setRecords] = useState<Record<string, DistributionRecord>>({});
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [error, setError] = useState<string>("");
    const [distributionError, setDistributionError] = useState("");
    const [search, setSearch] = useState("");
    const [sessionFilter, setSessionFilter] = useState("All");
    const [orderTypeFilter, setOrderTypeFilter] = useState("All");
    const [genderFilter, setGenderFilter] = useState("All");
    const [sizeFilter, setSizeFilter] = useState("All");
    const [sleeveFilter, setSleeveFilter] = useState("All");
    const [colorFilter, setColorFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
    const [sortKey, setSortKey] = useState<SortKey>("id");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [showSizeChart, setShowSizeChart] = useState(false);
    const [previewItem, setPreviewItem] = useState<JerseyOrder | null>(null);
    const [adminLoginOpen, setAdminLoginOpen] = useState(false);
    const [adminCode, setAdminCode] = useState("");
    const [adminError, setAdminError] = useState("");
    const [adminSession, setAdminSession] = useState<AdminSession | null>(() => {
        try {
            const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
            return raw ? JSON.parse(raw) as AdminSession : null;
        } catch {
            return null;
        }
    });
    const [selectedOrder, setSelectedOrder] = useState<JerseyOrder | null>(null);
    const [lastSelectedOrderKey, setLastSelectedOrderKey] = useState<string | null>(null);
    const [draftChecklist, setDraftChecklist] = useState<DistributionChecklist>({ ...EMPTY_CHECKLIST });
    const [detailsConfirmed, setDetailsConfirmed] = useState(false);
    const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState("");
    const [cameraActive, setCameraActive] = useState(false);
    const [photoCountdown, setPhotoCountdown] = useState(0);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [saveError, setSaveError] = useState("");
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const broadcastRef = useRef<BroadcastChannel | null>(null);
    const countdownTimersRef = useRef<number[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoadState("loading");
            setError("");
            setDistributionError("");
            try {
                const res = await fetch(DATA_PATH);
                if (!res.ok) throw new Error(`File not found at ${DATA_PATH} (status ${res.status}).`);
                const buffer = await res.arrayBuffer();
                const xlsx = await import("xlsx");
                const ordersResult = parseWorkbookToOrders(xlsx.read(buffer, { type: "array" }), xlsx.utils);
                let recordsResult: Record<string, DistributionRecord> = {};

                try {
                    recordsResult = await loadDistributionRecords();
                } catch (syncError) {
                    setDistributionError(syncError instanceof Error ? syncError.message : "Distribution sync unavailable.");
                }

                if (!cancelled) {
                    setOrders(ordersResult);
                    setRecords(recordsResult);
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

    useEffect(() => {
        const sync = async () => {
            try {
                setRecords(await loadDistributionRecords());
                setDistributionError("");
            } catch (syncError) {
                setDistributionError(syncError instanceof Error ? syncError.message : "Distribution sync unavailable.");
            }
        };
        const timer = window.setInterval(sync, 5000);
        window.addEventListener("storage", sync);
        window.addEventListener("jd-distribution-local-sync", sync);

        if ("BroadcastChannel" in window) {
            broadcastRef.current = new BroadcastChannel(CHANNEL_NAME);
            broadcastRef.current.onmessage = sync;
        }

        return () => {
            window.clearInterval(timer);
            window.removeEventListener("storage", sync);
            window.removeEventListener("jd-distribution-local-sync", sync);
            broadcastRef.current?.close();
            countdownTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const isShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "d";
            if (isShortcut) {
                event.preventDefault();
                setAdminLoginOpen(true);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useEffect(() => {
        if (!selectedOrder) return;
        const record = records[selectedOrder.orderKey] ?? emptyRecord(selectedOrder.orderKey);
        const changedSelection = lastSelectedOrderKey !== selectedOrder.orderKey;
        const savedRecordChanged = Boolean(record.pickedUp);

        if (changedSelection || savedRecordChanged) {
            setDraftChecklist({ ...record.checklist });
            setDetailsConfirmed(allChecked(record.checklist));
            setPhotoDataUrl(record.photoUrl);
            setSaveState("idle");
            setSaveError("");
            setLastSelectedOrderKey(selectedOrder.orderKey);
        }
    }, [lastSelectedOrderKey, records, selectedOrder]);

    useEffect(() => {
        if (!cameraActive || !videoRef.current || !streamRef.current) return;
        videoRef.current.srcObject = streamRef.current;
    }, [cameraActive]);

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
        setStatusFilter("All");
    }

    async function handleAdminLogin(event: FormEvent) {
        event.preventDefault();
        setAdminError("");
        try {
            const session = await loginAdmin(adminCode);
            setAdminSession(session);
            localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(session));
            setAdminLoginOpen(false);
            setAdminCode("");
        } catch (e) {
            setAdminError(e instanceof Error ? e.message : "Invalid access code.");
        }
    }

    async function handleLogout() {
        await logoutAdmin();
        setAdminSession(null);
        setSelectedOrder(null);
        setLastSelectedOrderKey(null);
        localStorage.removeItem(ADMIN_STORAGE_KEY);
    }

    async function startCamera(): Promise<boolean> {
        setCameraError("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            streamRef.current = stream;
            setCameraActive(true);
            if (videoRef.current) videoRef.current.srcObject = stream;
            return true;
        } catch {
            setCameraError("Camera access failed. Please allow camera permission in your browser.");
            return false;
        }
    }

    function clearPhotoCountdown() {
        countdownTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
        countdownTimersRef.current = [];
        setPhotoCountdown(0);
    }

    function stopCamera() {
        clearPhotoCountdown();
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setCameraActive(false);
    }

    function takeSnapshot() {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        const maxWidth = 900;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.72));
        stopCamera();
    }

    function capturePhoto() {
        if (!videoRef.current || photoCountdown > 0) return;
        clearPhotoCountdown();
        setPhotoCountdown(3);
        countdownTimersRef.current = [
            window.setTimeout(() => setPhotoCountdown(2), 1000),
            window.setTimeout(() => setPhotoCountdown(1), 2000),
            window.setTimeout(() => {
                setPhotoCountdown(0);
                takeSnapshot();
            }, 3000),
        ];
    }

    async function retakePhoto() {
        const previousPhoto = photoDataUrl;
        setPhotoDataUrl(null);
        const opened = await startCamera();
        if (!opened) setPhotoDataUrl(previousPhoto);
    }

    async function markPickedUp() {
        if (!selectedOrder || !adminSession) return;
        setSaveState("saving");
        setSaveError("");

        try {
            const existing = records[selectedOrder.orderKey];
            if (existing?.pickedUp && existing.pickedUpAt) {
                setSaveState("error");
                setSaveError(`This learner was already marked by ${existing.pickedUpBy ?? "an admin"} at ${formatPickedUp(existing)}.`);
                return;
            }

            const photoUrl = photoDataUrl?.startsWith("data:")
                ? await uploadPhoto(selectedOrder.orderKey, photoDataUrl)
                : photoDataUrl;

            const record: DistributionRecord = {
                orderKey: selectedOrder.orderKey,
                pickedUp: true,
                pickedUpAt: new Date().toISOString(),
                pickedUpBy: adminSession.name,
                checklist: draftChecklist,
                photoUrl: photoUrl ?? null,
                notes: "",
                updatedAt: new Date().toISOString(),
            };

            const saved = await saveDistributionRecord(record);
            setRecords(prev => {
                const next = { ...prev, [saved.orderKey]: saved };
                writeLocalRecords(next);
                return next;
            });
            broadcastRef.current?.postMessage({ type: "record-updated", orderKey: saved.orderKey });
            setPhotoDataUrl(saved.photoUrl);
            setSaveState("saved");
        } catch (e) {
            setSaveState("error");
            setSaveError(e instanceof Error ? e.message : "Failed to save distribution status.");
        }
    }

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
            const record = records[d.orderKey];
            if (sessionFilter !== "All" && d.session !== sessionFilter) return false;
            if (orderTypeFilter !== "All" && d.orderType !== orderTypeFilter) return false;
            if (genderFilter !== "All" && d.gender !== genderFilter) return false;
            if (sizeFilter !== "All" && shortSize(d.size) !== sizeFilter) return false;
            if (sleeveFilter !== "All" && shortSleeve(d.sleeve) !== sleeveFilter) return false;
            if (colorFilter !== "All" && d.color !== colorFilter) return false;
            if (statusFilter === "PickedUp" && !record?.pickedUp) return false;
            if (statusFilter === "Pending" && record?.pickedUp) return false;
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
    }, [orders, records, search, sessionFilter, orderTypeFilter, genderFilter, sizeFilter, sleeveFilter, colorFilter, statusFilter, sortKey, sortDir]);

    const activeFilterCount =
        [sessionFilter, orderTypeFilter, genderFilter, sizeFilter, sleeveFilter, colorFilter, statusFilter].filter(v => v !== "All").length +
        (search.trim() ? 1 : 0);

    const stats = useMemo(() => {
        const total = orders.length;
        const pickedUp = orders.filter(order => records[order.orderKey]?.pickedUp).length;
        return { total, pickedUp, pending: total - pickedUp };
    }, [orders, records]);

    const activePreview = previewItem ? getPreviewDesign(previewItem.sleeve, previewItem.color) : null;
    const selectedRecord = selectedOrder ? records[selectedOrder.orderKey] : undefined;
    const selectedPreview = selectedOrder ? getPreviewDesign(selectedOrder.sleeve, selectedOrder.color) : null;
    const canSubmit = Boolean(selectedOrder && adminSession && detailsConfirmed && photoDataUrl && !selectedRecord?.pickedUp);

    return (
        <div className={`jd-container ${adminSession ? "jd-admin-mode" : ""}`}>
            <div className="jd-bg" />

            <div className="jd-wrap">
                {loadState === "loading" && (
                    <div className="jd-glass jd-state"></div>
                )}

                {loadState === "error" && (
                    <div className="jd-glass jd-error">
                        <div className="jd-error-title">
                            <AlertCircle size={15} /> Couldn't read the file
                        </div>
                        <div>{error}</div>
                    </div>
                )}

                {loadState === "ready" && (
                    <>
                        <div className="jd-topbar">
                            <div>
                                <div className="jd-title">Jersey Distribution</div>
                                <div className="jd-subtitle">
                                    {stats.pickedUp} picked up, {stats.pending} pending from {stats.total} learners
                                </div>
                            </div>
                            {adminSession ? (
                                <div className="jd-admin-pill">
                                    <ShieldCheck size={15} />
                                    {adminSession.name}
                                    <button type="button" onClick={handleLogout} title="Logout admin">
                                        <LogOut size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button className="jd-hidden-access" onClick={() => setAdminLoginOpen(true)} title="Admin access">
                                    <LockKeyhole size={14} />
                                </button>
                            )}
                        </div>

                        <div className="jd-glass jd-toolbar">
                            <div className="jd-search">
                                <Search size={14} />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search learner, back name, number..." />
                            </div>

                            <select className="jd-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
                                <option value="All">All Statuses</option>
                                <option value="PickedUp">Picked Up</option>
                                <option value="Pending">Not Picked Up</option>
                            </select>
                            <select className="jd-select" value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}>
                                {sessions.map(s => <option key={s} value={s}>{s === "All" ? "All Sessions" : s}</option>)}
                            </select>
                            <select className="jd-select" value={orderTypeFilter} onChange={e => setOrderTypeFilter(e.target.value)}>
                                {orderTypes.map(s => <option key={s} value={s}>{s === "All" ? "All Order Types" : s}</option>)}
                            </select>
                            <select className="jd-select" value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
                                {genders.map(s => <option key={s} value={s}>{s === "All" ? "All Size Types" : shortGender(s)}</option>)}
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
                                <button className="jd-btn" onClick={resetFilters} style={{ background: "#fff" }}>
                                    <X size={12} /> Reset ({activeFilterCount})
                                </button>
                            )}
                        </div>

                        <div className="jd-count">
                            <strong>{filtered.length}</strong> of {stats.total} learners
                        </div>

                        {distributionError && (
                            <div className="jd-sync-warning">
                                <AlertCircle size={15} />
                                <span>Distribution sync is offline: {distributionError}</span>
                            </div>
                        )}

                        <div className={adminSession && selectedOrder ? "jd-layout is-panel-open" : "jd-layout"}>
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
                                                <th style={{ minWidth: 140 }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody onMouseLeave={() => setPreviewItem(null)}>
                                            {filtered.map(d => (
                                                <tr
                                                    key={d.orderKey}
                                                    className={`${selectedOrder?.orderKey === d.orderKey ? "is-selected" : ""} ${records[d.orderKey]?.pickedUp ? "is-picked-up" : ""}`}
                                                    onMouseEnter={() => setPreviewItem(d)}
                                                    onClick={() => adminSession ? setSelectedOrder(d) : setPreviewItem(d)}
                                                >
                                                    <td>{d.id}</td>
                                                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                                                    <td><CategoryBadge value={d.session} /></td>
                                                    <td>{d.backName || "-"}</td>
                                                    <td className="jd-mono">{d.jerseyNumber || "-"}</td>
                                                    <td><CategoryBadge value={shortOrderType(d.orderType)} /></td>
                                                    <td><CategoryBadge value={shortGender(d.gender)} /></td>
                                                    <td><CategoryBadge value={shortSize(d.size)} /></td>
                                                    <td><CategoryBadge value={shortSleeve(d.sleeve)} /></td>
                                                    <td><CategoryBadge value={d.color} /></td>
                                                    <td><StatusBadge record={records[d.orderKey]} /></td>
                                                </tr>
                                            ))}
                                            {filtered.length === 0 && (
                                                <tr>
                                                    <td colSpan={COLUMNS.length + 1} style={{ textAlign: "center", padding: "36px 0", color: "var(--muted)" }}>
                                                        No matching learners.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="jd-cards" onMouseLeave={() => setPreviewItem(null)}>
                                    {filtered.map(d => (
                                        <button className={`jd-card ${records[d.orderKey]?.pickedUp ? "is-picked-up" : ""}`} key={d.orderKey} onClick={() => adminSession ? setSelectedOrder(d) : setPreviewItem(d)}>
                                            <div className="jd-card-top">
                                                <div>
                                                    <div className="jd-card-name">{d.name}</div>
                                                    {d.backName && <div className="jd-card-backname">{d.backName}</div>}
                                                </div>
                                                <span className="jd-card-num">{d.jerseyNumber || "-"}</span>
                                            </div>
                                            <div className="jd-card-status"><StatusBadge record={records[d.orderKey]} /></div>
                                            <div className="jd-card-grid">
                                                <div className="jd-card-grid-item"><label>Session</label><CategoryBadge value={d.session} /></div>
                                                <div className="jd-card-grid-item"><label>Order</label><CategoryBadge value={shortOrderType(d.orderType)} /></div>
                                                <div className="jd-card-grid-item"><label>Size Type</label><CategoryBadge value={shortGender(d.gender)} /></div>
                                                <div className="jd-card-grid-item"><label>Size</label><CategoryBadge value={shortSize(d.size)} /></div>
                                                <div className="jd-card-grid-item"><label>Sleeve</label><CategoryBadge value={shortSleeve(d.sleeve)} /></div>
                                                <div className="jd-card-grid-item"><label>Color</label><CategoryBadge value={d.color} /></div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {adminSession && selectedOrder && (
                                <aside className="jd-admin-panel jd-glass">
                                    <>
                                        <div className="jd-panel-head">
                                            <div>
                                                <div className="jd-panel-name">{selectedOrder.name}</div>
                                                <div className="jd-panel-meta">
                                                    #{selectedOrder.id} - {selectedOrder.session} - {selectedOrder.jerseyNumber || "No Number"}
                                                </div>
                                            </div>
                                            <button
                                                className="jd-icon-btn"
                                                onClick={() => {
                                                    setSelectedOrder(null);
                                                    setLastSelectedOrderKey(null);
                                                }}
                                                title="Close panel"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>

                                        {selectedPreview && (
                                            <div className="jd-admin-preview">
                                                <img src={selectedPreview.img} alt={selectedPreview.label} />
                                                <span>{selectedPreview.label}</span>
                                                <StatusBadge record={selectedRecord} />
                                            </div>
                                        )}
                                        {selectedRecord?.pickedUp && (
                                            <div className="jd-panel-status">
                                                <span>by {selectedRecord.pickedUpBy ?? "admin"} - {formatPickedUp(selectedRecord)}</span>
                                            </div>
                                        )}

                                        <div className="jd-detail-list">
                                            <DetailPin icon="learner" label="Learner Name" value={selectedOrder.name} />
                                            <DetailPin icon="signature" label="Back Name" value={selectedOrder.backName || "-"} />
                                            <DetailPin icon="number" label="Jersey Number" value={selectedOrder.jerseyNumber || "-"} />
                                            <DetailPin icon="tag" label="Order Type" value={shortOrderType(selectedOrder.orderType)} />
                                            <DetailPin icon="ruler" label="Size" value={`${shortGender(selectedOrder.gender)} / ${shortSize(selectedOrder.size)}`} />
                                            <DetailPin icon="shirt" label="Sleeve" value={shortSleeve(selectedOrder.sleeve)} />
                                            <DetailPin icon="palette" label="Color" value={selectedOrder.color} />
                                        </div>

                                        <label className={`jd-confirm-box ${detailsConfirmed ? "is-checked" : ""} ${selectedRecord?.pickedUp ? "is-locked" : ""}`}>
                                            <input
                                                type="checkbox"
                                                checked={detailsConfirmed}
                                                disabled={selectedRecord?.pickedUp}
                                                onChange={e => {
                                                    const checked = e.target.checked;
                                                    setDetailsConfirmed(checked);
                                                    setDraftChecklist({
                                                        name: checked,
                                                        backName: checked,
                                                        jerseyNumber: checked,
                                                        orderType: checked,
                                                        size: checked,
                                                        sleeve: checked,
                                                        color: checked,
                                                    });
                                                }}
                                            />
                                            <span>
                                                <strong>All details above match</strong>
                                                <em>Learner, jersey specs, and order details have been verified.</em>
                                            </span>
                                            <CheckCircle2 size={24} />
                                        </label>

                                        <div className="jd-camera-box">
                                            {photoDataUrl ? (
                                                <img src={photoDataUrl} alt="Pickup proof" />
                                            ) : cameraActive ? (
                                                <video ref={videoRef} autoPlay playsInline muted />
                                            ) : selectedRecord?.pickedUp ? (
                                                <div className="jd-camera-empty is-locked">
                                                    <Camera size={24} />
                                                    <span>No pickup photo</span>
                                                </div>
                                            ) : (
                                                <button className="jd-camera-empty" type="button" onClick={startCamera}>
                                                    <Camera size={24} />
                                                    <span>Learner photo holding the jersey</span>
                                                    <strong>Open Camera</strong>
                                                </button>
                                            )}
                                            {cameraActive && !selectedRecord?.pickedUp && (
                                                <div className="jd-camera-overlay">
                                                    <button className="jd-photo-icon is-primary" type="button" onClick={capturePhoto} title="Take photo" disabled={photoCountdown > 0}>
                                                        <Camera size={17} />
                                                    </button>
                                                    <button className="jd-photo-icon" type="button" onClick={stopCamera} title="Cancel" disabled={photoCountdown > 0}>
                                                        <XCircle size={17} />
                                                    </button>
                                                </div>
                                            )}
                                            {photoCountdown > 0 && (
                                                <div className="jd-countdown" aria-live="polite">
                                                    {photoCountdown}
                                                </div>
                                            )}
                                            {photoDataUrl && !cameraActive && !selectedRecord?.pickedUp && (
                                                <div className="jd-camera-overlay">
                                                    <button className="jd-photo-icon" type="button" onClick={retakePhoto} title="Retake photo">
                                                        <RefreshCcw size={17} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {cameraError && <div className="jd-inline-error">{cameraError}</div>}

                                        {!selectedRecord?.pickedUp && (
                                            <button className="jd-submit" disabled={!canSubmit || saveState === "saving"} onClick={markPickedUp}>
                                                {saveState === "saving" ? <Loader2 size={16} className="jd-spin" /> : <Upload size={16} />}
                                                Mark as Picked Up
                                            </button>
                                        )}

                                        {!selectedRecord?.pickedUp && (
                                            <div className="jd-requirements">
                                                <span className={detailsConfirmed ? "is-met" : ""}>
                                                    <CheckCircle2 size={14} /> Details checked
                                                </span>
                                                <span className={photoDataUrl ? "is-met" : ""}>
                                                    <Camera size={14} /> Photo captured
                                                </span>
                                            </div>
                                        )}
                                        {saveState === "saved" && <div className="jd-inline-success">Status saved and synced.</div>}
                                        {saveState === "error" && saveError && <div className="jd-inline-error">{saveError}</div>}
                                    </>
                                </aside>
                            )}
                        </div>
                    </>
                )}
            </div>

            {activePreview && !selectedOrder && (
                <div className="jd-preview-float">
                    <img src={activePreview.img} alt={activePreview.label} />
                    <div>
                        <div className="jd-p-title">{activePreview.label}</div>
                        <div className="jd-p-sub">
                            {previewItem?.name} - {previewItem?.jerseyNumber || "No Num"} - {previewItem?.size ? shortSize(previewItem.size) : "No Size"}
                        </div>
                    </div>
                </div>
            )}

            {adminLoginOpen && (
                <div className="jd-modal-overlay" onClick={() => setAdminLoginOpen(false)}>
                    <form className="jd-access-modal" onSubmit={handleAdminLogin} onClick={e => e.stopPropagation()}>
                        <div className="jd-modal-title">
                            <LockKeyhole size={20} className="jd-accent" /> Distribution Access
                        </div>
                        <p>Enter the committee access code to open the distribution dashboard.</p>
                        <input
                            autoFocus
                            value={adminCode}
                            onChange={e => setAdminCode(e.target.value)}
                            placeholder="Access code"
                            type="password"
                        />
                        {adminError && <div className="jd-inline-error">{adminError}</div>}
                        <div className="jd-access-actions">
                            <button type="button" className="jd-btn" onClick={() => setAdminLoginOpen(false)} style={{ background: "#fff" }}>
                                Cancel
                            </button>
                            <button type="submit" className="jd-submit">
                                <ShieldCheck size={16} /> Enter
                            </button>
                        </div>
                    </form>
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
                            <SizeTable title="Men's Size" rows={SIZE_CHART_MEN} tableClass="jd-male-table" />
                            <SizeTable title="Women's Size" rows={SIZE_CHART_WOMEN} tableClass="jd-female-table" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

type DetailIcon = "learner" | "signature" | "number" | "tag" | "ruler" | "shirt" | "palette";

function DetailPin({ icon, label, value }: { icon: DetailIcon; label: string; value: string }) {
    const Icon = {
        learner: UserRound,
        signature: Signature,
        number: Hash,
        tag: Tag,
        ruler: Ruler,
        shirt: Shirt,
        palette: Palette,
    }[icon];

    return (
        <div className="jd-detail-item">
            <Icon size={15} />
            <span>
                <strong>{label}</strong>
                <em>{value}</em>
            </span>
        </div>
    );
}

function SizeTable({ title, rows, tableClass }: { title: string; rows: { size: string; lebar: number; panjang: number }[]; tableClass: string }) {
    return (
        <div className="jd-size-table-wrap">
            <h4>{title}</h4>
            <table className={`jd-size-table ${tableClass}`}>
                <thead>
                    <tr>
                        <th>SIZE</th>
                        <th>WIDTH</th>
                        <th>LENGTH</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr key={row.size}>
                            <td>{row.size}</td>
                            <td>{row.lebar}</td>
                            <td>{row.panjang}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

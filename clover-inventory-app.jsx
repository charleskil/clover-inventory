import { useState, useEffect, useRef, useCallback } from "react";

// ── Clover API helpers ──────────────────────────────────────────────────────
const cloverFetch = async (path, opts = {}, cfg) => {
  const base = cfg.sandbox
    ? "https://sandbox.dev.clover.com"
    : "https://api.clover.com";
  const url = `${base}/v3/merchants/${cfg.merchantId}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Clover API error: ${res.status}`);
  return res.json();
};

// ── Seed mock data (offline demo) ──────────────────────────────────────────
const MOCK_VENDORS = [
  { id: "ven1", name: "Fresh Farms Co.", contact: "John Smith", phone: "604-555-0101", email: "orders@freshfarms.com", note: "월/수/금 배달" },
  { id: "ven2", name: "Metro Wholesale", contact: "Amy Lee", phone: "604-555-0202", email: "amy@metrowholesale.com", note: "화/목 배달" },
  { id: "ven3", name: "Dairy Direct", contact: "Mike Chen", phone: "604-555-0303", email: "mike@dairydirect.ca", note: "매일 새벽 배달" },
];

const MOCK_CATEGORIES = [
  { id: "cat1", name: "Beverages" },
  { id: "cat2", name: "Dairy" },
  { id: "cat3", name: "Bakery" },
  { id: "cat4", name: "Produce" },
];

const MOCK_ITEMS = [
  {
    id: "itm1", name: "Whole Milk 1L", sku: "MLK001", price: 3.99,
    cost: 2.10, quantity: 42, categoryId: "cat2",
    expiryDate: "2025-03-10", barcode: "1234567890",
    salesHistory: [
      { date: "2025-02-01", qty: 8, revenue: 31.92 },
      { date: "2025-02-10", qty: 12, revenue: 47.88 },
      { date: "2025-02-20", qty: 6, revenue: 23.94 },
    ],
    costHistory: [{ date: "2025-01-15", cost: 2.00 }, { date: "2025-02-01", cost: 2.10 }],
    deliveryHistory: [
      { id: "d1", date: "2025-01-15", qty: 48, vendorId: "ven3", unitCost: 2.00, totalCost: 96.00, note: "정기 입고" },
      { id: "d2", date: "2025-02-01", qty: 36, vendorId: "ven3", unitCost: 2.10, totalCost: 75.60, note: "" },
    ],
  },
  {
    id: "itm2", name: "Sourdough Bread", sku: "BRD002", price: 6.50,
    cost: 3.20, quantity: 15, categoryId: "cat3",
    expiryDate: "2025-02-28", barcode: "9876543210",
    salesHistory: [
      { date: "2025-02-05", qty: 5, revenue: 32.50 },
      { date: "2025-02-15", qty: 9, revenue: 58.50 },
    ],
    costHistory: [{ date: "2025-02-01", cost: 3.20 }],
    deliveryHistory: [
      { id: "d3", date: "2025-02-01", qty: 20, vendorId: "ven1", unitCost: 3.20, totalCost: 64.00, note: "화요일 정기" },
    ],
  },
  {
    id: "itm3", name: "Orange Juice 500ml", sku: "OJ003", price: 4.25,
    cost: 1.90, quantity: 60, categoryId: "cat1",
    expiryDate: "2025-04-15", barcode: "1122334455",
    salesHistory: [
      { date: "2025-02-08", qty: 20, revenue: 85.00 },
      { date: "2025-02-18", qty: 15, revenue: 63.75 },
    ],
    costHistory: [{ date: "2025-01-10", cost: 1.80 }, { date: "2025-02-05", cost: 1.90 }],
    deliveryHistory: [
      { id: "d4", date: "2025-01-10", qty: 72, vendorId: "ven2", unitCost: 1.80, totalCost: 129.60, note: "케이스 6개" },
      { id: "d5", date: "2025-02-05", qty: 48, vendorId: "ven2", unitCost: 1.90, totalCost: 91.20, note: "" },
    ],
  },
  {
    id: "itm4", name: "Cherry Tomatoes 250g", sku: "TOM004", price: 2.99,
    cost: 1.40, quantity: 30, categoryId: "cat4",
    expiryDate: "2025-02-27", barcode: "5544332211",
    salesHistory: [{ date: "2025-02-20", qty: 10, revenue: 29.90 }],
    costHistory: [{ date: "2025-02-01", cost: 1.40 }],
    deliveryHistory: [
      { id: "d6", date: "2025-02-20", qty: 40, vendorId: "ven1", unitCost: 1.40, totalCost: 56.00, note: "신선 농산물" },
    ],
  },
];

// ── Utility functions ────────────────────────────────────────────────────────
const avgCost = (item) => {
  if (!item.costHistory?.length) return item.cost;
  const sum = item.costHistory.reduce((a, b) => a + b.cost, 0);
  return sum / item.costHistory.length;
};

const daysUntilExpiry = (date) => {
  const diff = new Date(date) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const expiryStatus = (date) => {
  const d = daysUntilExpiry(date);
  if (d < 0) return "expired";
  if (d <= 3) return "critical";
  if (d <= 7) return "warning";
  return "ok";
};

const fmt = (n) => `$${Number(n).toFixed(2)}`;

// ── Icons (inline SVG) ────────────────────────────────────────────────────
const Icon = ({ name, size = 18 }) => {
  const icons = {
    package: <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>,
    barcode: <><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></>,
    category: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    trend: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
    alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    dollar: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    truck: <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    vendor: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    inbox: <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ── Main App ────────────────────────────────────────────────────────────────
export default function CloverInventoryApp() {
  const [config, setConfig] = useState({ token: "", merchantId: "", sandbox: true });
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [activeTab, setActiveTab] = useState("inventory");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterExpiry, setFilterExpiry] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("name");

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [notification, setNotification] = useState(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshSec, setRefreshSec] = useState(30);
  const [countdown, setCountdown] = useState(30);
  const autoRefreshRef = useRef(null);
  const countdownRef = useRef(null);

  const barcodeRef = useRef(null);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Sync with Clover ──────────────────────────────────────────────────────
  const syncData = useCallback(async (silent = false) => {
    if (demoMode) {
      if (!silent) notify("데모 모드에서는 실제 동기화가 없습니다", "warning");
      setLastSynced(new Date());
      return;
    }
    setSyncing(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        cloverFetch("/items?limit=200&expand=categories", {}, config),
        cloverFetch("/categories?limit=100", {}, config),
      ]);
      // Merge: keep local delivery/cost/sales history, update qty & price from Clover
      setItems(prev => {
        const cloverItems = itemsRes.elements || [];
        return cloverItems.map(ci => {
          const existing = prev.find(p => p.id === ci.id);
          return existing
            ? { ...existing, quantity: ci.quantity ?? existing.quantity, price: ci.price ? ci.price / 100 : existing.price, name: ci.name }
            : { ...ci, price: ci.price ? ci.price / 100 : 0, salesHistory: [], deliveryHistory: [], costHistory: [] };
        });
      });
      setCategories(catsRes.elements || []);
      setLastSynced(new Date());
      if (!silent) notify("✅ Clover와 동기화 완료!");
    } catch (e) {
      if (!silent) notify(`동기화 실패: ${e.message}`, "error");
    }
    setSyncing(false);
  }, [config, demoMode]);

  // Auto-refresh effect
  useEffect(() => {
    if (!connected || !autoRefresh) {
      clearInterval(autoRefreshRef.current);
      clearInterval(countdownRef.current);
      return;
    }
    setCountdown(refreshSec);
    autoRefreshRef.current = setInterval(() => {
      syncData(true);
      setCountdown(refreshSec);
    }, refreshSec * 1000);
    countdownRef.current = setInterval(() => {
      setCountdown(c => c <= 1 ? refreshSec : c - 1);
    }, 1000);
    return () => {
      clearInterval(autoRefreshRef.current);
      clearInterval(countdownRef.current);
    };
  }, [connected, autoRefresh, refreshSec, syncData]);

  // Reset countdown when interval changes
  useEffect(() => { setCountdown(refreshSec); }, [refreshSec]);

  // Connect to Clover
  const connectClover = async () => {
    setLoading(true);
    try {
      const data = await cloverFetch("/items?limit=200&expand=categories", {}, config);
      const cats = await cloverFetch("/categories?limit=100", {}, config);
      setItems((data.elements || []).map(i => ({
        ...i, price: i.price ? i.price / 100 : 0,
        salesHistory: [], deliveryHistory: [], costHistory: []
      })));
      setCategories(cats.elements || []);
      setConnected(true);
      setLastSynced(new Date());
      notify("Clover에 성공적으로 연결되었습니다!");
    } catch (e) {
      notify(`연결 실패: ${e.message}`, "error");
    }
    setLoading(false);
  };

  const loadDemo = () => {
    setItems(MOCK_ITEMS);
    setCategories(MOCK_CATEGORIES);
    setVendors(MOCK_VENDORS);
    setDemoMode(true);
    setConnected(true);
    setLastSynced(new Date());
    notify("데모 모드로 시작합니다 🎉");
  };

  // CRUD
  const openAdd = () => {
    setForm({ name: "", sku: "", price: "", cost: "", quantity: "", categoryId: "", expiryDate: "", barcode: "", casePrice: "", caseQty: "" });
    setModal({ type: "add" });
  };
  const openEdit = (item) => { setForm({ ...item }); setModal({ type: "edit", item }); };
  const openStock = (item) => { setForm({ qty: 0, note: "" }); setModal({ type: "stock", item }); };
  const openSale = (item) => { setForm({ qty: 1, date: new Date().toISOString().split("T")[0] }); setModal({ type: "sale", item }); };
  const openDetail = (item) => setModal({ type: "detail", item });

  const saveItem = () => {
    if (!form.name || !form.price) return notify("상품명과 가격은 필수입니다", "error");
    const newItem = {
      ...form,
      id: modal.item?.id || `itm${Date.now()}`,
      price: parseFloat(form.price),
      cost: parseFloat(form.cost) || 0,
      quantity: parseInt(form.quantity) || 0,
      salesHistory: modal.item?.salesHistory || [],
      deliveryHistory: modal.item?.deliveryHistory || [],
      costHistory: modal.item?.costHistory || [{ date: new Date().toISOString().split("T")[0], cost: parseFloat(form.cost) || 0, casePrice: parseFloat(form.casePrice) || null, caseQty: parseInt(form.caseQty) || null }],
    };
    if (modal.type === "add") {
      setItems((p) => [...p, newItem]);
      notify("상품이 추가되었습니다 ✓");
    } else {
      setItems((p) => p.map((i) => (i.id === newItem.id ? newItem : i)));
      notify("상품이 수정되었습니다 ✓");
    }
    setModal(null);
  };

  const deleteItem = (id) => {
    setItems((p) => p.filter((i) => i.id !== id));
    setModal(null);
    notify("상품이 삭제되었습니다");
  };

  const openDelivery = (item) => {
    setForm({
      date: new Date().toISOString().split("T")[0],
      qty: "",
      vendorId: item.deliveryHistory?.slice(-1)[0]?.vendorId || "",
      unitCost: item.cost || "",
      casePrice: "",
      caseQty: "",
      note: "",
    });
    setModal({ type: "delivery", item });
  };

  const recordDelivery = () => {
    const qty = parseInt(form.qty);
    if (!qty || qty <= 0) return notify("수량을 입력해주세요", "error");
    const unitCost = parseFloat(form.unitCost) || 0;
    const record = {
      id: `d${Date.now()}`,
      date: form.date,
      qty,
      vendorId: form.vendorId || "",
      unitCost,
      totalCost: unitCost * qty,
      note: form.note || "",
    };
    setItems((p) =>
      p.map((i) => {
        if (i.id !== modal.item.id) return i;
        const newCostEntry = unitCost > 0 ? [{ date: form.date, cost: unitCost, casePrice: parseFloat(form.casePrice) || null, caseQty: parseInt(form.caseQty) || null }] : [];
        return {
          ...i,
          quantity: i.quantity + qty,
          cost: unitCost > 0 ? unitCost : i.cost,
          deliveryHistory: [...(i.deliveryHistory || []), record],
          costHistory: unitCost > 0 ? [...(i.costHistory || []), ...newCostEntry] : i.costHistory,
        };
      })
    );
    notify(`✅ ${qty}개 입고 기록 완료`);
    setModal(null);
  };
    const qty = parseInt(form.qty);
    setItems((p) =>
      p.map((i) =>
        i.id === modal.item.id ? { ...i, quantity: Math.max(0, i.quantity + qty) } : i
      )
    );
    notify(`재고가 ${qty > 0 ? "+" : ""}${qty} 조정되었습니다`);
    setModal(null);
  };

  const recordSale = () => {
    const qty = parseInt(form.qty);
    const date = form.date;
    setItems((p) =>
      p.map((i) => {
        if (i.id !== modal.item.id) return i;
        return {
          ...i,
          quantity: Math.max(0, i.quantity - qty),
          salesHistory: [...(i.salesHistory || []), { date, qty, revenue: qty * i.price }],
        };
      })
    );
    notify(`판매 ${qty}개가 기록되었습니다 ✓`);
    setModal(null);
  };

  // Filters
  const filtered = items
    .filter((i) => {
      if (search && !i.name.toLowerCase().includes(search.toLowerCase()) &&
          !i.sku?.toLowerCase().includes(search.toLowerCase()) &&
          !i.barcode?.includes(search)) return false;
      if (filterCat !== "all" && i.categoryId !== filterCat) return false;
      if (filterExpiry !== "all") {
        const s = expiryStatus(i.expiryDate);
        if (filterExpiry === "expiring" && !["critical", "warning"].includes(s)) return false;
        if (filterExpiry === "expired" && s !== "expired") return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "qty") return b.quantity - a.quantity;
      if (sortBy === "price") return b.price - a.price;
      if (sortBy === "expiry") return new Date(a.expiryDate) - new Date(b.expiryDate);
      return 0;
    });

  const totalValue = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalCost = items.reduce((s, i) => s + avgCost(i) * i.quantity, 0);
  const expiringCount = items.filter((i) => ["critical", "warning"].includes(expiryStatus(i.expiryDate))).length;
  const lowStock = items.filter((i) => i.quantity <= 5).length;

  const catName = (id) => categories.find((c) => c.id === id)?.name || "미분류";
  const vendorName = (id) => vendors.find((v) => v.id === id)?.name || "미등록 벤더";

  // ── Styles ────────────────────────────────────────────────────────────────
  const s = {
    app: { fontFamily: "'DM Sans', sans-serif", background: "#0d0f14", color: "#e8eaf0", minHeight: "100vh", display: "flex", flexDirection: "column" },
    header: { background: "linear-gradient(135deg,#1a1d26 0%,#12151e 100%)", borderBottom: "1px solid #252836", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 },
    logo: { display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px" },
    logoIcon: { width: 36, height: 36, background: "linear-gradient(135deg,#00c896,#0080ff)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" },
    badge: (col) => ({ background: col, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }),
    tabs: { display: "flex", gap: 4, background: "#161922", borderRadius: 10, padding: 4 },
    tab: (active) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all .2s", background: active ? "linear-gradient(135deg,#00c896,#0080ff)" : "transparent", color: active ? "#fff" : "#8892a4" }),
    body: { flex: 1, padding: "24px", maxWidth: 1400, margin: "0 auto", width: "100%" },
    card: { background: "#161922", border: "1px solid #252836", borderRadius: 16, padding: 20 },
    statsRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 },
    statCard: (accent) => ({ background: "#161922", border: `1px solid #252836`, borderRadius: 16, padding: 20, borderTop: `3px solid ${accent}`, position: "relative", overflow: "hidden" }),
    statVal: { fontSize: 28, fontWeight: 800, letterSpacing: "-1px", marginBottom: 4 },
    statLabel: { fontSize: 12, color: "#8892a4", fontWeight: 500 },
    filterRow: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
    input: { background: "#1e2130", border: "1px solid #303450", borderRadius: 10, padding: "10px 14px", color: "#e8eaf0", fontSize: 14, outline: "none" },
    select: { background: "#1e2130", border: "1px solid #303450", borderRadius: 10, padding: "10px 14px", color: "#e8eaf0", fontSize: 14, outline: "none", cursor: "pointer" },
    btn: (variant = "primary", sm) => ({
      background: variant === "primary" ? "linear-gradient(135deg,#00c896,#0080ff)" :
                  variant === "danger" ? "#ff4757" :
                  variant === "warning" ? "#ffa502" :
                  variant === "ghost" ? "transparent" : "#252836",
      color: "#fff", border: variant === "ghost" ? "1px solid #303450" : "none",
      borderRadius: 10, padding: sm ? "6px 12px" : "10px 18px",
      fontSize: sm ? 12 : 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all .2s",
    }),
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 },
    itemCard: { background: "#161922", border: "1px solid #252836", borderRadius: 16, padding: 20, cursor: "pointer", transition: "all .2s", position: "relative", overflow: "hidden" },
    table: { width: "100%", borderCollapse: "collapse" },
    th: { padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#8892a4", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #252836" },
    td: { padding: "14px 16px", borderBottom: "1px solid #1e2130", fontSize: 14 },
    pill: (color) => ({ background: color + "22", color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }),
    modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
    modalBox: { background: "#161922", border: "1px solid #303450", borderRadius: 20, padding: 28, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto" },
    label: { fontSize: 12, fontWeight: 600, color: "#8892a4", marginBottom: 6, display: "block" },
    formInput: { background: "#1e2130", border: "1px solid #303450", borderRadius: 10, padding: "11px 14px", color: "#e8eaf0", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" },
    formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    notif: (type) => ({ position: "fixed", top: 80, right: 24, zIndex: 2000, background: type === "error" ? "#ff4757" : type === "warning" ? "#ffa502" : "#00c896", color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.4)", animation: "slideIn .3s ease" }),
  };

  const expiryColors = { ok: "#00c896", warning: "#ffa502", critical: "#ff4757", expired: "#8892a4" };

  // ─── Login Screen ─────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div style={{ ...s.app, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap'); @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ ...s.logoIcon, width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px", animation: "float 3s ease-in-out infinite" }}>
            <Icon name="package" size={28} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-1px" }}>Clover Inventory</h1>
          <p style={{ color: "#8892a4", margin: 0 }}>Clover POS와 연동된 스마트 재고관리 시스템</p>
        </div>
        <div style={{ ...s.card, width: "100%", maxWidth: 460 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16 }}>🔌 Clover 연결</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Access Token</label>
            <input style={s.formInput} type="password" placeholder="your_clover_access_token"
              value={config.token} onChange={(e) => setConfig({ ...config, token: e.target.value })} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Merchant ID</label>
            <input style={s.formInput} placeholder="XXXXXXXXXXXXXXXX"
              value={config.merchantId} onChange={(e) => setConfig({ ...config, merchantId: e.target.value })} />
          </div>
          <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" id="sb" checked={config.sandbox} onChange={(e) => setConfig({ ...config, sandbox: e.target.checked })} />
            <label htmlFor="sb" style={{ fontSize: 13, color: "#8892a4", cursor: "pointer" }}>Sandbox 모드 (테스트용)</label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button style={s.btn()} onClick={connectClover} disabled={loading}>
              {loading ? "연결 중..." : <><Icon name="refresh" />Clover에 연결</>}
            </button>
            <button style={{ ...s.btn("ghost"), justifyContent: "center" }} onClick={loadDemo}>
              🎮 데모 모드로 시작
            </button>
          </div>
          {demoMode && <p style={{ color: "#8892a4", fontSize: 12, marginTop: 12, textAlign: "center" }}>실제 데이터 없이 샘플 데이터로 모든 기능을 체험해보세요</p>}
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ───────────────────────────────────────────────────────
  return (
    <div style={s.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap'); @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} * { box-sizing: border-box; } ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#303450;border-radius:3px}`}</style>

      {notification && <div style={s.notif(notification.type)}>{notification.msg}</div>}

      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>
          <div style={s.logoIcon}><Icon name="package" size={18} /></div>
          Clover Inventory
          {demoMode && <span style={s.badge("#ffa502")}>DEMO</span>}
        </div>
        <div style={s.tabs}>
          {[["inventory", "package", "인벤토리"], ["delivery", "truck", "배달/입고"], ["sales", "trend", "판매현황"], ["vendors", "vendor", "벤더관리"], ["categories", "category", "카테고리"], ["settings", "settings", "설정"]].map(([tab, icon, label]) => (
            <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name={icon} size={14} />{label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Sync status bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e2130", border: "1px solid #303450", borderRadius: 12, padding: "6px 12px" }}>
            {/* Auto toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ color: "#8892a4" }}>자동</span>
              <div
                onClick={() => setAutoRefresh(a => !a)}
                style={{ width: 36, height: 20, borderRadius: 10, background: autoRefresh ? "#00c896" : "#303450", position: "relative", cursor: "pointer", transition: "background .2s" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: autoRefresh ? 18 : 2, transition: "left .2s" }} />
              </div>
            </div>
            {/* Interval selector */}
            {autoRefresh && (
              <select
                value={refreshSec}
                onChange={(e) => setRefreshSec(Number(e.target.value))}
                style={{ background: "transparent", border: "none", color: "#8892a4", fontSize: 12, outline: "none", cursor: "pointer" }}>
                <option value={15}>15초</option>
                <option value={30}>30초</option>
                <option value={60}>1분</option>
                <option value={120}>2분</option>
                <option value={300}>5분</option>
              </select>
            )}
            {/* Countdown */}
            {autoRefresh && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 28, height: 28, position: "relative" }}>
                  <svg width="28" height="28" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="14" cy="14" r="11" fill="none" stroke="#252836" strokeWidth="2.5" />
                    <circle cx="14" cy="14" r="11" fill="none" stroke="#00c896" strokeWidth="2.5"
                      strokeDasharray={`${2 * Math.PI * 11}`}
                      strokeDashoffset={`${2 * Math.PI * 11 * (1 - countdown / refreshSec)}`}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 1s linear" }} />
                  </svg>
                  <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#00c896" }}>{countdown}</span>
                </div>
              </div>
            )}
            {/* Divider */}
            <div style={{ width: 1, height: 20, background: "#303450" }} />
            {/* Last synced */}
            <div style={{ fontSize: 11, color: "#8892a4" }}>
              {lastSynced ? `${lastSynced.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 동기화` : "미동기화"}
            </div>
            {/* Manual refresh */}
            <button
              onClick={() => syncData(false)}
              disabled={syncing}
              title="지금 동기화"
              style={{ background: "none", border: "none", cursor: syncing ? "default" : "pointer", color: syncing ? "#00c896" : "#8892a4", padding: 2, display: "flex", alignItems: "center" }}>
              <span style={{ display: "inline-block", animation: syncing ? "spin 0.8s linear infinite" : "none" }}>
                <Icon name="refresh" size={15} />
              </span>
            </button>
          </div>

          {expiringCount > 0 && (
            <div style={{ ...s.pill("#ff4757"), display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="alert" size={12} /> {expiringCount}개 만료임박
            </div>
          )}
          <button style={s.btn("ghost", true)} onClick={() => { setConnected(false); setDemoMode(false); clearInterval(autoRefreshRef.current); clearInterval(countdownRef.current); }}>
            연결 해제
          </button>
        </div>
      </header>

      <div style={s.body}>
        {/* ── INVENTORY TAB ── */}
        {activeTab === "inventory" && (
          <>
            {/* Stats */}
            <div style={s.statsRow}>
              <div style={s.statCard("#00c896")}>
                <div style={s.statVal}>{items.length}</div>
                <div style={s.statLabel}>전체 상품</div>
              </div>
              <div style={s.statCard("#0080ff")}>
                <div style={s.statVal}>{fmt(totalValue)}</div>
                <div style={s.statLabel}>판매가 기준 재고 총액</div>
              </div>
              <div style={s.statCard("#a855f7")}>
                <div style={s.statVal}>{fmt(totalValue - totalCost)}</div>
                <div style={s.statLabel}>예상 총 마진</div>
              </div>
              <div style={s.statCard("#ff4757")}>
                <div style={s.statVal}>{expiringCount + lowStock}</div>
                <div style={s.statLabel}>주의 필요 상품 (만료임박 + 재고부족)</div>
              </div>
            </div>

            {/* Toolbar */}
            <div style={s.filterRow}>
              <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                <input style={{ ...s.input, width: "100%", paddingLeft: 38 }} placeholder="상품명, SKU, 바코드 검색..."
                  value={search} onChange={(e) => setSearch(e.target.value)} />
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#8892a4" }}><Icon name="search" size={15} /></span>
              </div>
              <select style={s.select} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
                <option value="all">모든 카테고리</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select style={s.select} value={filterExpiry} onChange={(e) => setFilterExpiry(e.target.value)}>
                <option value="all">유통기한 전체</option>
                <option value="expiring">만료 임박 (7일 이내)</option>
                <option value="expired">만료됨</option>
              </select>
              <select style={s.select} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name">이름순</option>
                <option value="qty">재고순</option>
                <option value="price">가격순</option>
                <option value="expiry">유통기한순</option>
              </select>
              <button style={s.btn("ghost", true)} onClick={() => setViewMode(v => v === "grid" ? "list" : "grid")}>
                <Icon name={viewMode === "grid" ? "list" : "grid"} size={15} />
              </button>
              <button style={s.btn()} onClick={openAdd}>
                <Icon name="plus" /> 상품 추가
              </button>
            </div>

            {/* Item Grid */}
            {viewMode === "grid" ? (
              <div style={s.grid}>
                {filtered.map((item) => {
                  const es = expiryStatus(item.expiryDate);
                  const margin = ((item.price - avgCost(item)) / item.price * 100).toFixed(1);
                  return (
                    <div key={item.id} style={{ ...s.itemCard, borderLeft: `3px solid ${expiryColors[es]}` }}
                      onClick={() => openDetail(item)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{item.name}</div>
                          <div style={{ color: "#8892a4", fontSize: 12 }}>{item.sku} · {catName(item.categoryId)}</div>
                        </div>
                        <div style={s.pill(expiryColors[es])}>
                          {es === "expired" ? "만료" : es === "critical" ? "⚠ 3일내" : es === "warning" ? "7일내" : "정상"}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                        <div style={{ background: "#1e2130", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 11, color: "#8892a4" }}>판매가</div>
                          <div style={{ fontWeight: 700 }}>{fmt(item.price)}</div>
                        </div>
                        <div style={{ background: "#1e2130", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 11, color: "#8892a4" }}>재고</div>
                          <div style={{ fontWeight: 700, color: item.quantity <= 5 ? "#ff4757" : "#e8eaf0" }}>{item.quantity}</div>
                        </div>
                        <div style={{ background: "#1e2130", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 11, color: "#8892a4" }}>마진율</div>
                          <div style={{ fontWeight: 700, color: "#00c896" }}>{margin}%</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, color: "#8892a4" }}>
                          <Icon name="calendar" size={11} /> {item.expiryDate}
                        </div>
                        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <button style={s.btn("ghost", true)} onClick={() => openStock(item)}>재고조정</button>
                          <button style={{ ...s.btn("ghost", true), color: "#00c896", borderColor: "#00c89644" }} onClick={() => openDelivery(item)}><Icon name="truck" size={12} />입고</button>
                          <button style={s.btn("primary", true)} onClick={() => openSale(item)}>판매기록</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={s.card}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {["상품명", "SKU", "카테고리", "재고", "판매가", "평균원가", "마진율", "유통기한", "작업"].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const es = expiryStatus(item.expiryDate);
                      const ac = avgCost(item);
                      const margin = ((item.price - ac) / item.price * 100).toFixed(1);
                      return (
                        <tr key={item.id} style={{ cursor: "pointer" }} onClick={() => openDetail(item)}>
                          <td style={s.td}><span style={{ fontWeight: 600 }}>{item.name}</span></td>
                          <td style={{ ...s.td, color: "#8892a4" }}>{item.sku}</td>
                          <td style={s.td}><span style={s.pill("#0080ff")}>{catName(item.categoryId)}</span></td>
                          <td style={{ ...s.td, color: item.quantity <= 5 ? "#ff4757" : "#e8eaf0", fontWeight: 700 }}>{item.quantity}</td>
                          <td style={s.td}>{fmt(item.price)}</td>
                          <td style={s.td}>{fmt(ac)}</td>
                          <td style={{ ...s.td, color: "#00c896", fontWeight: 600 }}>{margin}%</td>
                          <td style={s.td}><span style={s.pill(expiryColors[es])}>{item.expiryDate}</span></td>
                          <td style={s.td} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button style={s.btn("ghost", true)} onClick={() => openEdit(item)}><Icon name="edit" size={12} /></button>
                              <button style={s.btn("ghost", true)} onClick={() => openStock(item)}>재고</button>
                              <button style={{ ...s.btn("ghost", true), color: "#00c896", borderColor: "#00c89644" }} onClick={() => openDelivery(item)}><Icon name="truck" size={11} />입고</button>
                              <button style={s.btn("primary", true)} onClick={() => openSale(item)}>판매</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── DELIVERY TAB ── */}
        {activeTab === "delivery" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🚚 배달 / 입고 기록</h2>
            </div>
            {/* All deliveries across all items sorted by date desc */}
            {(() => {
              const allDeliveries = items.flatMap(item =>
                (item.deliveryHistory || []).map(d => ({ ...d, itemId: item.id, itemName: item.name, itemSku: item.sku }))
              ).sort((a, b) => new Date(b.date) - new Date(a.date));

              if (!allDeliveries.length) return (
                <div style={{ ...s.card, textAlign: "center", padding: 60, color: "#8892a4" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                  <div>아직 입고 기록이 없습니다</div>
                  <div style={{ fontSize: 12, marginTop: 8 }}>상품 카드에서 "입고" 버튼을 눌러 기록하세요</div>
                </div>
              );

              // group by date
              const byDate = {};
              allDeliveries.forEach(d => {
                if (!byDate[d.date]) byDate[d.date] = [];
                byDate[d.date].push(d);
              });

              return Object.entries(byDate).map(([date, records]) => {
                const dayTotal = records.reduce((s, r) => s + r.totalCost, 0);
                return (
                  <div key={date} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#8892a4", display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon name="calendar" size={13} /> {date}
                      </div>
                      <div style={{ fontSize: 12, color: "#ffa502" }}>당일 총 입고비용: <strong>{fmt(dayTotal)}</strong></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {records.map(rec => (
                        <div key={rec.id} style={{ ...s.card, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                          <div style={{ width: 36, height: 36, background: "#00c89622", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon name="truck" size={16} />
                          </div>
                          <div style={{ flex: 2, minWidth: 140 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{rec.itemName}</div>
                            <div style={{ fontSize: 11, color: "#8892a4" }}>{rec.itemSku}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 100 }}>
                            <div style={{ fontSize: 11, color: "#8892a4" }}>벤더</div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#0080ff" }}>{rec.vendorId ? vendorName(rec.vendorId) : "—"}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 80 }}>
                            <div style={{ fontSize: 11, color: "#8892a4" }}>입고 수량</div>
                            <div style={{ fontWeight: 700, color: "#00c896" }}>+{rec.qty}개</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 80 }}>
                            <div style={{ fontSize: 11, color: "#8892a4" }}>개별 원가</div>
                            <div style={{ fontWeight: 600 }}>{rec.unitCost ? fmt(rec.unitCost) : "—"}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 90 }}>
                            <div style={{ fontSize: 11, color: "#8892a4" }}>총 비용</div>
                            <div style={{ fontWeight: 700, color: "#ffa502" }}>{fmt(rec.totalCost)}</div>
                          </div>
                          {rec.note && (
                            <div style={{ fontSize: 11, color: "#8892a4", fontStyle: "italic", flex: 2 }}>📝 {rec.note}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ── VENDORS TAB ── */}
        {activeTab === "vendors" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🏢 벤더 관리</h2>
              <button style={s.btn()} onClick={() => { setForm({ name: "", contact: "", phone: "", email: "", note: "" }); setModal({ type: "addVendor" }); }}>
                <Icon name="plus" /> 벤더 추가
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
              {vendors.map(v => {
                const vendorDeliveries = items.flatMap(i => (i.deliveryHistory || []).filter(d => d.vendorId === v.id));
                const totalSpend = vendorDeliveries.reduce((s, d) => s + d.totalCost, 0);
                const totalQty = vendorDeliveries.reduce((s, d) => s + d.qty, 0);
                const lastDel = vendorDeliveries.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                return (
                  <div key={v.id} style={{ ...s.card, borderTop: "3px solid #0080ff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{v.name}</div>
                        <div style={{ fontSize: 12, color: "#8892a4", marginTop: 2 }}>{v.contact}</div>
                      </div>
                      <button style={s.btn("ghost", true)} onClick={() => { setForm({ ...v }); setModal({ type: "editVendor", vendor: v }); }}>
                        <Icon name="edit" size={13} />
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, fontSize: 13 }}>
                      {v.phone && <div style={{ display: "flex", gap: 8, color: "#8892a4" }}><span>📞</span><span>{v.phone}</span></div>}
                      {v.email && <div style={{ display: "flex", gap: 8, color: "#8892a4" }}><span>✉️</span><span>{v.email}</span></div>}
                      {v.note && <div style={{ display: "flex", gap: 8, color: "#8892a4" }}><span>📝</span><span style={{ fontStyle: "italic" }}>{v.note}</span></div>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderTop: "1px solid #252836", paddingTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#8892a4" }}>총 배달 횟수</div>
                        <div style={{ fontWeight: 700, color: "#0080ff" }}>{vendorDeliveries.length}회</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#8892a4" }}>총 입고 수량</div>
                        <div style={{ fontWeight: 700, color: "#00c896" }}>{totalQty}개</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#8892a4" }}>총 지출</div>
                        <div style={{ fontWeight: 700, color: "#ffa502" }}>{fmt(totalSpend)}</div>
                      </div>
                    </div>
                    {lastDel && (
                      <div style={{ marginTop: 10, fontSize: 11, color: "#8892a4" }}>
                        마지막 배달: <span style={{ color: "#e8eaf0" }}>{lastDel.date}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {vendors.length === 0 && (
                <div style={{ ...s.card, textAlign: "center", padding: 60, color: "#8892a4", gridColumn: "1/-1" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
                  <div>등록된 벤더가 없습니다</div>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === "sales" && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>📊 판매 현황</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
              {items.filter(i => i.salesHistory?.length).map(item => {
                const total = item.salesHistory.reduce((s, r) => s + r.qty, 0);
                const revenue = item.salesHistory.reduce((s, r) => s + r.revenue, 0);
                const cost = item.salesHistory.reduce((s, r) => s + r.qty * avgCost(item), 0);
                return (
                  <div key={item.id} style={s.card}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
                    <div style={{ color: "#8892a4", fontSize: 12, marginBottom: 12 }}>{catName(item.categoryId)}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#8892a4" }}>총 판매수</div>
                        <div style={{ fontWeight: 700, color: "#0080ff" }}>{total}개</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#8892a4" }}>총 매출</div>
                        <div style={{ fontWeight: 700, color: "#00c896" }}>{fmt(revenue)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#8892a4" }}>순이익</div>
                        <div style={{ fontWeight: 700, color: "#a855f7" }}>{fmt(revenue - cost)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {item.salesHistory.slice(-3).map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: i === 0 ? "1px solid #252836" : "none", fontSize: 12, color: "#8892a4" }}>
                          <span>{r.date}</span>
                          <span>{r.qty}개 판매</span>
                          <span style={{ color: "#00c896" }}>{fmt(r.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CATEGORIES TAB ── */}
        {activeTab === "categories" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>🗂 카테고리 관리</h2>
              <button style={s.btn()} onClick={() => { setForm({ name: "" }); setModal({ type: "addCat" }); }}>
                <Icon name="plus" /> 카테고리 추가
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
              {categories.map(cat => {
                const catItems = items.filter(i => i.categoryId === cat.id);
                const val = catItems.reduce((s, i) => s + i.price * i.quantity, 0);
                return (
                  <div key={cat.id} style={s.card}>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{cat.name}</div>
                    <div style={{ color: "#8892a4", fontSize: 13, marginBottom: 12 }}>{catItems.length}개 상품</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#00c896" }}>{fmt(val)}</div>
                    <div style={{ fontSize: 11, color: "#8892a4" }}>카테고리 재고 총액</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>⚙️ 설정</h2>
            <div style={{ ...s.card, maxWidth: 500 }}>
              <h3 style={{ margin: "0 0 16px" }}>Clover API 설정</h3>
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Access Token</label>
                <input style={s.formInput} type="password" value={config.token} onChange={(e) => setConfig({ ...config, token: e.target.value })} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Merchant ID</label>
                <input style={s.formInput} value={config.merchantId} onChange={(e) => setConfig({ ...config, merchantId: e.target.value })} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <input type="checkbox" id="sb2" checked={config.sandbox} onChange={(e) => setConfig({ ...config, sandbox: e.target.checked })} />
                <label htmlFor="sb2" style={{ fontSize: 13, color: "#8892a4" }}>Sandbox 모드</label>
              </div>
              <button style={s.btn()} onClick={connectClover}><Icon name="check" /> 설정 저장 및 재연결</button>
            </div>
            <div style={{ ...s.card, maxWidth: 500, marginTop: 20 }}>
              <h3 style={{ margin: "0 0 16px" }}>🔄 자동 동기화 설정</h3>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>자동 새로고침</div>
                  <div style={{ fontSize: 12, color: "#8892a4", marginTop: 2 }}>Clover Station 판매 데이터 자동 반영</div>
                </div>
                <div onClick={() => setAutoRefresh(a => !a)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: autoRefresh ? "#00c896" : "#303450", position: "relative", cursor: "pointer", transition: "background .2s" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: autoRefresh ? 22 : 2, transition: "left .2s" }} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>새로고침 주기</label>
                <select style={s.formInput} value={refreshSec} onChange={(e) => setRefreshSec(Number(e.target.value))}>
                  <option value={15}>15초 (가장 빠름)</option>
                  <option value={30}>30초 (권장)</option>
                  <option value={60}>1분</option>
                  <option value={120}>2분</option>
                  <option value={300}>5분</option>
                </select>
              </div>
              <button style={s.btn()} onClick={() => syncData(false)} disabled={syncing}>
                <span style={{ display: "inline-block", animation: syncing ? "spin 0.8s linear infinite" : "none" }}><Icon name="refresh" /></span>
                {syncing ? "동기화 중..." : "지금 수동 동기화"}
              </button>
              {lastSynced && (
                <div style={{ fontSize: 12, color: "#8892a4", marginTop: 10 }}>
                  마지막 동기화: {lastSynced.toLocaleString("ko-KR")}
                </div>
              )}
            </div>

      {/* ── MODALS ── */}
      {modal && (
        <div style={s.modal} onClick={() => setModal(null)}>
          <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>

            {/* Add / Edit Item */}
            {(modal.type === "add" || modal.type === "edit") && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ margin: 0 }}>{modal.type === "add" ? "📦 상품 추가" : "✏️ 상품 수정"}</h3>
                  <button style={s.btn("ghost", true)} onClick={() => setModal(null)}><Icon name="close" /></button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div><label style={s.label}>상품명 *</label><input style={s.formInput} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div style={s.formGrid}>
                    <div><label style={s.label}>SKU</label><input style={s.formInput} value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                    <div>
                      <label style={s.label}>바코드</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input ref={barcodeRef} style={{ ...s.formInput, flex: 1 }} value={form.barcode || ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="스캔 또는 입력" />
                        <button style={s.btn("ghost", true)} title="바코드 스캔 (USB/Bluetooth 스캐너 연결 시 자동 인식)"><Icon name="scan" /></button>
                      </div>
                    </div>
                  </div>
                  <div style={s.formGrid}>
                    <div><label style={s.label}>판매가 *</label><input style={s.formInput} type="number" step="0.01" value={form.price || ""} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                    <div>
                      <label style={s.label}>개별 원가 (직접 입력)</label>
                      <input style={{ ...s.formInput, background: form.casePrice && form.caseQty ? "#151a10" : undefined }}
                        type="number" step="0.01"
                        value={form.casePrice && form.caseQty ? (parseFloat(form.casePrice) / parseInt(form.caseQty)).toFixed(4) : (form.cost || "")}
                        onChange={(e) => setForm({ ...form, cost: e.target.value, casePrice: "", caseQty: "" })}
                        placeholder="0.00"
                        readOnly={!!(form.casePrice && form.caseQty)}
                      />
                    </div>
                  </div>
                  {/* Case Price Calculator */}
                  <div style={{ background: "#1a1f2e", border: "1px solid #303450", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8892a4", marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>📦 케이스 원가 계산기</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={s.label}>케이스 가격</label>
                        <input style={s.formInput} type="number" step="0.01" placeholder="예: 24.00"
                          value={form.casePrice || ""}
                          onChange={(e) => {
                            const cp = e.target.value;
                            const cq = form.caseQty;
                            const unitCost = cp && cq ? (parseFloat(cp) / parseInt(cq)).toFixed(4) : form.cost;
                            setForm({ ...form, casePrice: cp, cost: unitCost });
                          }} />
                      </div>
                      <div>
                        <label style={s.label}>케이스당 수량 (개)</label>
                        <input style={s.formInput} type="number" min="1" placeholder="예: 12"
                          value={form.caseQty || ""}
                          onChange={(e) => {
                            const cq = e.target.value;
                            const cp = form.casePrice;
                            const unitCost = cp && cq ? (parseFloat(cp) / parseInt(cq)).toFixed(4) : form.cost;
                            setForm({ ...form, caseQty: cq, cost: unitCost });
                          }} />
                      </div>
                    </div>
                    {form.casePrice && form.caseQty && parseInt(form.caseQty) > 0 ? (
                      <div style={{ background: "#0d1a0d", border: "1px solid #00c89633", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#8892a4" }}>
                          {fmt(parseFloat(form.casePrice))} ÷ {form.caseQty}개
                        </span>
                        <span style={{ fontWeight: 800, color: "#00c896", fontSize: 16 }}>
                          개별 원가: {fmt(parseFloat(form.casePrice) / parseInt(form.caseQty))}
                        </span>
                        {form.price && (
                          <span style={{ fontSize: 12, color: "#a855f7", fontWeight: 600 }}>
                            마진 {((form.price - (parseFloat(form.casePrice) / parseInt(form.caseQty))) / form.price * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#8892a4", textAlign: "center", padding: 4 }}>케이스 가격과 수량을 입력하면 개별 원가가 자동 계산됩니다</div>
                    )}
                  </div>
                  <div style={s.formGrid}>
                    <div><label style={s.label}>초기 재고</label><input style={s.formInput} type="number" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                    <div>
                      <label style={s.label}>카테고리</label>
                      <select style={{ ...s.formInput }} value={form.categoryId || ""} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                        <option value="">선택...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label style={s.label}>유통기한</label><input style={s.formInput} type="date" value={form.expiryDate || ""} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
                  <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                    <button style={{ ...s.btn(), flex: 1, justifyContent: "center" }} onClick={saveItem}><Icon name="check" /> 저장</button>
                    {modal.type === "edit" && <button style={s.btn("danger", false)} onClick={() => deleteItem(modal.item.id)}><Icon name="trash" /></button>}
                  </div>
                </div>
              </>
            )}

            {/* Stock Adjustment */}
            {modal.type === "stock" && (
              <>
                <h3 style={{ margin: "0 0 20px" }}>📊 재고 조정 — {modal.item.name}</h3>
                <div style={{ background: "#1e2130", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#8892a4" }}>현재 재고</span>
                  <span style={{ fontWeight: 800, fontSize: 20 }}>{modal.item.quantity}개</span>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>조정 수량 (+ 입고 / - 출고)</label>
                  <input style={s.formInput} type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="예: +10 또는 -5" />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={s.label}>메모</label>
                  <input style={s.formInput} value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="입고, 폐기, 조정 사유 등" />
                </div>
                <div style={{ background: "#252836", borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: "#8892a4" }}>
                  조정 후 재고: <strong style={{ color: "#00c896", fontSize: 16 }}>{Math.max(0, modal.item.quantity + (parseInt(form.qty) || 0))}개</strong>
                </div>
                <button style={{ ...s.btn(), width: "100%", justifyContent: "center" }} onClick={adjustStock}><Icon name="check" /> 재고 조정 저장</button>
              </>
            )}

            {/* Record Sale */}
            {modal.type === "sale" && (
              <>
                <h3 style={{ margin: "0 0 20px" }}>🛒 판매 기록 — {modal.item.name}</h3>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>판매 수량</label>
                    <input style={s.formInput} type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>판매 날짜</label>
                    <input style={s.formInput} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>
                <div style={{ background: "#1e2130", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#8892a4" }}>단가</span><span>{fmt(modal.item.price)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#8892a4" }}>수량</span><span>{form.qty}개</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #303450", paddingTop: 8 }}>
                    <span style={{ fontWeight: 700 }}>총 매출</span>
                    <span style={{ fontWeight: 700, color: "#00c896", fontSize: 18 }}>{fmt(modal.item.price * (parseInt(form.qty) || 0))}</span>
                  </div>
                </div>
                <button style={{ ...s.btn(), width: "100%", justifyContent: "center" }} onClick={recordSale}><Icon name="check" /> 판매 기록 저장</button>
              </>
            )}

            {/* Detail View */}
            {modal.type === "detail" && (() => {
              const item = modal.item;
              const ac = avgCost(item);
              const totalSold = item.salesHistory?.reduce((s, r) => s + r.qty, 0) || 0;
              const totalRevenue = item.salesHistory?.reduce((s, r) => s + r.revenue, 0) || 0;
              const es = expiryStatus(item.expiryDate);
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px", fontSize: 20 }}>{item.name}</h3>
                      <span style={{ color: "#8892a4", fontSize: 13 }}>{item.sku} · {catName(item.categoryId)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={s.btn("ghost", true)} onClick={() => { setModal(null); setTimeout(() => openEdit(item), 100); }}><Icon name="edit" size={14} /></button>
                      <button style={s.btn("ghost", true)} onClick={() => setModal(null)}><Icon name="close" /></button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    {[["재고", item.quantity + "개", item.quantity <= 5 ? "#ff4757" : "#00c896"],
                      ["판매가", fmt(item.price), "#0080ff"],
                      ["평균원가", fmt(ac), "#ffa502"],
                      ["마진율", ((item.price - ac) / item.price * 100).toFixed(1) + "%", "#a855f7"],
                      ["유통기한", item.expiryDate, expiryColors[es]],
                      ["바코드", item.barcode || "없음", "#8892a4"],
                    ].map(([label, val, col]) => (
                      <div key={label} style={{ background: "#1e2130", borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: "#8892a4", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontWeight: 700, color: col }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#1e2130", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, marginBottom: 12 }}>📈 판매 이력</div>
                    {item.salesHistory?.length ? item.salesHistory.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid #252836", fontSize: 13 }}>
                        <span style={{ color: "#8892a4" }}>{r.date}</span>
                        <span>{r.qty}개 판매</span>
                        <span style={{ color: "#00c896" }}>{fmt(r.revenue)}</span>
                      </div>
                    )) : <div style={{ color: "#8892a4", fontSize: 13 }}>판매 기록 없음</div>}
                    {item.salesHistory?.length > 0 && (
                      <div style={{ borderTop: "1px solid #303450", paddingTop: 10, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span>합계</span><span>{totalSold}개</span><span style={{ color: "#00c896" }}>{fmt(totalRevenue)}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ background: "#1e2130", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>🚚 입고 이력</span>
                      <button style={s.btn("ghost", true)} onClick={() => { setModal(null); setTimeout(() => openDelivery(item), 100); }}>
                        <Icon name="plus" size={12} /> 입고 추가
                      </button>
                    </div>
                    {item.deliveryHistory?.length ? item.deliveryHistory.slice().reverse().map((d, i) => (
                      <div key={d.id || i} style={{ padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid #252836" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: "#8892a4" }}>{d.date}</span>
                          <span style={{ color: "#00c896", fontWeight: 700 }}>+{d.qty}개</span>
                          <span style={{ color: "#ffa502" }}>{fmt(d.totalCost)}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 11, color: "#8892a4" }}>
                          {d.vendorId && <span style={{ color: "#0080ff" }}>🏢 {vendorName(d.vendorId)}</span>}
                          {d.unitCost > 0 && <span>개별 {fmt(d.unitCost)}</span>}
                          {d.note && <span>📝 {d.note}</span>}
                        </div>
                      </div>
                    )) : <div style={{ color: "#8892a4", fontSize: 13 }}>입고 기록 없음</div>}
                  </div>
                  <div style={{ background: "#1e2130", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, marginBottom: 12 }}>💰 원가 이력</div>
                    {item.costHistory?.map((r, i) => (
                      <div key={i} style={{ padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid #252836" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: "#8892a4" }}>{r.date}</span>
                          <span style={{ fontWeight: 700 }}>개별 원가: {fmt(r.cost)}</span>
                        </div>
                        {r.casePrice && r.caseQty && (
                          <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "#8892a4" }}>
                            <span>📦 케이스: {fmt(r.casePrice)}</span>
                            <span>수량: {r.caseQty}개/케이스</span>
                            <span style={{ color: "#ffa502" }}>{fmt(r.casePrice)} ÷ {r.caseQty} = {fmt(r.cost)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid #303450", paddingTop: 10, marginTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                      <span>평균 원가</span><span style={{ color: "#ffa502", fontSize: 16 }}>{fmt(ac)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button style={{ ...s.btn("ghost"), flex: 1, justifyContent: "center" }} onClick={() => { setModal(null); setTimeout(() => openStock(item), 100); }}>재고 조정</button>
                    <button style={{ ...s.btn("ghost"), flex: 1, justifyContent: "center", color: "#00c896", borderColor: "#00c89644" }} onClick={() => { setModal(null); setTimeout(() => openDelivery(item), 100); }}><Icon name="truck" size={14} />입고 기록</button>
                    <button style={{ ...s.btn(), flex: 1, justifyContent: "center" }} onClick={() => { setModal(null); setTimeout(() => openSale(item), 100); }}>판매 기록</button>
                  </div>
                </>
              );
            })()}

            {/* Delivery / Receiving */}
            {modal.type === "delivery" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px" }}>🚚 입고 기록</h3>
                    <div style={{ fontSize: 13, color: "#8892a4" }}>{modal.item.name}</div>
                  </div>
                  <button style={s.btn("ghost", true)} onClick={() => setModal(null)}><Icon name="close" /></button>
                </div>
                <div style={{ background: "#1e2130", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#8892a4", fontSize: 13 }}>현재 재고</span>
                  <span style={{ fontWeight: 800 }}>{modal.item.quantity}개</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={s.formGrid}>
                    <div>
                      <label style={s.label}>입고 날짜</label>
                      <input style={s.formInput} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div>
                      <label style={s.label}>입고 수량 *</label>
                      <input style={s.formInput} type="number" min="1" placeholder="개수" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>벤더 선택</label>
                    <select style={s.formInput} value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
                      <option value="">벤더 선택 (선택사항)</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    {!vendors.length && (
                      <div style={{ fontSize: 11, color: "#8892a4", marginTop: 4 }}>
                        벤더 탭에서 먼저 벤더를 등록하세요
                      </div>
                    )}
                  </div>
                  {/* Cost section */}
                  <div style={{ background: "#1a1f2e", border: "1px solid #303450", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8892a4", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>💰 원가 정보 (선택)</div>
                    <div style={s.formGrid}>
                      <div>
                        <label style={s.label}>개별 원가</label>
                        <input style={{ ...s.formInput, background: form.casePrice && form.caseQty ? "#151a10" : undefined }}
                          type="number" step="0.01" placeholder="0.00"
                          value={form.casePrice && form.caseQty ? (parseFloat(form.casePrice) / parseInt(form.caseQty)).toFixed(4) : (form.unitCost || "")}
                          readOnly={!!(form.casePrice && form.caseQty)}
                          onChange={(e) => setForm({ ...form, unitCost: e.target.value, casePrice: "", caseQty: "" })} />
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end" }}>
                        <div style={{ fontSize: 11, color: "#8892a4", lineHeight: 1.5 }}>
                          또는 아래 케이스 계산기 사용
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      <div>
                        <label style={s.label}>케이스 가격</label>
                        <input style={s.formInput} type="number" step="0.01" placeholder="예: 24.00"
                          value={form.casePrice || ""}
                          onChange={(e) => {
                            const cp = e.target.value;
                            const cq = form.caseQty;
                            const u = cp && cq ? (parseFloat(cp) / parseInt(cq)).toFixed(4) : form.unitCost;
                            setForm({ ...form, casePrice: cp, unitCost: u });
                          }} />
                      </div>
                      <div>
                        <label style={s.label}>케이스당 수량</label>
                        <input style={s.formInput} type="number" min="1" placeholder="예: 12"
                          value={form.caseQty || ""}
                          onChange={(e) => {
                            const cq = e.target.value;
                            const cp = form.casePrice;
                            const u = cp && cq ? (parseFloat(cp) / parseInt(cq)).toFixed(4) : form.unitCost;
                            setForm({ ...form, caseQty: cq, unitCost: u });
                          }} />
                      </div>
                    </div>
                    {form.casePrice && form.caseQty && parseInt(form.caseQty) > 0 && (
                      <div style={{ background: "#0d1a0d", border: "1px solid #00c89633", borderRadius: 10, padding: "10px 14px", marginTop: 10, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "#8892a4" }}>{fmt(form.casePrice)} ÷ {form.caseQty}개</span>
                        <span style={{ fontWeight: 800, color: "#00c896" }}>개별: {fmt(parseFloat(form.casePrice) / parseInt(form.caseQty))}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={s.label}>메모</label>
                    <input style={s.formInput} placeholder="배달 메모, 인보이스 번호 등" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  </div>
                  {/* Preview */}
                  {form.qty > 0 && (
                    <div style={{ background: "#0d1a0d", border: "1px solid #00c89633", borderRadius: 12, padding: "12px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: "#8892a4" }}>입고 후 재고</span>
                        <span style={{ fontWeight: 700, color: "#00c896", fontSize: 16 }}>{modal.item.quantity + (parseInt(form.qty) || 0)}개</span>
                      </div>
                      {form.unitCost > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: "#8892a4" }}>총 입고 비용</span>
                          <span style={{ fontWeight: 700, color: "#ffa502" }}>{fmt(parseFloat(form.unitCost) * (parseInt(form.qty) || 0))}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <button style={{ ...s.btn(), justifyContent: "center" }} onClick={recordDelivery}>
                    <Icon name="truck" /> 입고 기록 저장
                  </button>
                </div>
              </>
            )}

            {/* Add / Edit Vendor */}
            {(modal.type === "addVendor" || modal.type === "editVendor") && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ margin: 0 }}>{modal.type === "addVendor" ? "🏢 벤더 추가" : "✏️ 벤더 수정"}</h3>
                  <button style={s.btn("ghost", true)} onClick={() => setModal(null)}><Icon name="close" /></button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={s.label}>회사명 *</label>
                    <input style={s.formInput} placeholder="예: Fresh Farms Co." value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div style={s.formGrid}>
                    <div>
                      <label style={s.label}>담당자</label>
                      <input style={s.formInput} placeholder="담당자 이름" value={form.contact || ""} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                    </div>
                    <div>
                      <label style={s.label}>전화번호</label>
                      <input style={s.formInput} placeholder="604-555-0000" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>이메일</label>
                    <input style={s.formInput} type="email" placeholder="orders@vendor.com" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label style={s.label}>메모 (배달 요일, 특이사항 등)</label>
                    <input style={s.formInput} placeholder="예: 월/수/금 배달, 최소주문 $200" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <button style={{ ...s.btn(), flex: 1, justifyContent: "center" }} onClick={() => {
                      if (!form.name) return notify("회사명은 필수입니다", "error");
                      if (modal.type === "addVendor") {
                        setVendors(p => [...p, { ...form, id: `ven${Date.now()}` }]);
                        notify("벤더가 추가되었습니다 ✓");
                      } else {
                        setVendors(p => p.map(v => v.id === modal.vendor.id ? { ...form, id: v.id } : v));
                        notify("벤더 정보가 수정되었습니다 ✓");
                      }
                      setModal(null);
                    }}><Icon name="check" /> 저장</button>
                    {modal.type === "editVendor" && (
                      <button style={s.btn("danger")} onClick={() => {
                        setVendors(p => p.filter(v => v.id !== modal.vendor.id));
                        notify("벤더가 삭제되었습니다");
                        setModal(null);
                      }}><Icon name="trash" /></button>
                    )}
                  </div>
                </div>
              </>
            )}
            {modal.type === "addCat" && (
              <>
                <h3 style={{ margin: "0 0 20px" }}>🗂 카테고리 추가</h3>
                <div style={{ marginBottom: 20 }}>
                  <label style={s.label}>카테고리명</label>
                  <input style={s.formInput} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                </div>
                <button style={{ ...s.btn(), width: "100%", justifyContent: "center" }} onClick={() => {
                  if (!form.name) return;
                  setCategories(p => [...p, { id: `cat${Date.now()}`, name: form.name }]);
                  notify("카테고리가 추가되었습니다 ✓");
                  setModal(null);
                }}><Icon name="check" /> 저장</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

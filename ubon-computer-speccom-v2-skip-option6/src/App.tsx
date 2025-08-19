import React, { useEffect, useMemo, useState } from "react";

/** ---------------- Types ---------------- */
export type Category =
  | "CPU"
  | "Motherboard"
  | "GPU"
  | "RAM"
  | "Storage"
  | "PSU"
  | "Case"
  | "Cooler";

export interface Product {
  id: string;
  category: Category | "Monitor" | "Software" | "SSD";
  name: string;
  price: number;
  stock: number;
  brand?: string;
  chipset?: string;
  socket?: string;
  watt?: number;
  size?: string; // form factor
  attrs?: Record<string, string>;
}

export interface AddonItem {
  id: string;
  product: Product;
  qty: number;
}

export interface BuildState {
  selection: Partial<Record<Category, Product>>;
  addons: AddonItem[];
}

/** ---------------- Mock inventory (default) ---------------- */
const DEFAULT_INVENTORY: Product[] = [
  { id: "cpu-1", category: "CPU", name: "Ryzen 5 5600", price: 4500, stock: 10, socket: "AM4", brand: "AMD" },
  { id: "cpu-2", category: "CPU", name: "Core i5-12400F", price: 5600, stock: 8, socket: "LGA1700", brand: "Intel" },
  { id: "mb-1", category: "Motherboard", name: "B550M A-Pro", price: 3200, stock: 5, socket: "AM4", size: "mATX" },
  { id: "mb-2", category: "Motherboard", name: "B660M DS3H", price: 3600, stock: 6, socket: "LGA1700", size: "mATX" },
  { id: "ram-1", category: "RAM", name: "16GB DDR4 3200", price: 1500, stock: 20 },
  { id: "gpu-1", category: "GPU", name: "RTX 4060 8GB", price: 12900, stock: 7 },
  { id: "psu-1", category: "PSU", name: "650W 80+ Bronze", price: 1690, stock: 9, watt: 650 },
  { id: "case-1", category: "Case", name: "ATX Mesh", price: 1590, stock: 12, size: "ATX" },
  { id: "cool-1", category: "Cooler", name: "Tower Air 120mm", price: 990, stock: 11 },
  { id: "ssd-1", category: "SSD", name: "NVMe 1TB Gen3", price: 1890, stock: 14 },
  // addons
  { id: "mon-1", category: "Monitor", name: '27" IPS 144Hz', price: 5890, stock: 6 },
  { id: "soft-1", category: "Software", name: "Windows 11 Home", price: 4290, stock: 50 },
];

/** ---------------- Helpers ---------------- */
const requiredCats: Category[] = ["CPU", "Motherboard", "PSU"];
const ALL_CATS: Category[] = ["CPU", "Motherboard", "GPU", "RAM", "Storage", "PSU", "Case", "Cooler"];

function baht(n: number) {
  return n.toLocaleString("th-TH", { style: "currency", currency: "THB" });
}
function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function isCompatible(sel: BuildState["selection"], cand: Product) {
  // Simple compatibility: CPU <-> MB socket, GPU requires PSU watt >= 550
  if (cand.category === "Motherboard" && sel.CPU?.socket && cand.socket && sel.CPU.socket !== cand.socket) return false;
  if (cand.category === "CPU" && sel.Motherboard?.socket && cand.socket && sel.Motherboard.socket !== cand.socket) return false;
  if (cand.category === "GPU" && sel.PSU?.watt && sel.PSU.watt < 550) return false;
  return true;
}
function download(name: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result.map((s) => s.trim());
}
function parseCSV(text: string): Product[] {
  // Simple CSV: id,category,name,price,stock,brand,socket,watt,size
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const out: Product[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const p: Product = {
      id: cols[idx("id")] || uid("csv"),
      category: (cols[idx("category")] as Product["category"]) || "CPU",
      name: cols[idx("name")] || "Unnamed",
      price: Number(cols[idx("price")] || 0),
      stock: Number(cols[idx("stock")] || 0),
      brand: cols[idx("brand")] || undefined,
      socket: cols[idx("socket")] || undefined,
      watt: cols[idx("watt")] ? Number(cols[idx("watt")]) : undefined,
      size: cols[idx("size")] || undefined,
    };
    out.push(p);
  }
  return out;
}

/** ---------------- Pretty Badge ---------------- */
function Badge({ tone = "gray", children }: { tone?: "gray" | "green" | "red" | "blue" | "amber"; children: React.ReactNode }) {
  const map: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    green: "bg-green-100 text-green-700 border-green-200",
    red: "bg-red-100 text-red-700 border-red-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
  };
  return <span className={cls("inline-flex px-2 py-0.5 rounded-full text-xs border", map[tone])}>{children}</span>;
}

/** ---------------- Toast (tiny) ---------------- */
function useToast() {
  const [msg, setMsg] = useState<string>("");
  const [open, setOpen] = useState(false);
  function show(m: string, ms = 1600) {
    setMsg(m);
    setOpen(true);
    window.setTimeout(() => setOpen(false), ms);
  }
  const el = open ? (
    <div className="fixed bottom-4 right-4 z-[60]">
      <div className="rounded-lg bg-black text-white/90 px-3 py-2 text-sm shadow-lg/50 shadow-black/50">
        {msg}
      </div>
    </div>
  ) : null;
  return { show, Toast: () => el };
}

/** ---------------- Summary ---------------- */
function Summary({
  build,
  onReset,
  taxRate,
  discountTHB,
  costRate,
}: {
  build: BuildState;
  onReset?: () => void;
  taxRate: number;
  discountTHB: number;
  costRate: number;
}) {
  const items = Object.entries(build.selection)
    .filter(([, p]) => !!p)
    .map(([c, p]) => ({ cat: c as Category, p: p as Product }));

  const totalAddons = build.addons.reduce((s, a) => s + a.product.price * a.qty, 0);
  const totalParts = items.reduce((s, it) => s + it.p.price, 0);
  const subTotal = totalParts + totalAddons;
  const tax = (Math.max(taxRate, 0) / 100) * subTotal;
  const afterTax = subTotal + tax;
  const discount = Math.min(Math.max(discountTHB, 0), afterTax);
  const net = afterTax - discount;

  const cost = (Math.max(costRate, 0) / 100) * subTotal;
  const profit = Math.max(net - cost, 0);

  return (
    <div className="rounded-2xl border p-5 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">สรุปสเปค</h2>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md border hover:bg-gray-50 transition" onClick={onReset}>รีเซ็ตสเปค</button>
          <button
            className="px-3 py-1.5 rounded-md border hover:bg-gray-50 transition"
            onClick={() => {
              const payload = { selection: build.selection, addons: build.addons, totals: { subTotal, tax, discount, net, cost, profit } };
              const name = `build-summary-${new Date().toISOString().slice(0,19)}.json`;
              const data = JSON.stringify(payload, null, 2);
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
            }}
          >
            Export (JSON)
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map(({ cat, p }) => (
          <div key={cat} className="flex items-center justify-between border rounded-xl px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">{cat}</div>
              <div className="text-gray-500">{p.name}</div>
            </div>
            <div className="font-medium">{baht(p.price)}</div>
          </div>
        ))}
        {build.addons.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-gray-50 border">
            <div className="text-sm">
              <div className="font-medium">เสริม: {a.product.name}</div>
              <div className="text-gray-500">x{a.qty}</div>
            </div>
            <div className="font-medium">{baht(a.product.price * a.qty)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mt-4">
        <div className="text-gray-600">รวมอุปกรณ์</div>
        <div className="text-right font-medium">{baht(subTotal)}</div>
        <div className="text-gray-600">ภาษี ({taxRate}%)</div>
        <div className="text-right font-medium">{baht(tax)}</div>
        <div className="text-gray-600">ส่วนลด</div>
        <div className="text-right font-medium">- {baht(discount)}</div>
        <div className="col-span-2 border-t my-1" />
        <div className="text-base font-semibold">สุทธิ</div>
        <div className="text-right text-base font-semibold">{baht(net)}</div>

        <div className="col-span-2 border-t my-1" />
        <div className="text-gray-600">ราคาทุน (≈ {costRate}%)</div>
        <div className="text-right font-medium">{baht(cost)}</div>
        <div className="text-gray-600">กำไรโดยประมาณ</div>
        <div className="text-right font-semibold">{baht(profit)}</div>
      </div>
    </div>
  );
}

/** ---------------- App ---------------- */
export default function App() {
  const { show, Toast } = useToast();
  const [tab, setTab] = useState<"builder" | "inventory" | "summary">("builder");

  // data
  const [inventory, setInventory] = useState<Product[]>(() => {
    try { const raw = localStorage.getItem("inv"); if (raw) return JSON.parse(raw); } catch {}
    return DEFAULT_INVENTORY;
  });
  const [build, setBuild] = useState<BuildState>(() => {
    try { const raw = localStorage.getItem("build"); if (raw) return JSON.parse(raw); } catch {}
    return { selection: {}, addons: [] };
  });

  // pricing
  const [taxRate, setTaxRate] = useState<number>(() => Number(localStorage.getItem("taxRate") || 0));
  const [discountTHB, setDiscountTHB] = useState<number>(() => Number(localStorage.getItem("discountTHB") || 0));
  const [costRate, setCostRate] = useState<number>(() => Number(localStorage.getItem("costRate") || 70));

  // search/filter/sort
  const [searchOpen, setSearchOpen] = useState(false);
  const [addonOpen, setAddonOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<"default" | "priceAsc" | "priceDesc" | "nameAsc" | "stockDesc">("default");
  const [attrBrand, setAttrBrand] = useState<string>("");
  const [attrSocket, setAttrSocket] = useState<string>("");
  const [attrSize, setAttrSize] = useState<string>("");

  // edit product inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  // persist
  useEffect(() => { localStorage.setItem("inv", JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem("build", JSON.stringify(build)); }, [build]);
  useEffect(() => { localStorage.setItem("taxRate", String(taxRate)); }, [taxRate]);
  useEffect(() => { localStorage.setItem("discountTHB", String(discountTHB)); }, [discountTHB]);
  useEffect(() => { localStorage.setItem("costRate", String(costRate)); }, [costRate]);

  function resetSpec() {
    setBuild({ selection: {}, addons: [] });
    show("รีเซ็ตสเปคแล้ว");
  }

  const filtered = useMemo(() => {
    let arr = [...inventory];
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      arr = arr.filter((p) => `${p.name} ${p.brand ?? ""} ${p.socket ?? ""} ${p.size ?? ""}`.toLowerCase().includes(q));
    }
    if (attrBrand) arr = arr.filter((p) => (p.brand || "") === attrBrand);
    if (attrSocket) arr = arr.filter((p) => (p.socket || "") === attrSocket);
    if (attrSize) arr = arr.filter((p) => (p.size || "") === attrSize);

    switch (sortMode) {
      case "priceAsc": arr.sort((a, b) => a.price - b.price); break;
      case "priceDesc": arr.sort((a, b) => b.price - a.price); break;
      case "nameAsc": arr.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "stockDesc": arr.sort((a, b) => (b.stock || 0) - (a.stock || 0)); break;
      default: break;
    }
    return arr;
  }, [inventory, searchText, sortMode, attrBrand, attrSocket, attrSize]);

  function selectPart(cat: Category, product: Product | null) {
    setBuild((prev) => ({ ...prev, selection: { ...prev.selection, [cat]: product || undefined } }));
    show(product ? `เลือก ${cat} แล้ว` : `เอา ${cat} ออกแล้ว`);
  }

  function addAddon(p: Product) {
    setBuild((prev) => {
      const exist = prev.addons.find((a) => a.product.id === p.id);
      if (exist) {
        return { ...prev, addons: prev.addons.map((a) => (a.product.id === p.id ? { ...a, qty: Math.min(a.qty + 1, p.stock) } : a)) };
      }
      return { ...prev, addons: [...prev.addons, { id: uid("ad"), product: p, qty: 1 }] };
    });
    show(`เพิ่ม ${p.name}`);
  }
  function setAddonQty(id: string, qty: number) {
    setBuild((prev) => ({ ...prev, addons: prev.addons.map((a) => (a.id === id ? { ...a, qty: Math.max(1, Math.min(qty, a.product.stock)) } : a)) }));
  }
  function removeAddon(id: string) {
    setBuild((prev) => ({ ...prev, addons: prev.addons.filter((a) => a.id !== id) }));
  }

  function onEdit(id: string) {
    const p = inventory.find((x) => x.id === id); if (!p) return;
    setEditingId(id); setEditForm({ ...p });
  }
  function onCancelEdit() { setEditingId(null); setEditForm({}); }
  function onSaveEdit() {
    if (!editingId) return;
    setInventory((prev) => prev.map((x) => (x.id === editingId ? { ...(x as Product), ...(editForm as Product) } : x)));
    onCancelEdit();
    show("บันทึกสินค้าแล้ว");
  }

  function onImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      try {
        const rows = parseCSV(text);
        if (rows.length) {
          setInventory((prev) => {
            const dict = new Map(prev.map((p) => [p.id, p]));
            rows.forEach((r) => dict.set(r.id, r));
            return Array.from(dict.values());
          });
          show(`นำเข้า ${rows.length} รายการ`);
        } else {
          show("ไม่พบข้อมูลในไฟล์");
        }
      } catch { show("ไฟล์ไม่ถูกต้อง"); }
    };
    reader.readAsText(file);
    e.currentTarget.value = "";
  }
  function exportInventory() {
    const name = `inventory-${new Date().toISOString().slice(0,19)}.json`;
    const data = JSON.stringify(inventory, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }

  const addonChoices = inventory.filter((p) => p.category === "Monitor" || p.category === "Software" || p.category === "SSD");

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b backdrop-blur bg-white/85">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black text-white grid place-items-center text-sm">UC</div>
            <div>
              <div className="font-bold leading-none">Ubon Computer Spec V.4</div>
              <div className="text-[11px] text-gray-500 leading-none">จัดสเปคคอมพิวเตอร์ • ใช้ง่าย • สรุปราคา</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-md border hover:bg-gray-50 transition" onClick={() => setSearchOpen(true)}>ค้นหา/เลือก</button>
            <button className="px-3 py-1.5 rounded-md border hover:bg-gray-50 transition" onClick={() => setAddonOpen(true)}>เพิ่มออปชัน</button>
            <button className="px-3 py-1.5 rounded-md border hover:bg-gray-50 transition" onClick={resetSpec}>รีเซ็ต</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="inline-flex rounded-full border bg-white overflow-hidden shadow-sm">
          {(["builder","inventory","summary"] as const).map((t) => (
            <button
              key={t}
              className={cls("px-4 py-2 text-sm transition", tab === t ? "bg-gray-900 text-white" : "hover:bg-gray-50")}
              onClick={() => setTab(t)}
            >
              {t === "builder" ? "จัดสเปค" : t === "inventory" ? "คลังสินค้า" : "สรุป"}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "builder" && (
          <div className="mt-6 space-y-5">
            {/* pricing controls */}
            <div className="rounded-2xl border p-5 bg-white shadow-sm">
              <h2 className="font-semibold mb-3">ตั้งค่าราคา</h2>
              <div className="grid md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm text-gray-600">ภาษี (%)</span>
                  <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-gray-300" />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">ส่วนลด (บาท)</span>
                  <input type="number" value={discountTHB} onChange={(e) => setDiscountTHB(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-gray-300" />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">ราคาทุนโดยประมาณ (%)</span>
                  <input type="number" value={costRate} onChange={(e) => setCostRate(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-gray-300" />
                </label>
              </div>
            </div>

            {/* select parts */}
            <div className="rounded-2xl border p-5 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">เลือกชิ้นส่วน</h2>
                <div className="text-xs text-gray-500">
                  หมวดจำเป็น: <Badge tone="blue">CPU</Badge> <Badge tone="blue">Motherboard</Badge> <Badge tone="blue">PSU</Badge>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {ALL_CATS.map((cat) => (
                  <div key={cat} className="border rounded-xl p-3 hover:shadow-sm transition">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{cat}</div>
                      <div className="flex items-center gap-2">
                        {build.selection[cat] && (
                          <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => selectPart(cat, null)}>เอาออก</button>
                        )}
                        <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => setSearchOpen(true)}>เลือก</button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 mt-2">{build.selection[cat]?.name || "ยังไม่ได้เลือก"}</div>
                  </div>
                ))}
              </div>

              {/* addons */}
              {build.addons.length > 0 && (
                <div className="mt-5">
                  <h3 className="font-semibold mb-2">ออปชันเสริม</h3>
                  <div className="space-y-2">
                    {build.addons.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                        <div className="text-sm">
                          <div className="font-medium">{a.product.name}</div>
                          <div className="text-gray-500">{a.product.category}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" className="w-20 px-2 py-1 rounded-md border" value={a.qty} min={1} max={a.product.stock} onChange={(e) => setAddonQty(a.id, Number(e.target.value))} />
                          <div className="w-24 text-right font-medium">{baht(a.product.price * a.qty)}</div>
                          <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => removeAddon(a.id)}>ลบ</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "inventory" && (
          <div className="mt-6">
            <div className="rounded-2xl border p-5 bg-white shadow-sm">
              <div className="grid md:grid-cols-2 gap-3 mb-3">
                <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={'ค้นหา: "Ryzen", "27\\"", "Windows"'} className="px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-gray-300" />
                <div className="flex flex-wrap gap-2">
                  <select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)} className="px-3 py-2 rounded-md border">
                    <option value="default">จัดเรียง</option>
                    <option value="priceAsc">ราคาต่ำ→สูง</option>
                    <option value="priceDesc">ราคาสูง→ต่ำ</option>
                    <option value="nameAsc">ชื่อ A→Z</option>
                    <option value="stockDesc">สต็อกมาก→น้อย</option>
                  </select>
                  <select value={attrBrand} onChange={(e) => setAttrBrand(e.target.value)} className="px-3 py-2 rounded-md border">
                    <option value="">แบรนด์</option><option value="AMD">AMD</option><option value="Intel">Intel</option>
                  </select>
                  <select value={attrSocket} onChange={(e) => setAttrSocket(e.target.value)} className="px-3 py-2 rounded-md border">
                    <option value="">ซ็อกเก็ต</option><option value="AM4">AM4</option><option value="LGA1700">LGA1700</option>
                  </select>
                  <select value={attrSize} onChange={(e) => setAttrSize(e.target.value)} className="px-3 py-2 rounded-md border">
                    <option value="">ขนาด</option><option value="ATX">ATX</option><option value="mATX">mATX</option>
                  </select>
                  <button className="px-3 py-2 rounded-md border hover:bg-gray-50" onClick={() => { setAttrBrand(""); setAttrSocket(""); setAttrSize(""); }}>ล้างตัวกรอง</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <label className="px-3 py-2 rounded-md border cursor-pointer hover:bg-gray-50">Import CSV
                  <input onChange={onImportCSV} type="file" accept=".csv" className="hidden" />
                </label>
                <button className="px-3 py-2 rounded-md border hover:bg-gray-50" onClick={exportInventory}>Export (JSON)</button>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {filtered.map((p) => {
                  const ok = isCompatible(build.selection, p);
                  const isEditing = editingId === p.id;
                  return (
                    <div key={p.id} className="border rounded-xl p-3 hover:shadow-sm transition">
                      {!isEditing ? (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium">{p.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {p.category} • สต็อก {p.stock} {p.brand ? `• ${p.brand}` : ""} {p.socket ? `• ${p.socket}` : ""}
                              </div>
                            </div>
                            <div className="text-right font-semibold whitespace-nowrap">{baht(p.price)}</div>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge tone={ok ? "green" : "red"}>{ok ? "เข้ากันได้" : "อาจไม่เข้ากัน"}</Badge>
                              {p.size && <Badge tone="gray">{p.size}</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => onEdit(p.id)}>แก้ไข</button>
                              <button
                                className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50"
                                disabled={!ok}
                                onClick={() => (p.category === "Monitor" || p.category === "Software" || p.category === "SSD") ? addAddon(p) : selectPart(p.category as Category, p)}
                              >
                                เลือก
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <input className="px-2 py-1 rounded-md border" value={String(editForm.name ?? p.name)} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                            <input className="px-2 py-1 rounded-md border" type="number" value={Number(editForm.price ?? p.price)} onChange={(e) => setEditForm((f) => ({ ...f, price: Number(e.target.value) }))} />
                            <input className="px-2 py-1 rounded-md border" type="number" value={Number(editForm.stock ?? p.stock)} onChange={(e) => setEditForm((f) => ({ ...f, stock: Number(e.target.value) }))} />
                            <input className="px-2 py-1 rounded-md border" value={String(editForm.brand ?? p.brand ?? "")} onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))} placeholder="brand" />
                            <input className="px-2 py-1 rounded-md border" value={String(editForm.socket ?? p.socket ?? "")} onChange={(e) => setEditForm((f) => ({ ...f, socket: e.target.value }))} placeholder="socket" />
                            <input className="px-2 py-1 rounded-md border" value={String(editForm.size ?? p.size ?? "")} onChange={(e) => setEditForm((f) => ({ ...f, size: e.target.value }))} placeholder="size" />
                          </div>
                          <div className="flex items-center justify-end gap-2 mt-2">
                            <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={onCancelEdit}>ยกเลิก</button>
                            <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={onSaveEdit}>บันทึก</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "summary" && (
          <div className="mt-6 space-y-5">
            <Summary build={build} onReset={resetSpec} taxRate={taxRate} discountTHB={discountTHB} costRate={costRate} />
          </div>
        )}
      </div>

      {/* SEARCH POPUP */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSearchOpen(false)} />
          <div className="relative z-10 bg-white rounded-2xl border w-full max-w-3xl p-0 shadow-xl overflow-hidden">
            {/* header */}
            <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
              <div>
                <div className="text-lg font-semibold">ค้นหา/เลือกสินค้า</div>
                <div className="text-sm text-gray-500">ระบบจะกันสินค้าที่อาจไม่เข้ากันกับชิ้นส่วนที่เลือกไว้</div>
              </div>
              <button aria-label="Close" className="w-8 h-8 rounded-md border bg-white hover:bg-gray-50" onClick={() => setSearchOpen(false)}>×</button>
            </div>

            {/* sticky tools */}
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-2">
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={'ค้นหา: "Ryzen", "27\\"", "Windows"'} className="flex-1 px-3 py-2 rounded-md border" />
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)} className="px-3 py-2 rounded-md border">
                <option value="default">ค่าเริ่มต้น</option>
                <option value="priceAsc">ราคาต่ำ→สูง</option>
                <option value="priceDesc">ราคาสูง→ต่ำ</option>
                <option value="nameAsc">ชื่อ A→Z</option>
                <option value="stockDesc">สต็อกมาก→น้อย</option>
              </select>
            </div>

            {/* list */}
            <div className="p-4 grid sm:grid-cols-2 gap-3 max-h-[70vh] overflow-auto">
              {filtered.map((p) => {
                const ok = isCompatible(build.selection, p);
                return (
                  <div key={p.id} className="border rounded-xl p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.category} • สต็อก {p.stock}</div>
                      </div>
                      <div className="text-right font-semibold">{baht(p.price)}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge tone={ok ? "green" : "red"}>{ok ? "เข้ากันได้" : "อาจไม่เข้ากัน"}</Badge>
                        {p.socket && <Badge tone="gray">Socket {p.socket}</Badge>}
                        {p.size && <Badge tone="gray">{p.size}</Badge>}
                      </div>
                      <button
                        className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50"
                        disabled={!ok}
                        onClick={() => {
                          if (p.category === "Monitor" || p.category === "Software" || p.category === "SSD") {
                            addAddon(p);
                          } else {
                            selectPart(p.category as Category, p);
                          }
                          setSearchOpen(false);
                        }}
                      >
                        เลือก
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ADDON POPUP */}
      {addonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddonOpen(false)} />
          <div className="relative z-10 bg-white rounded-2xl border w-full max-w-2xl p-0 shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
              <div className="text-lg font-semibold">เพิ่มออปชันเสริม</div>
              <button aria-label="Close" className="w-8 h-8 rounded-md border bg-white hover:bg-gray-50" onClick={() => setAddonOpen(false)}>×</button>
            </div>

            <div className="p-4 grid sm:grid-cols-2 gap-3 max-h-[70vh] overflow-auto">
              {addonChoices.map((p) => (
                <div key={p.id} className="border rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{p.category} • สต็อก {p.stock}</div>
                    </div>
                    <div className="text-right font-semibold">{baht(p.price)}</div>
                  </div>
                  <div className="mt-2 text-right">
                    <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => addAddon(p)}>เพิ่ม</button>
                  </div>
                </div>
              ))}
            </div>

            {build.addons.length > 0 && (
              <div className="border-t p-4">
                <h4 className="font-medium mb-2">ออปชันที่เลือก</h4>
                <div className="space-y-2">
                  {build.addons.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                      <div className="text-sm">
                        <div className="font-medium">{a.product.name}</div>
                        <div className="text-gray-500">{a.product.category}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" className="w-20 px-2 py-1 rounded-md border" min={1} max={a.product.stock} value={a.qty} onChange={(e) => setAddonQty(a.id, Number(e.target.value))} />
                        <div className="w-24 text-right font-medium">{baht(a.product.price * a.qty)}</div>
                        <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => removeAddon(a.id)}>ลบ</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right mt-3">
                  <button className="px-3 py-1.5 rounded-md border hover:bg-gray-50" onClick={() => setAddonOpen(false)}>ปิด</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Toast />
    </div>
  );
}

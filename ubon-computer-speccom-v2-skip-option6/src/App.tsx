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
  size?: string; // form factor, etc.
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

function isCompatible(sel: BuildState["selection"], cand: Product) {
  // Simple compatibility: CPU <-> MB socket, GPU requires PSU watt >= 550
  if (cand.category === "Motherboard" && sel.CPU?.socket && cand.socket && sel.CPU.socket !== cand.socket) return false;
  if (cand.category === "CPU" && sel.Motherboard?.socket && cand.socket && sel.Motherboard.socket !== cand.socket) return false;
  if (cand.category === "GPU" && sel.PSU?.watt && sel.PSU.watt < 550) return false;
  return true;
}

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
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

/** ---------------- Summary ---------------- */
function Summary({
  build,
  onReset,
  taxRate, // %
  discountTHB,
  costRate, // % ของราคาขาย (ราคาทุนโดยประมาณ)
}: {
  build: BuildState;
  onReset?: () => void;
  taxRate: number;
  discountTHB: number;
  costRate: number;
}) {
  const missing = requiredCats.filter((c) => !build.selection[c]);
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

  const cost = (Math.max(costRate, 0) / 100) * subTotal; // ราคาทุนประมาณการ
  const profit = Math.max(net - cost, 0);

  return (
    <div className="rounded-xl border p-4 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">สรุปสเปค</h2>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded-md border hover:bg-gray-50" onClick={onReset}>
            รีเซ็ตสเปค
          </button>
          <button
            className="px-3 py-1 rounded-md border hover:bg-gray-50"
            onClick={() => {
              const payload = {
                selection: build.selection,
                addons: build.addons,
                totals: { subTotal, tax, discount, net, cost, profit },
              };
              download(`build-summary-${new Date().toISOString().slice(0, 19)}.json`, JSON.stringify(payload, null, 2));
            }}
          >
            Export สรุป (JSON)
          </button>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="border rounded-md p-3 bg-red-50 border-red-200 text-sm text-red-700 mb-3">
          ยังขาดหมวดจำเป็น: {missing.join(" , ")}
        </div>
      )}

      <div className="space-y-2">
        {items.map(({ cat, p }) => (
          <div key={cat} className="flex items-center justify-between border rounded-md px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">{cat}</div>
              <div className="text-gray-500">{p.name}</div>
            </div>
            <div className="font-medium">{baht(p.price)}</div>
          </div>
        ))}
        {build.addons.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-md px-3 py-2 bg-gray-50">
            <div className="text-sm">
              <div className="font-medium">เสริม: {a.product.name}</div>
              <div className="text-gray-500">x{a.qty}</div>
            </div>
            <div className="font-medium">{baht(a.product.price * a.qty)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mt-3">
        <div className="text-gray-600">รวมอุปกรณ์หลัก+เสริม</div>
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
  const [tab, setTab] = useState<"builder" | "inventory" | "summary">("builder");

  // data
  const [inventory, setInventory] = useState<Product[]>(() => {
    try {
      const raw = localStorage.getItem("inv");
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_INVENTORY;
  });

  const [build, setBuild] = useState<BuildState>(() => {
    try {
      const raw = localStorage.getItem("build");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { selection: {}, addons: [] };
  });

  // pricing controls
  const [taxRate, setTaxRate] = useState<number>(() => {
    const v = localStorage.getItem("taxRate");
    return v ? Number(v) : 0;
  });
  const [discountTHB, setDiscountTHB] = useState<number>(() => {
    const v = localStorage.getItem("discountTHB");
    return v ? Number(v) : 0;
  });
  const [costRate, setCostRate] = useState<number>(() => {
    const v = localStorage.getItem("costRate");
    return v ? Number(v) : 70; // สมมติทุน ~70% ของยอดขาย
  });

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
  useEffect(() => {
    localStorage.setItem("inv", JSON.stringify(inventory));
  }, [inventory]);
  useEffect(() => {
    localStorage.setItem("build", JSON.stringify(build));
  }, [build]);
  useEffect(() => {
    localStorage.setItem("taxRate", String(taxRate));
  }, [taxRate]);
  useEffect(() => {
    localStorage.setItem("discountTHB", String(discountTHB));
  }, [discountTHB]);
  useEffect(() => {
    localStorage.setItem("costRate", String(costRate));
  }, [costRate]);

  function resetSpec() {
    setBuild({ selection: {}, addons: [] });
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
      case "priceAsc":
        arr.sort((a, b) => a.price - b.price);
        break;
      case "priceDesc":
        arr.sort((a, b) => b.price - a.price);
        break;
      case "nameAsc":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "stockDesc":
        arr.sort((a, b) => (b.stock || 0) - (a.stock || 0));
        break;
      default:
        break;
    }
    return arr;
  }, [inventory, searchText, sortMode, attrBrand, attrSocket, attrSize]);

  function selectPart(cat: Category, product: Product | null) {
    setBuild((prev) => ({
      ...prev,
      selection: { ...prev.selection, [cat]: product || undefined },
    }));
  }

  function addAddon(p: Product) {
    setBuild((prev) => {
      const exist = prev.addons.find((a) => a.product.id === p.id);
      if (exist) {
        return {
          ...prev,
          addons: prev.addons.map((a) =>
            a.product.id === p.id ? { ...a, qty: Math.min(a.qty + 1, p.stock) } : a
          ),
        };
      }
      return { ...prev, addons: [...prev.addons, { id: uid("ad"), product: p, qty: 1 }] };
    });
  }
  function setAddonQty(id: string, qty: number) {
    setBuild((prev) => ({
      ...prev,
      addons: prev.addons.map((a) => (a.id === id ? { ...a, qty: Math.max(1, Math.min(qty, a.product.stock)) } : a)),
    }));
  }
  function removeAddon(id: string) {
    setBuild((prev) => ({ ...prev, addons: prev.addons.filter((a) => a.id !== id) }));
  }

  function onEdit(id: string) {
    const p = inventory.find((x) => x.id === id);
    if (!p) return;
    setEditingId(id);
    setEditForm({ ...p });
  }
  function onCancelEdit() {
    setEditingId(null);
    setEditForm({});
  }
  function onSaveEdit() {
    if (!editingId) return;
    setInventory((prev) => prev.map((x) => (x.id === editingId ? { ...(x as Product), ...(editForm as Product) } : x)));
    onCancelEdit();
  }

  function onImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
          alert(`นำเข้าสำเร็จ: ${rows.length} รายการ`);
        } else {
          alert("ไม่พบข้อมูลในไฟล์ CSV");
        }
      } catch (err) {
        alert("ไฟล์ไม่ถูกต้อง");
      }
    };
    reader.readAsText(file);
    e.currentTarget.value = "";
  }

  function exportInventory() {
    download(`inventory-${new Date().toISOString().slice(0, 19)}.json`, JSON.stringify(inventory, null, 2));
  }

  // choices for addon popup
  const addonChoices = inventory.filter((p) => p.category === "Monitor" || p.category === "Software" || p.category === "SSD");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Ubon Computer Spec V.4</h1>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded-md border hover:bg-gray-50" onClick={() => setSearchOpen(true)}>
              ค้นหา/เลือกสินค้า
            </button>
            <button className="px-3 py-1 rounded-md border hover:bg-gray-50" onClick={() => setAddonOpen(true)}>
              เพิ่มออปชันเสริม
            </button>
            <button className="px-3 py-1 rounded-md border hover:bg-gray-50" onClick={resetSpec}>
              รีเซ็ตสเปค
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4">
          <div className="inline-flex rounded-md border bg-white overflow-hidden">
            <button className={`px-4 py-2 text-sm ${tab === "builder" ? "bg-gray-100 font-medium" : ""}`} onClick={() => setTab("builder")}>
              จัดสเปค
            </button>
            <button className={`px-4 py-2 text-sm ${tab === "inventory" ? "bg-gray-100 font-medium" : ""}`} onClick={() => setTab("inventory")}>
              คลังสินค้า
            </button>
            <button className={`px-4 py-2 text-sm ${tab === "summary" ? "bg-gray-100 font-medium" : ""}`} onClick={() => setTab("summary")}>
              สรุป
            </button>
          </div>

          {/* BUILDER */}
          {tab === "builder" && (
            <div className="mt-4 space-y-4">
              {/* pricing controls quick bar */}
              <div className="rounded-xl border p-4 bg-white">
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">ภาษี (%)</div>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-md border"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">ส่วนลด (บาท)</div>
                    <input
                      type="number"
                      value={discountTHB}
                      onChange={(e) => setDiscountTHB(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-md border"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">ราคาทุนโดยประมาณ (%)</div>
                    <input
                      type="number"
                      value={costRate}
                      onChange={(e) => setCostRate(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-md border"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border p-4 bg-white">
                <h2 className="text-lg font-semibold mb-3">เลือกชิ้นส่วน</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {ALL_CATS.map((cat) => (
                    <div key={cat} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{cat}</div>
                        <div className="flex items-center gap-2">
                          {build.selection[cat] && (
                            <button
                              className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50"
                              onClick={() => selectPart(cat, null)}
                            >
                              เอาออก
                            </button>
                          )}
                          <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => setSearchOpen(true)}>
                            เลือก
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 mt-2">{build.selection[cat]?.name || "ยังไม่ได้เลือก"}</div>
                    </div>
                  ))}
                </div>

                {/* addons list */}
                {build.addons.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">ออปชันเสริม</h3>
                    <div className="space-y-2">
                      {build.addons.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div className="text-sm">
                            <div className="font-medium">{a.product.name}</div>
                            <div className="text-gray-500">{a.product.category}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="w-20 px-2 py-1 rounded-md border"
                              value={a.qty}
                              min={1}
                              max={a.product.stock}
                              onChange={(e) => setAddonQty(a.id, Number(e.target.value))}
                            />
                            <div className="w-24 text-right font-medium">{baht(a.product.price * a.qty)}</div>
                            <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => removeAddon(a.id)}>
                              ลบ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {tab === "inventory" && (
            <div className="mt-4">
              <div className="rounded-xl border p-4 bg-white">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder={'พิมพ์คำค้น เช่น "Ryzen", "27\\"", "Windows"'}
                    className="w-64 px-3 py-2 rounded-md border"
                  />
                  <select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)} className="px-3 py-2 rounded-md border">
                    <option value="default">จัดเรียง: ค่าเริ่มต้น</option>
                    <option value="priceAsc">ราคาต่ำ→สูง</option>
                    <option value="priceDesc">ราคาสูง→ต่ำ</option>
                    <option value="nameAsc">ชื่อ A→Z</option>
                    <option value="stockDesc">สต็อกมาก→น้อย</option>
                  </select>

                  <select value={attrBrand} onChange={(e) => setAttrBrand(e.target.value)} className="px-3 py-2 rounded-md border">
                    <option value="">แบรนด์: ทั้งหมด</option>
                    <option value="AMD">AMD</option>
                    <option value="Intel">Intel</option>
                  </select>

                  <select value={attrSocket} onChange={(e) => setAttrSocket(e.target.value)} className="px-3 py-2 rounded-md border">
                    <option value="">ซ็อกเก็ต: ทั้งหมด</option>
                    <option value="AM4">AM4</option>
                    <option value="LGA1700">LGA1700</option>
                  </select>

                  <select value={attrSize} onChange={(e) => setAttrSize(e.target.value)} className="px-3 py-2 rounded-md border">
                    <option value="">ขนาด/ฟอร์มแฟกเตอร์: ทั้งหมด</option>
                    <option value="ATX">ATX</option>
                    <option value="mATX">mATX</option>
                  </select>

                  <button
                    className="px-3 py-2 rounded-md border hover:bg-gray-50"
                    onClick={() => {
                      setAttrBrand("");
                      setAttrSocket("");
                      setAttrSize("");
                    }}
                  >
                    ล้างตัวกรอง
                  </button>

                  <label className="px-3 py-2 rounded-md border cursor-pointer hover:bg-gray-50">
                    Import CSV
                    <input onChange={onImportCSV} type="file" accept=".csv" className="hidden" />
                  </label>

                  <button className="px-3 py-2 rounded-md border hover:bg-gray-50" onClick={exportInventory}>
                    Export Inventory (JSON)
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {filtered.map((p) => {
                    const isEditing = editingId === p.id;
                    return (
                      <div key={p.id} className="border rounded-md p-3">
                        {!isEditing ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{p.name}</div>
                                <div className="text-sm text-gray-500">
                                  {p.category} • สต็อก {p.stock}
                                </div>
                              </div>
                              <div className="text-right font-semibold">{baht(p.price)}</div>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="text-xs text-gray-500">{p.socket ? `Socket ${p.socket}` : p.brand ? p.brand : p.size || ""}</div>
                              <div className="flex items-center gap-2">
                                <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => onEdit(p.id)}>
                                  แก้ไข
                                </button>
                                <button
                                  className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50"
                                  disabled={!isCompatible(build.selection, p)}
                                  onClick={() =>
                                    p.category === "Monitor" || p.category === "Software" || p.category === "SSD"
                                      ? addAddon(p)
                                      : selectPart(p.category as Category, p)
                                  }
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
                              <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={onCancelEdit}>
                                ยกเลิก
                              </button>
                              <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={onSaveEdit}>
                                บันทึก
                              </button>
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

          {/* SUMMARY */}
          {tab === "summary" && (
            <div className="mt-4 space-y-4">
              <Summary build={build} onReset={resetSpec} taxRate={taxRate} discountTHB={discountTHB} costRate={costRate} />
            </div>
          )}
        </div>
      </div>

      {/* SEARCH POPUP */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSearchOpen(false)} />
          <div className="relative z-10 bg-white rounded-xl border w-full max-w-3xl p-4 shadow-lg">
            {/* header with X */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-lg font-semibold">ค้นหา/เลือกสินค้า</div>
                <div className="text-sm text-gray-500">เลือกสินค้าที่เข้ากันได้ ระบบจะกันตัวที่ไม่เข้ากันกับชิ้นส่วนที่เลือกไว้</div>
              </div>
              <button aria-label="Close" className="w-8 h-8 rounded-md border hover:bg-gray-50" onClick={() => setSearchOpen(false)}>
                ×
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={'พิมพ์คำค้น เช่น "Ryzen", "27\\"", "Windows"'}
                className="flex-1 px-3 py-2 rounded-md border"
              />
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)} className="px-3 py-2 rounded-md border">
                <option value="default">ค่าเริ่มต้น</option>
                <option value="priceAsc">ราคาต่ำ→สูง</option>
                <option value="priceDesc">ราคาสูง→ต่ำ</option>
                <option value="nameAsc">ชื่อ A→Z</option>
                <option value="stockDesc">สต็อกมาก→น้อย</option>
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
              {filtered.map((p) => (
                <div key={p.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-gray-500">
                        {p.category} • สต็อก {p.stock}
                      </div>
                    </div>
                    <div className="text-right font-semibold">{baht(p.price)}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {p.socket ? `Socket ${p.socket}` : p.brand ? p.brand : p.size || ""}
                    </div>
                    <button
                      className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-50"
                      disabled={!isCompatible(build.selection, p)}
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
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ADDON POPUP */}
      {addonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddonOpen(false)} />
          <div className="relative z-10 bg-white rounded-xl border w-full max-w-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">เพิ่มออปชันเสริม (Monitor / Software / SSD)</div>
              <button aria-label="Close" className="w-8 h-8 rounded-md border hover:bg-gray-50" onClick={() => setAddonOpen(false)}>
                ×
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
              {addonChoices.map((p) => (
                <div key={p.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-gray-500">{p.category} • สต็อก {p.stock}</div>
                    </div>
                    <div className="text-right font-semibold">{baht(p.price)}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => addAddon(p)}>
                      เพิ่ม
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {build.addons.length > 0 && (
              <div className="mt-3">
                <h4 className="font-medium mb-2">ออปชันที่เลือก</h4>
                <div className="space-y-2">
                  {build.addons.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="text-sm">
                        <div className="font-medium">{a.product.name}</div>
                        <div className="text-gray-500">{a.product.category}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-20 px-2 py-1 rounded-md border"
                          min={1}
                          max={a.product.stock}
                          value={a.qty}
                          onChange={(e) => setAddonQty(a.id, Number(e.target.value))}
                        />
                        <div className="w-24 text-right font-medium">{baht(a.product.price * a.qty)}</div>
                        <button className="px-2 py-1 text-sm rounded-md border hover:bg-gray-50" onClick={() => removeAddon(a.id)}>
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-right mt-3">
              <button className="px-3 py-1 rounded-md border hover:bg-gray-50" onClick={() => setAddonOpen(false)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

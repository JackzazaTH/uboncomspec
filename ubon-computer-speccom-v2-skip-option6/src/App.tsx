import React, { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cpu, Monitor, Search, X, Plus, Trash2, Upload, RefreshCcw, ArrowUpDown, Edit2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import * as XLSX from "xlsx";

// --------------------------------------------
// Types
// --------------------------------------------
type Category =
  | "CPU" | "Motherboard" | "GPU" | "RAM" | "Storage" | "PSU" | "Case" | "Cooler";

type AddonKind = "Monitor" | "Software" | "SSD";

type Product = {
  id: string;
  name: string;
  category: Category | "Addon";
  price: number;
  cost?: number;
  stock: number;
  brand?: string;
  // attributes for compatibility
  socket?: string;            // CPU / Motherboard
  ramType?: "DDR4" | "DDR5";  // Motherboard / RAM
  formFactor?: "ATX" | "mATX" | "ITX"; // Motherboard / Case
  gpuMaxLen?: number;         // Case
  gpuLen?: number;            // GPU length
  tdp?: number;               // CPU TDP
  wattage?: number;           // PSU wattage
  addonKind?: AddonKind;      // when category === "Addon"
};

type Selection = Partial<Record<Category, Product | null>>;

type AddonPick = { product: Product; qty: number };

type SortMode = "default" | "priceAsc" | "priceDesc" | "nameAsc";

// --------------------------------------------
// Mock inventory (can be replaced via Excel import)
// --------------------------------------------
const initialInventory: Product[] = [
  { id:"cpu-5600", name:"Ryzen 5 5600", category:"CPU", price:3990, cost:3300, stock:5, brand:"AMD", socket:"AM4", tdp:65 },
  { id:"cpu-7600", name:"Ryzen 5 7600", category:"CPU", price:7490, cost:6400, stock:7, brand:"AMD", socket:"AM5", tdp:65 },
  { id:"cpu-i5-12400f", name:"Intel Core i5-12400F", category:"CPU", price:5600, cost:4800, stock:3, brand:"Intel", socket:"LGA1700", tdp:65 },

  { id:"mb-b550", name:"B550 mATX", category:"Motherboard", price:3990, cost:3200, stock:4, brand:"ASUS", socket:"AM4", ramType:"DDR4", formFactor:"mATX" },
  { id:"mb-b650", name:"B650 ATX DDR5", category:"Motherboard", price:6790, cost:5800, stock:6, brand:"MSI", socket:"AM5", ramType:"DDR5", formFactor:"ATX" },
  { id:"mb-b660", name:"B660 mATX DDR4", category:"Motherboard", price:4890, cost:4100, stock:2, brand:"Gigabyte", socket:"LGA1700", ramType:"DDR4", formFactor:"mATX" },

  { id:"ram-16-ddr4", name:"RAM 16GB DDR4 3200", category:"RAM", price:1290, cost:900, stock:10, brand:"Kingston", ramType:"DDR4" },
  { id:"ram-32-ddr5", name:"RAM 32GB DDR5 5600", category:"RAM", price:3590, cost:2900, stock:8, brand:"Corsair", ramType:"DDR5" },

  { id:"gpu-4060", name:"RTX 4060 8GB (242mm)", category:"GPU", price:11990, cost:10400, stock:5, brand:"MSI", gpuLen:242 },
  { id:"gpu-4070", name:"RTX 4070 12GB (300mm)", category:"GPU", price:19900, cost:17500, stock:3, brand:"ASUS", gpuLen:300 },

  { id:"storage-ssd1", name:"SSD NVMe 1TB", category:"Storage", price:2190, cost:1800, stock:12, brand:"WD" },
  { id:"storage-ssd2", name:"SSD SATA 500GB", category:"Storage", price:1190, cost:950, stock:9, brand:"Samsung" },

  { id:"psu-650", name:"PSU 650W 80+ Bronze", category:"PSU", price:1990, cost:1600, stock:6, brand:"Antec", wattage:650 },
  { id:"psu-750", name:"PSU 750W 80+ Gold", category:"PSU", price:3290, cost:2800, stock:4, brand:"Thermaltake", wattage:750 },

  { id:"case-matx", name:"เคส mATX (GPU ≤ 300mm)", category:"Case", price:1590, cost:1200, stock:10, brand:"Montech", gpuMaxLen:300, formFactor:"mATX" },
  { id:"case-itx", name:"เคส ITX (GPU ≤ 245mm)", category:"Case", price:2490, cost:2000, stock:4, brand:"CoolerMaster", gpuMaxLen:245, formFactor:"ITX" },

  { id:"cooler-120", name:"Cooler 120 A-RGB", category:"Cooler", price:1290, cost:900, stock:9, brand:"Deepcool" },

  // Addons
  { id:"mon-24", name:"Monitor 24\" 75Hz", category:"Addon", addonKind:"Monitor", price:3390, cost:2900, stock:8, brand:"AOC" },
  { id:"mon-27", name:"Monitor 27\" 144Hz", category:"Addon", addonKind:"Monitor", price:6990, cost:5900, stock:4, brand:"MSI" },
  { id:"soft-win", name:"Windows 11 Home (OEM)", category:"Addon", addonKind:"Software", price:3990, cost:3000, stock:99, brand:"Microsoft" },
  { id:"soft-ofc", name:"Office Home & Student", category:"Addon", addonKind:"Software", price:4490, cost:3600, stock:99, brand:"Microsoft" },
  { id:"ssd-extra", name:"SSD NVMe 1TB (เสริม)", category:"Addon", addonKind:"SSD", price:2190, cost:1800, stock:10, brand:"WD" },
];

const MAIN_CATEGORIES: Category[] = ["CPU","Motherboard","GPU","RAM","Storage","PSU","Case","Cooler"];
const REQUIRED: Category[] = ["CPU","Motherboard","PSU"];

// --------------------------------------------
// Helpers
// --------------------------------------------
const baht = (n:number) => n.toLocaleString("th-TH", { style:"currency", currency:"THB" });

function sortProducts(list: Product[], mode: SortMode): Product[] {
  const arr = [...list];
  if (mode === "priceAsc") return arr.sort((a,b)=>a.price-b.price);
  if (mode === "priceDesc") return arr.sort((a,b)=>b.price-a.price);
  if (mode === "nameAsc") return arr.sort((a,b)=>a.name.localeCompare(b.name));
  return arr;
}

function estimateWatt(selection: Selection): number {
  let watt = 100; // base
  if (selection.CPU?.tdp) watt += selection.CPU.tdp * 1.2;
  if (selection.GPU) watt += 180;
  if (selection.RAM) watt += 10;
  if (selection.Storage) watt += 8;
  if (selection.Cooler) watt += 5;
  return Math.ceil(watt);
}

function checkCompatibility(sel: Selection): string[] {
  const issues: string[] = [];
  const cpu = sel.CPU;
  const mb = sel.Motherboard;
  const ram = sel.RAM;
  const gpu = sel.GPU;
  const c = sel.Case;
  const psu = sel.PSU;

  if (cpu && mb && cpu.socket && mb.socket && cpu.socket !== mb.socket) {
    issues.push(`CPU (${cpu.socket}) ไม่เข้ากับ Mainboard (${mb.socket})`);
  }
  if (ram && mb && ram.ramType && mb.ramType && ram.ramType !== mb.ramType) {
    issues.push(`RAM (${ram.ramType}) ไม่เข้ากับ Mainboard (${mb.ramType})`);
  }
  if (gpu && c && gpu.gpuLen && c.gpuMaxLen && gpu.gpuLen > c.gpuMaxLen) {
    issues.push(`การ์ดจอยาว ${gpu.gpuLen}mm > เคสรองรับ ${c.gpuMaxLen}mm`);
  }
  const need = estimateWatt(sel);
  if (psu && psu.wattage && psu.wattage < need) {
    issues.push(`PSU ${psu.wattage}W อาจไม่พอ (ต้องการประมาณ ${need}W)`);
  }
  return issues;
}

// Excel → products
function parseWorkbookToProducts(file: File): Promise<Product[]> {
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type:"array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval:"" });
        const out: Product[] = rows.map((r,i)=>{
          const cat = (r.category || r.Category || "").trim();
          const addonKind = (r.addonKind || r.AddonKind || "").trim();
          return {
            id: (r.id || r.ID || `row-${i+1}`).toString(),
            name: (r.name || r.Name || "").toString(),
            category: cat === "Addon" ? "Addon" : (cat as any),
            price: Number(r.price || r.Price || 0),
            cost: r.cost ? Number(r.cost) : undefined,
            stock: Number(r.stock || r.Stock || 0),
            brand: r.brand || r.Brand || undefined,
            socket: r.socket || undefined,
            ramType: r.ramType || undefined,
            formFactor: r.formFactor || undefined,
            gpuMaxLen: r.gpuMaxLen ? Number(r.gpuMaxLen) : undefined,
            gpuLen: r.gpuLen ? Number(r.gpuLen) : undefined,
            tdp: r.tdp ? Number(r.tdp) : undefined,
            wattage: r.wattage ? Number(r.wattage) : undefined,
            addonKind: addonKind || undefined,
          } as Product;
        });
        resolve(out);
      } catch (e:any) {
        reject(e);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// --------------------------------------------
// UI Primitives (simple, compile-safe Dialog/Modal)
// --------------------------------------------
function Modal({
  open, onClose, children, title
}: { open:boolean; onClose:()=>void; title:string; children:React.ReactNode; }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-3xl rounded-2xl bg-white shadow-xl"
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.6 }}
          >
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="text-base font-semibold">{title}</div>
              <button aria-label="Close" onClick={onClose} className="rounded-md p-1.5 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --------------------------------------------
// Components
// --------------------------------------------
function ProductRow({
  p, onPick, onEdit
}: { p: Product; onPick?:()=>void; onEdit?:()=>void }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl border px-3 py-2 hover:bg-neutral-50">
      <div>
        <div className="font-medium">{p.name}</div>
        <div className="text-xs text-neutral-500 space-x-2">
          {p.brand && <span>แบรนด์: {p.brand}</span>}
          {p.socket && <span>ซ็อกเก็ต: {p.socket}</span>}
          {p.ramType && <span>RAM: {p.ramType}</span>}
          {p.formFactor && <span>ฟอร์มแฟกเตอร์: {p.formFactor}</span>}
          {p.gpuLen && <span>GPU: {p.gpuLen}mm</span>}
          {p.wattage && <span>PSU: {p.wattage}W</span>}
          {p.addonKind && <span>เสริม: {p.addonKind}</span>}
        </div>
      </div>
      <div className="text-right text-sm">{baht(p.price)}</div>
      <div className="text-right text-xs text-neutral-500">สต็อก {p.stock}</div>
      <div className="flex gap-1">
        {onPick && (
          <button onClick={onPick} className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-neutral-100">
            เลือก
          </button>
        )}
        {onEdit && (
          <button onClick={onEdit} className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-neutral-100" title="แก้ไขสินค้า">
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ProductForm({
  initial, onSave, onCancel
}: {
  initial?: Partial<Product>;
  onSave: (p: Product) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<Product>>(
    initial ?? { category: "CPU", name:"", price:0, stock:0, id: Math.random().toString(36).slice(2) }
  );
  function set<K extends keyof Product>(key: K, val: Product[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }
  return (
    <form
      className="grid grid-cols-2 gap-3"
      onSubmit={e=>{
        e.preventDefault();
        const p: Product = {
          id: String(form.id || Math.random().toString(36).slice(2)),
          name: String(form.name || ""),
          category: (form.category as any) || "CPU",
          price: Number(form.price || 0),
          cost: form.cost ? Number(form.cost) : undefined,
          stock: Number(form.stock || 0),
          brand: form.brand || undefined,
          socket: form.socket || undefined,
          ramType: form.ramType as any,
          formFactor: form.formFactor as any,
          gpuMaxLen: form.gpuMaxLen ? Number(form.gpuMaxLen) : undefined,
          gpuLen: form.gpuLen ? Number(form.gpuLen) : undefined,
          tdp: form.tdp ? Number(form.tdp) : undefined,
          wattage: form.wattage ? Number(form.wattage) : undefined,
          addonKind: form.addonKind as any,
        };
        onSave(p);
      }}
    >
      <div className="col-span-2 grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm">หมวด</label>
          <select
            className="mt-1 w-full rounded-md border px-2 py-2"
            value={String(form.category || "CPU")}
            onChange={e=>set("category", e.target.value as any)}
          >
            {MAIN_CATEGORIES.map(c=> <option key={c} value={c}>{c}</option>)}
            <option value="Addon">Addon (Monitor/Software/SSD)</option>
          </select>
        </div>
        <div>
          <label className="text-sm">ชื่อสินค้า</label>
          <input className="mt-1 w-full rounded-md border px-2 py-2" value={form.name||""} onChange={e=>set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-sm">ราคา (ขาย)</label>
          <input type="number" className="mt-1 w-full rounded-md border px-2 py-2" value={form.price||0} onChange={e=>set("price", Number(e.target.value||0))} />
        </div>
        <div>
          <label className="text-sm">ราคาทุน (ไม่บังคับ)</label>
          <input type="number" className="mt-1 w-full rounded-md border px-2 py-2" value={form.cost||0} onChange={e=>set("cost", Number(e.target.value||0))} />
        </div>
        <div>
          <label className="text-sm">สต็อก</label>
          <input type="number" className="mt-1 w-full rounded-md border px-2 py-2" value={form.stock||0} onChange={e=>set("stock", Number(e.target.value||0))} />
        </div>
        <div>
          <label className="text-sm">แบรนด์</label>
          <input className="mt-1 w-full rounded-md border px-2 py-2" value={form.brand||""} onChange={e=>set("brand", e.target.value)} />
        </div>
      </div>

      {/* Attributes */}
      <div className="col-span-2 grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm">Socket</label>
          <input className="mt-1 w-full rounded-md border px-2 py-2" value={form.socket||""} onChange={e=>set("socket", e.target.value)} />
        </div>
        <div>
          <label className="text-sm">RAM Type</label>
          <select className="mt-1 w-full rounded-md border px-2 py-2" value={form.ramType||""} onChange={e=>set("ramType", e.target.value as any)}>
            <option value="">-</option>
            <option value="DDR4">DDR4</option>
            <option value="DDR5">DDR5</option>
          </select>
        </div>
        <div>
          <label className="text-sm">Form Factor</label>
          <select className="mt-1 w-full rounded-md border px-2 py-2" value={form.formFactor||""} onChange={e=>set("formFactor", e.target.value as any)}>
            <option value="">-</option>
            <option value="ATX">ATX</option>
            <option value="mATX">mATX</option>
            <option value="ITX">ITX</option>
          </select>
        </div>
        <div>
          <label className="text-sm">GPU Max Length (เคส)</label>
          <input type="number" className="mt-1 w-full rounded-md border px-2 py-2" value={form.gpuMaxLen||0} onChange={e=>set("gpuMaxLen", Number(e.target.value||0))} />
        </div>
        <div>
          <label className="text-sm">GPU Length (การ์ดจอ)</label>
          <input type="number" className="mt-1 w-full rounded-md border px-2 py-2" value={form.gpuLen||0} onChange={e=>set("gpuLen", Number(e.target.value||0))} />
        </div>
        <div>
          <label className="text-sm">CPU TDP</label>
          <input type="number" className="mt-1 w-full rounded-md border px-2 py-2" value={form.tdp||0} onChange={e=>set("tdp", Number(e.target.value||0))} />
        </div>
        <div>
          <label className="text-sm">PSU Wattage</label>
          <input type="number" className="mt-1 w-full rounded-md border px-2 py-2" value={form.wattage||0} onChange={e=>set("wattage", Number(e.target.value||0))} />
        </div>
        {form.category === "Addon" && (
          <div>
            <label className="text-sm">ชนิด Addon</label>
            <select className="mt-1 w-full rounded-md border px-2 py-2" value={form.addonKind||"Monitor"} onChange={e=>set("addonKind", e.target.value as any)}>
              <option value="Monitor">Monitor</option>
              <option value="Software">Software</option>
              <option value="SSD">SSD</option>
            </select>
          </div>
        )}
      </div>

      <div className="col-span-2 mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-2">ยกเลิก</button>
        <button className="rounded-md bg-black px-3 py-2 text-white">บันทึก</button>
      </div>
    </form>
  );
}

function App() {
  // Name
  const appName = "Ubon Computer Spec V.4";

  // Inventory
  const [inventory, setInventory] = useState<Product[]>(initialInventory);

  // Selection
  const [selection, setSelection] = useState<Selection>({});
  const [addons, setAddons] = useState<AddonPick[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // Dialogs
  const [pickCat, setPickCat] = useState<Category | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [addDialog, setAddDialog] = useState(false);

  // Billing
  const [discount, setDiscount] = useState(0); // THB
  const [vat, setVat] = useState(0.07); // 7%
  const [applyVat, setApplyVat] = useState(true);

  // Import Excel
  async function onImportExcel(file: File) {
    try {
      const rows = await parseWorkbookToProducts(file);
      setInventory(prev => mergeById(prev, rows));
      toast.success(`นำเข้า ${rows.length} รายการแล้ว`);
    } catch (e:any) {
      toast.error(`นำเข้าไม่สำเร็จ: ${e.message||e}`);
    }
  }
  function mergeById(oldArr: Product[], newArr: Product[]) {
    const map = new Map<string, Product>();
    for (const p of oldArr) map.put?.(p.id, p) || map.set(p.id, p);
    for (const p of newArr) map.set(p.id, p);
    return Array.from(map.values());
  }

  // Derived lists
  const brands = useMemo(()=> Array.from(new Set(inventory.map(p=>p.brand).filter(Boolean))) as string[], [inventory]);

  const filtered = useMemo(()=>{
    const kw = search.trim().toLowerCase();
    return inventory.filter(p=>{
      if (kw && !(`${p.name} ${p.brand||""} ${p.category} ${p.addonKind||""}`.toLowerCase().includes(kw))) return false;
      if (brandFilter && p.brand !== brandFilter) return false;
      return true;
    });
  }, [inventory, search, brandFilter]);

  const byCat = useMemo(()=>{
    const map: Record<string, Product[]> = {};
    for (const p of filtered) {
      const key = p.category === "Addon" ? `Addon:${p.addonKind}` : p.category;
      map[key] = map[key] || [];
      map[key].push(p);
    }
    return map;
  }, [filtered]);

  function pickProduct(cat: Category, p: Product | null) {
    setSelection(prev => ({ ...prev, [cat]: p }));
    if (p) toast.success(`เลือก ${p.name} แล้ว`);
  }

  function addAddon(p: Product) {
    setAddons(prev => {
      const idx = prev.findIndex(x=>x.product.id === p.id);
      if (idx>=0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { product: p, qty: 1 }];
    });
    toast.success(`เพิ่ม ${p.name}`);
  }

  function removeAddon(id: string) {
    setAddons(prev => prev.filter(x=>x.product.id !== id));
  }

  function resetSpec() {
    setSelection({});
    setAddons([]);
    toast.message("รีเซ็ตสเปคแล้ว");
  }

  const compatIssues = useMemo(()=> checkCompatibility(selection), [selection]);

  // Totals
  const mainTotal = useMemo(()=> MAIN_CATEGORIES.reduce((sum, c)=> sum + (selection[c]?.price||0), 0), [selection]);
  const addOnTotal = useMemo(()=> addons.reduce((s,a)=> s + a.product.price*a.qty, 0), [addons]);
  const subTotal = mainTotal + addOnTotal - discount;
  const vatAmt = applyVat ? Math.max(0, subTotal) * vat : 0;
  const grand = Math.max(0, subTotal) + vatAmt;
  const costTotal = useMemo(()=>{
    const mainCost = MAIN_CATEGORIES.reduce((sum, c)=> sum + (selection[c]?.cost||0), 0);
    const addCost = addons.reduce((s,a)=> s + (a.product.cost||0)*a.qty, 0);
    return mainCost + addCost;
  }, [selection, addons]);
  const profit = Math.max(0, grand - costTotal);

  // Edit product save
  function onSaveProduct(p: Product) {
    setInventory(prev => {
      const i = prev.findIndex(x=>x.id===p.id);
      if (i>=0) {
        const next = [...prev];
        next[i] = p;
        return next;
      }
      return [...prev, p];
    });
    setEditProduct(null);
    toast.success("บันทึกสินค้าแล้ว");
  }

  // Add product dialog
  const [addDraft, setAddDraft] = useState<Partial<Product> | null>(null);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Toaster richColors position="top-center" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <Cpu className="h-6 w-6" />
          <h1 className="text-lg font-semibold">{appName}</h1>
          <span className="ml-auto text-sm text-neutral-500">ระบบจัดสเปคคอมพิวเตอร์ อุบลคอมพิวเตอร์</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        {/* LEFT: Builder */}
        <section className="col-span-12 lg:col-span-8 space-y-6">
          {/* Controls */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  value={search}
                  onChange={e=>setSearch(e.target.value)}
                  placeholder="ค้นหาสินค้า ชื่อ / แบรนด์ / หมวด..."
                  className="w-72 rounded-xl border pl-8 pr-3 py-2"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">แบรนด์:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={()=>setBrandFilter(null)}
                    className={`rounded-full border px-3 py-1 text-sm ${brandFilter===null?"bg-black text-white":""}`}
                  >ทั้งหมด</button>
                  {brands.map(b=>(
                    <button
                      key={b}
                      onClick={()=>setBrandFilter(b)}
                      className={`rounded-full border px-3 py-1 text-sm ${brandFilter===b?"bg-black text-white":""}`}
                    >{b}</button>
                  ))}
                </div>
                <button onClick={()=>setBrandFilter(null)} className="rounded-md border px-2 py-1 text-sm">ล้างตัวกรอง</button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <label className="text-sm">จัดเรียง</label>
                <select
                  className="rounded-md border px-2 py-2"
                  value={sortMode}
                  onChange={e=>setSortMode(e.target.value as SortMode)}
                >
                  <option value="default">ค่าเริ่มต้น</option>
                  <option value="priceAsc">ราคาต่ำ→สูง</option>
                  <option value="priceDesc">ราคาสูง→ต่ำ</option>
                  <option value="nameAsc">ชื่อ A→Z</option>
                </select>

                <label className="ml-4 rounded-md border px-2 py-1 cursor-pointer text-sm inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={e=>{ const f=e.target.files?.[0]; if (f) onImportExcel(f); }}
                  />
                  นำเข้า Excel
                </label>

                <button onClick={()=>{ setAddDraft({}); }} className="rounded-md border px-3 py-2 text-sm inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> เพิ่มสินค้า
                </button>

                <button onClick={resetSpec} className="rounded-md border px-3 py-2 text-sm inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" /> รีเซ็ตสเปค
                </button>
              </div>
            </div>
          </div>

          {/* Main categories */}
          <div className="space-y-4">
            {MAIN_CATEGORIES.map(cat=>{
              const chosen = selection[cat] || null;
              const list = sortProducts((byCat[cat]||[]), sortMode);
              return (
                <div key={cat} className="rounded-2xl border bg-white">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="font-medium">{cat} {REQUIRED.includes(cat) && <span className="text-red-500">*</span>}</div>
                    <div className="flex items-center gap-2">
                      {chosen && (
                        <button onClick={()=>pickProduct(cat, null)} className="rounded-md border px-2 py-1 text-sm">ไม่เลือก</button>
                      )}
                      <button onClick={()=>setPickCat(cat)} className="rounded-md border px-2 py-1 text-sm inline-flex items-center gap-1">
                        <ArrowUpDown className="h-4 w-4" /> เลือก/เปลี่ยน
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    {chosen ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{chosen.name}</div>
                          <div className="text-xs text-neutral-500 space-x-2">
                            {chosen.brand && <span>แบรนด์: {chosen.brand}</span>}
                            {chosen.socket && <span>Socket: {chosen.socket}</span>}
                            {chosen.ramType && <span>RAM: {chosen.ramType}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm">{baht(chosen.price)}</div>
                          <button onClick={()=>setEditProduct(chosen)} className="rounded-md border px-2 py-1 text-sm">แก้ไข</button>
                          <button onClick={()=>pickProduct(cat, null)} className="rounded-md border px-2 py-1 text-sm">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-500">ยังไม่ได้เลือก</div>
                    )}
                  </div>

                  {/* Short compatibility note per-category (compact) */}
                  {cat==="PSU" && (
                    <div className="px-4 pb-3 text-xs text-neutral-500">
                      ต้องการกำลังไฟโดยประมาณ: {estimateWatt(selection)}W
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add-ons */}
          <div className="rounded-2xl border bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-medium">ออปชันเสริม (Monitor / Software / SSD)</div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(["Monitor","Software","SSD"] as AddonKind[]).map(kind=>{
                  const list = sortProducts((byCat[`Addon:${kind}`]||[]), sortMode);
                  return (
                    <div key={kind} className="rounded-xl border p-3">
                      <div className="mb-2 text-sm font-medium">{kind}</div>
                      <div className="space-y-2 max-h-56 overflow-auto pr-1">
                        {list.length===0 && <div className="text-xs text-neutral-500">ไม่มีสินค้า</div>}
                        {list.map(p=>(
                          <ProductRow
                            key={p.id}
                            p={p}
                            onPick={()=>addAddon(p)}
                            onEdit={()=>setEditProduct(p)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {addons.length>0 && (
                <div className="rounded-xl border p-3">
                  <div className="mb-2 font-medium">รายการที่เลือก</div>
                  <div className="space-y-2">
                    {addons.map(a=> (
                      <div key={a.product.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="text-sm">{a.product.name} × {a.qty}</div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm">{baht(a.product.price*a.qty)}</div>
                          <button onClick={()=>removeAddon(a.product.id)} className="rounded-md border px-2 py-1 text-sm">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: Summary */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">
          {/* Compatibility summary */}
          <div className="rounded-2xl border bg-white">
            <div className="px-4 py-3 border-b font-medium">ความเข้ากันได้ (ย่อ)</div>
            <div className="p-4 space-y-2 text-sm">
              {compatIssues.length===0 ? (
                <div className="text-green-600">ปกติ ไม่มีปัญหา</div>
              ) : compatIssues.map((t,i)=>(<div key={i} className="text-red-600">• {t}</div>))}
            </div>
          </div>

          {/* Billing */}
          <div className="rounded-2xl border bg-white">
            <div className="px-4 py-3 border-b font-medium">สรุปใบเสนอราคา</div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between"><span>รวมอุปกรณ์หลัก</span><span>{baht(mainTotal)}</span></div>
              <div className="flex justify-between"><span>ออปชันเสริม</span><span>{baht(addOnTotal)}</span></div>

              <div className="flex items-center justify-between">
                <span>ส่วนลด</span>
                <input type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value||0))} className="w-28 rounded-md border px-2 py-1 text-right" />
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={applyVat} onChange={e=>setApplyVat(e.target.checked)} />
                  รวม VAT 7%
                </label>
                <span>{baht(vatAmt)}</span>
              </div>

              <div className="border-t pt-3 flex justify-between font-medium">
                <span>สุทธิ</span><span>{baht(grand)}</span>
              </div>

              <div className="text-xs text-neutral-500">
                ต้นทุนประมาณ: {baht(costTotal)} | กำไรคาดการณ์: <span className="text-emerald-600">{baht(profit)}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={()=>{
                    const txt = summaryText(selection, addons, grand, discount, vatAmt);
                    navigator.clipboard.writeText(txt);
                    toast.success("คัดลอกสรุปแล้ว");
                  }}
                  className="rounded-md border px-3 py-2"
                >
                  คัดลอกสรุป
                </button>
                <button
                  onClick={()=>window.print()}
                  className="rounded-md border px-3 py-2"
                >
                  พิมพ์ / PDF
                </button>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Picker dialog */}
      <Modal
        open={pickCat !== null}
        onClose={()=>setPickCat(null)}
        title={pickCat ? `เลือกสินค้า: ${pickCat}` : ""}
      >
        {pickCat && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  placeholder="ค้นหาในหมวดนี้..."
                  onChange={e=>setSearch(e.target.value)}
                  className="w-full rounded-xl border pl-8 pr-3 py-2"
                />
              </div>
              <select className="rounded-md border px-2 py-2" value={sortMode} onChange={e=>setSortMode(e.target.value as SortMode)}>
                <option value="default">ค่าเริ่มต้น</option>
                <option value="priceAsc">ราคาต่ำ→สูง</option>
                <option value="priceDesc">ราคาสูง→ต่ำ</option>
                <option value="nameAsc">ชื่อ A→Z</option>
              </select>
            </div>

            <div className="max-h-[55vh] overflow-auto pr-1 space-y-2">
              {sortProducts((byCat[pickCat]||[]), sortMode).map(p=>(
                <ProductRow
                  key={p.id}
                  p={p}
                  onPick={()=>{ pickProduct(pickCat, p); setPickCat(null); }}
                  onEdit={()=>setEditProduct(p)}
                />
              ))}
              {REQUIRED.includes(pickCat) && !selection[pickCat] && (
                <div className="text-xs text-red-600">* หมวดนี้จำเป็นต้องเลือก</div>
              )}
              <div className="pt-2">
                <button onClick={()=>{ pickProduct(pickCat, null); setPickCat(null); }} className="rounded-md border px-3 py-2 text-sm">
                  ไม่เลือกหมวดนี้
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit product dialog */}
      <Modal
        open={!!editProduct}
        onClose={()=>setEditProduct(null)}
        title={editProduct ? "แก้ไขสินค้า" : ""}
      >
        {editProduct && (
          <ProductForm
            initial={editProduct}
            onSave={onSaveProduct}
            onCancel={()=>setEditProduct(null)}
          />
        )}
      </Modal>

      {/* Add product dialog */}
      <Modal
        open={!!addDraft}
        onClose={()=>setAddDraft(null)}
        title="เพิ่มสินค้าใหม่"
      >
        {addDraft && (
          <ProductForm
            initial={addDraft}
            onSave={(p)=>{ onSaveProduct(p); setAddDraft(null); }}
            onCancel={()=>setAddDraft(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function summaryText(sel: Selection, addons: AddonPick[], grand:number, discount:number, vatAmt:number) {
  const lines:string[] = [];
  lines.push("สรุปสเปค");
  for (const c of MAIN_CATEGORIES) {
    const p = sel[c];
    lines.push(`- ${c}: ${p ? `${p.name} (${baht(p.price)})` : "— ไม่ได้เลือก"}`);
  }
  if (addons.length){
    lines.push("ออปชันเสริม:");
    for (const a of addons) lines.push(`  • ${a.product.name} × ${a.qty} = ${baht(a.product.price*a.qty)}`);
  }
  lines.push(`ส่วนลด: ${baht(discount)}`);
  lines.push(`VAT: ${baht(vatAmt)}`);
  lines.push(`รวมสุทธิ: ${baht(grand)}`);
  return lines.join("\n");
}

export default App;

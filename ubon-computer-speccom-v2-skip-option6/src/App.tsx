import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Plus, Trash2, Edit, HardDrive, Cpu, MemoryStick,
  HardDrive as StorageIcon, Power, Monitor, Wrench, CaseSensitive,
  Download, FileUp, Save, ListChecks, ShoppingCart, CheckCircle2,
  AlertTriangle, Sparkles, X
} from "lucide-react";
import * as XLSX from "xlsx";

/**
 * Ubon Computer Speccom V.3
 * - Smart Sync: auto-apply attribute filters from selected parts (CPU/MB/Cooler/Storage/PSU)
 * - Attribute Filters: chips + one-click clear
 * - Product Editor: per-category attribute fields + Advanced JSON (optional)
 * - Pricing: VAT, Discount, Cost, Profit; Required categories; Search/Sort/Import; Add-on (Monitor/Software/SSD)
 */

// ===== Categories =====
const BASE_CATEGORIES = ["CPU","Motherboard","GPU","RAM","Storage","PSU","Case","Cooler"] as const;
const ADDON_CATEGORIES = ["Monitor","Software","SSD"] as const;

const ALL_CATEGORIES = [...BASE_CATEGORIES, ...ADDON_CATEGORIES] as const;
type BaseCategory = typeof BASE_CATEGORIES[number];
type AddonCategory = typeof ADDON_CATEGORIES[number];
type Category = typeof ALL_CATEGORIES[number];

export type Product = {
  id: string;
  name: string;
  category: Category;
  price: number;      // selling price
  stock: number;
  cost?: number;      // optional cost price
  attributes: Record<string, any>;
};

type AddonEntry = { id: string; product: Product; qty: number };

type BuildState = {
  base: Partial<Record<BaseCategory, Product>>;
  addons: AddonEntry[];
};

// ===== Utilities =====
const uid = () => Math.random().toString(36).slice(2, 10);
const baht = (n: number) => n.toLocaleString("th-TH", { style: "currency", currency: "THB" });

type SortMode = 'default'|'priceAsc'|'priceDesc'|'nameAsc'|'stockDesc';
function sortProducts<T extends { price:number; stock:number; name:string }>(arr: T[], mode: SortMode): T[] {
  const a = [...arr];
  switch(mode){
    case 'priceAsc': return a.sort((x,y)=>x.price-y.price);
    case 'priceDesc': return a.sort((x,y)=>y.price-x.price);
    case 'nameAsc': return a.sort((x,y)=>x.name.localeCompare(y.name));
    case 'stockDesc': return a.sort((x,y)=>y.stock-x.stock);
    default: return a;
  }
}

const STORAGE_KEYS = {
  inventory: "ubonspec.inventory.v3",
  build: "ubonspec.build.v3",
  pricing: "ubonspec.pricing.v3",
  required: "ubonspec.required.v3",
  filters: "ubonspec.filters.v3",
  smartSync: "ubonspec.smartsync.v3",
} as const;

// ===== Demo Inventory =====
const DEMO_DATA: Product[] = [
  { id: uid(), name: "AMD Ryzen 5 7600", category: "CPU", price: 7490, stock: 8, cost: 6100, attributes: { socket: "AM5", tdp: 65 } },
  { id: uid(), name: "Intel Core i5-13400F", category: "CPU", price: 6990, stock: 12, cost: 5900, attributes: { socket: "LGA1700", tdp: 148 } },

  { id: uid(), name: "ASUS TUF B650-PLUS", category: "Motherboard", price: 7290, stock: 6, cost: 6100, attributes: { socket: "AM5", ramType: "DDR5", formFactor: "ATX", pcieSlots: 2, storage: ["M.2 NVMe", "SATA"] } },
  { id: uid(), name: "MSI PRO B760M-A", category: "Motherboard", price: 4990, stock: 9, cost: 4100, attributes: { socket: "LGA1700", ramType: "DDR5", formFactor: "mATX", pcieSlots: 2, storage: ["M.2 NVMe", "SATA"] } },

  { id: uid(), name: "NVIDIA RTX 4070 SUPER", category: "GPU", price: 19990, stock: 4, cost: 17500, attributes: { tdp: 220, interface: "PCIe" } },
  { id: uid(), name: "MSI GTX 1660 SUPER", category: "GPU", price: 6990, stock: 5, cost: 6100, attributes: { tdp: 125, interface: "PCIe" } },

  { id: uid(), name: "Kingston Fury 16GB (2x8) 6000 DDR5", category: "RAM", price: 2190, stock: 15, cost: 1850, attributes: { type: "DDR5", sizeGB: 16 } },
  { id: uid(), name: "Corsair Vengeance 32GB (2x16) 3200 DDR4", category: "RAM", price: 2690, stock: 10, cost: 2300, attributes: { type: "DDR4", sizeGB: 32 } },

  { id: uid(), name: "WD Black SN770 1TB NVMe", category: "Storage", price: 2990, stock: 18, cost: 2500, attributes: { interface: "M.2 NVMe" } },
  { id: uid(), name: "Seagate Barracuda 2TB SATA", category: "Storage", price: 1690, stock: 8, cost: 1400, attributes: { interface: "SATA" } },

  { id: uid(), name: "Corsair RM750", category: "PSU", price: 3290, stock: 7, cost: 2800, attributes: { wattage: 750 } },
  { id: uid(), name: "Antec NeoECO 550", category: "PSU", price: 1890, stock: 11, cost: 1600, attributes: { wattage: 550 } },

  { id: uid(), name: "NZXT H5 Flow", category: "Case", price: 3590, stock: 3, cost: 3000, attributes: { formFactorSupport: ["ATX", "mATX", "ITX"] } },
  { id: uid(), name: "Cooler Master NR200", category: "Case", price: 3290, stock: 5, cost: 2800, attributes: { formFactorSupport: ["ITX"] } },

  { id: uid(), name: "DeepCool AK400", category: "Cooler", price: 1190, stock: 9, cost: 990, attributes: { socketSupport: ["AM5", "LGA1700"] } },
  { id: uid(), name: "NZXT Kraken 240", category: "Cooler", price: 4490, stock: 4, cost: 3990, attributes: { socketSupport: ["AM5", "LGA1700"] } },

  // Add-ons
  { id: uid(), name: "AOC 24G2 24\" 144Hz IPS", category: "Monitor", price: 4490, stock: 10, cost: 3800, attributes: { size: 24, refresh: 144 } },
  { id: uid(), name: "LG 27GP850 27\" 165Hz", category: "Monitor", price: 10990, stock: 5, cost: 9800, attributes: { size: 27, refresh: 165 } },
  { id: uid(), name: "Windows 11 Pro (OEM)", category: "Software", price: 4590, stock: 20, cost: 3500, attributes: { license: "OEM" } },
  { id: uid(), name: "Microsoft Office 365 Family (1y)", category: "Software", price: 2190, stock: 30, cost: 1700, attributes: { license: "Subscription" } },
  { id: uid(), name: "Kingston NV2 1TB NVMe", category: "SSD", price: 2390, stock: 16, cost: 2000, attributes: { interface: "M.2 NVMe" } },
  { id: uid(), name: "Crucial MX500 1TB SATA", category: "SSD", price: 2590, stock: 12, cost: 2200, attributes: { interface: "SATA" } },
  { id: uid(), name: "Samsung 990 EVO 2TB NVMe", category: "SSD", price: 6290, stock: 6, cost: 5600, attributes: { interface: "M.2 NVMe" } },
];

// ===== Hooks =====
function useLocalStorage<T>(key: string, init: T) {
  const [state, setState] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : init; }
    catch { return init; }
  });
  useEffect(()=>{ try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState] as const;
}

// ===== Compatibility =====
function estimateWattage(parts: Partial<Record<BaseCategory, Product>>): number {
  const cpu = parts["CPU"]?.attributes?.tdp || 0;
  const gpu = parts["GPU"]?.attributes?.tdp || 0;
  return cpu + gpu + 100; // headroom
}

function checkCompatibility(parts: Partial<Record<BaseCategory, Product>>) {
  const notes: { level: "ok"|"warn"|"error"; msg: string }[] = [];
  const cpu = parts["CPU"]; const mb = parts["Motherboard"]; const ram = parts["RAM"]; const gpu = parts["GPU"]; const psu = parts["PSU"]; const cooler = parts["Cooler"]; const pcCase = parts["Case"]; const storage = parts["Storage"];
  if (cpu && mb) notes.push(cpu.attributes.socket===mb.attributes.socket ? {level:"ok", msg:"CPU ✔ เมนบอร์ด ✔ (ซ็อกเก็ตตรงกัน)"} : {level:"error", msg:`CPU socket (${cpu.attributes.socket}) ไม่ตรงกับเมนบอร์ด (${mb.attributes.socket})`});
  if (ram && mb) notes.push(ram.attributes.type===mb.attributes.ramType ? {level:"ok", msg:"RAM ✔ เมนบอร์ด ✔ (ชนิดแรมตรงกัน)"} : {level:"error", msg:`RAM (${ram.attributes.type}) ไม่ตรงกับเมนบอร์ด (${mb.attributes.ramType})`});
  if (gpu && mb) notes.push(mb.attributes.pcieSlots ? {level:"ok", msg:"GPU ✔ เมนบอร์ด ✔ (มีสล็อต PCIe)"} : {level:"error", msg:"เมนบอร์ดนี้ไม่มีสล็อต PCIe สำหรับการ์ดจอ"});
  if (pcCase && mb){ const ok=(pcCase.attributes.formFactorSupport||[]).includes(mb.attributes.formFactor); notes.push(ok?{level:"ok",msg:"เคส ✔ เมนบอร์ด ✔ (ขนาดตรงกัน)"}:{level:"error",msg:`เคสรองรับ ${(pcCase.attributes.formFactorSupport||[]).join(", ")||"-"} ไม่ตรงกับเมนบอร์ด (${mb.attributes.formFactor})`}); }
  if (cooler && cpu){ const ok=(cooler.attributes.socketSupport||[]).includes(cpu.attributes.socket); notes.push(ok?{level:"ok",msg:"คูลเลอร์ ✔ CPU ✔ (รองรับซ็อกเก็ต)"}:{level:"error",msg:`ชุดระบายความร้อนไม่รองรับซ็อกเก็ต CPU (${cpu.attributes.socket})`}); }
  if (storage && mb){ if (storage.attributes.interface && mb.attributes.storage){ const ok=(mb.attributes.storage||[]).includes(storage.attributes.interface); notes.push(ok?{level:"ok",msg:"สตอเรจ ✔ เมนบอร์ด ✔ (อินเทอร์เฟซตรงกัน)"}:{level:"error",msg:`สตอเรจ (${storage.attributes.interface}) ไม่ตรงกับพอร์ตบนเมนบอร์ด (${(mb.attributes.storage||[]).join(", ")})`}); } }
  if (psu){ const need=estimateWattage(parts), has=psu.attributes.wattage||0; notes.push(has<need?{level:"warn",msg:`กำลังไฟ PSU ${has}W อาจไม่พอ ต้องการอย่างน้อย ~${need}W`}:{level:"ok",msg:`PSU เพียงพอ (ต้องการ ~${need}W)`}); }
  const level = notes.some(n=>n.level==="error")?"error":notes.some(n=>n.level==="warn")?"warn":"ok";
  return { level, notes } as const;
}

// ===== Attribute Filters =====
type AttrFilters = {
  socket?: string;
  ramType?: string;
  formFactor?: string;
  storageInterface?: string;
  minPSUWatt?: number;
  coolerSocket?: string;
};

function applyAttrFilters(cat: BaseCategory, items: Product[], f: AttrFilters): Product[] {
  if (!items.length) return items;
  return items.filter(p => {
    const a = p.attributes || {};
    if (f.socket && ((cat==="CPU" && a.socket!==f.socket) || (cat==="Motherboard" && a.socket!==f.socket))) return false;
    if (f.ramType && cat==="Motherboard" && a.ramType!==f.ramType) return false;
    if (f.formFactor && cat==="Motherboard" && a.formFactor!==f.formFactor) return false;
    if (f.formFactor && cat==="Case" && !(a.formFactorSupport||[]).includes(f.formFactor)) return false;
    if (f.storageInterface && cat==="Storage" && a.interface!==f.storageInterface) return false;
    if (f.storageInterface && cat==="Motherboard" && !((a.storage||[]) as string[]).includes(f.storageInterface)) return false;
    if (typeof f.minPSUWatt === "number" && cat==="PSU" && (a.wattage||0) < f.minPSUWatt) return false;
    if (f.coolerSocket && cat==="Cooler" && !((a.socketSupport||[]) as string[]).includes(f.coolerSocket)) return false;
    return true;
  });
}

// ===== Excel Import =====
const normalizeHeader = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");

function parseWorkbookToProducts(file: File): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const out: Product[] = [];
        for (const row of json) {
          const keys = Object.keys(row);
          const map: Record<string, any> = {};
          keys.forEach(k => (map[normalizeHeader(k)] = row[k]));

          const rawCategory = (map["category"] || map["หมวดหมู่"] || map["type"]) + "";
          const category = (ALL_CATEGORIES.find(c => c.toLowerCase() === rawCategory.toLowerCase()) || "CPU") as Category;
          const name = (map["name"] || map["สินค้า"] || map["product"] || "Unnamed") + "";
          const price = Number(map["price"] || map["ราคา"] || 0);
          const cost = Number(map["cost"] || map["ต้นทุน"] || 0);
          const stock = Number(map["stock"] || map["คงเหลือ"] || map["จำนวน"] || 0);

          const attributes: Record<string, any> = {};
          const aliasPairs: Record<string, string[]> = {
            socket: ["socket", "ซ็อกเก็ต"],
            tdp: ["tdp"],
            ramType: ["ramtype", "แรม", "ram"],
            formFactor: ["formfactor", "ขนาด"],
            formFactorSupport: ["formfactorsupport", "รองรับเมนบอร์ด"],
            pcieSlots: ["pcieslots"],
            interface: ["interface", "อินเทอร์เฟซ"],
            storage: ["storage", "พอร์ตเก็บข้อมูล"],
            wattage: ["wattage", "กำลังไฟ", "w"] ,
            sizeGB: ["sizegb", "ขนาดgb", "ความจุ"],
            socketSupport: ["socketsupport", "รองรับซ็อกเก็ต"],
            size: ["size", "นิ้ว"],
            refresh: ["refresh", "รีเฟรช"],
            license: ["license", "ไลเซนส์"],
            cost: ["cost","ต้นทุน"]
          };
          for (const [key, aliases] of Object.entries(aliasPairs)) {
            for (const a of aliases) {
              const v = map[normalizeHeader(a)];
              if (v !== undefined && v !== "") {
                if (key==="cost"){ /* handled separately */ continue; }
                if (typeof v === "string" && v.includes(",")) attributes[key] = v.split(",").map((s:string)=>s.trim());
                else attributes[key] = isNaN(Number(v)) ? v : Number(v);
                break;
              }
            }
          }

          const attrRaw = map["attributes"];
          if (attrRaw) {
            try { const extra = typeof attrRaw === "string" ? JSON.parse(attrRaw) : attrRaw; Object.assign(attributes, extra); } catch {}
          }

          out.push({ id: uid(), name, category, price, stock, cost, attributes });
        }
        resolve(out);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ===== Icons =====
const categoryIcon: Record<Category, React.ReactNode> = {
  CPU: <Cpu className="w-4 h-4" />, 
  Motherboard: <HardDrive className="w-4 h-4" />, 
  GPU: <Monitor className="w-4 h-4" />, 
  RAM: <MemoryStick className="w-4 h-4" />, 
  Storage: <StorageIcon className="w-4 h-4" />, 
  PSU: <Power className="w-4 h-4" />, 
  Case: <CaseSensitive className="w-4 h-4" />, 
  Cooler: <Wrench className="w-4 h-4" />,
  Monitor: <Monitor className="w-4 h-4" />,
  Software: <Sparkles className="w-4 h-4" />,
  SSD: <StorageIcon className="w-4 h-4" />,
};

// ===== Small UI helpers =====
function Chip({ children, onClick, active=false }:{ children: React.ReactNode; onClick?: ()=>void; active?: boolean }){
  return <Button type="button" onClick={onClick} variant="secondary" className={`h-7 px-3 rounded-full ${active? 'bg-primary/90 text-white hover:bg-primary' : ''}`}>{children}</Button>;
}

function ClearChip({ label, onClear }:{ label:string; onClear:()=>void }){
  return <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 h-7 rounded-full text-xs">{label}<button className="opacity-70 hover:opacity-100" onClick={onClear} title="ล้าง"><X className="w-3.5 h-3.5"/></button></span>;
}

// ===== Inventory Table =====
function InventoryTable({ items, onEdit, onDelete }:{ items: Product[]; onEdit:(p:Product)=>void; onDelete:(id:string)=>void; }){
  return (<div className="border rounded-2xl overflow-hidden">
    <div className="grid grid-cols-12 bg-muted/50 px-4 py-2 text-sm font-semibold">
      <div className="col-span-5">สินค้า</div><div className="col-span-2">หมวด</div><div className="col-span-2 text-right">ราคา</div><div className="col-span-1 text-right">สต็อก</div><div className="col-span-2 text-right">จัดการ</div>
    </div>
    <div className="max-h-[360px] overflow-auto">
      {items.map(p=>(<div key={p.id} className="grid grid-cols-12 items-center px-4 py-2 border-t hover:bg-muted/30 text-sm">
        <div className="col-span-5 truncate flex items-center gap-2"><Badge variant="secondary" className="rounded-xl">{categoryIcon[p.category]}<span className="ml-2">{p.category}</span></Badge><span className="font-medium truncate" title={p.name}>{p.name}</span></div>
        <div className="col-span-2">{(p as any).attributes.socket || (p as any).attributes.type || (p as any).attributes.size || (p as any).attributes.license || (p as any).attributes.interface || "-"}</div>
        <div className="col-span-2 text-right">{baht(p.price)}{typeof p.cost==="number" ? <span className="text-xs text-muted-foreground"> (ทุน {baht(p.cost)})</span> : null}</div>
        <div className="col-span-1 text-right">{p.stock}</div>
        <div className="col-span-2 flex justify-end gap-2">
          <Button size="icon" variant="secondary" onClick={()=>onEdit(p)} title="แก้ไข"><Edit className="w-4 h-4"/></Button>
          <Button size="icon" variant="destructive" onClick={()=>onDelete(p.id)} title="ลบ"><Trash2 className="w-4 h-4"/></Button>
        </div>
      </div>))}
    </div>
  </div>);
}

// ===== Editors =====
function CategoryAttrFields({ category, attr, setAttr }:{ category: Category; attr: Record<string, any>; setAttr: (a:Record<string,any>)=>void; }){
  const set = (k:string, v:any)=> setAttr({ ...attr, [k]: v });
  // Multi toggles helpers
  const toggleInArray = (k:string, value:string)=>{
    const arr = Array.isArray(attr[k]) ? [...attr[k]] : [];
    const i = arr.indexOf(value);
    if (i>=0) arr.splice(i,1); else arr.push(value);
    set(k, arr);
  };

  if (category==="CPU"){
    return (<div className="grid grid-cols-2 gap-3">
      <div><Label>Socket</Label><Input value={attr.socket||""} onChange={e=>set("socket", e.target.value)} placeholder="เช่น AM5, LGA1700"/></div>
      <div><Label>TDP (W)</Label><Input type="number" value={attr.tdp||""} onChange={e=>set("tdp", Number(e.target.value||0))}/></div>
    </div>);
  }
  if (category==="Motherboard"){
    const ramTypes = ["DDR5","DDR4"];
    const formFactors = ["ATX","mATX","ITX"];
    const storageIfs = ["M.2 NVMe","SATA"];
    return (<div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Socket</Label><Input value={attr.socket||""} onChange={e=>set("socket", e.target.value)} /></div>
        <div>
          <Label>RAM Type</Label>
          <Select value={attr.ramType||""} onValueChange={(v)=>set("ramType", v)}>
            <SelectTrigger><SelectValue placeholder="เลือกชนิด RAM"/></SelectTrigger>
            <SelectContent>{ramTypes.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Form Factor</Label>
          <Select value={attr.formFactor||""} onValueChange={(v)=>set("formFactor", v)}>
            <SelectTrigger><SelectValue placeholder="เลือกขนาดบอร์ด"/></SelectTrigger>
            <SelectContent>{formFactors.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>PCIe Slots</Label><Input type="number" value={attr.pcieSlots||""} onChange={e=>set("pcieSlots", Number(e.target.value||0))}/></div>
      </div>
      <div>
        <Label>Storage Ports</Label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {storageIfs.map(s => <Chip key={s} active={(attr.storage||[]).includes(s)} onClick={()=>toggleInArray("storage", s)}>{s}</Chip>)}
        </div>
      </div>
    </div>);
  }
  if (category==="RAM"){
    return (<div className="grid grid-cols-2 gap-3">
      <div>
        <Label>ชนิดแรม</Label>
        <Select value={attr.type||""} onValueChange={(v)=>set("type", v)}>
          <SelectTrigger><SelectValue placeholder="DDR5 / DDR4"/></SelectTrigger>
          <SelectContent><SelectItem value="DDR5">DDR5</SelectItem><SelectItem value="DDR4">DDR4</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>ขนาด (GB)</Label><Input type="number" value={attr.sizeGB||""} onChange={e=>set("sizeGB", Number(e.target.value||0))}/></div>
    </div>);
  }
  if (category==="Storage" || category==="SSD"){
    return (<div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Interface</Label>
        <Select value={attr.interface||""} onValueChange={(v)=>set("interface", v)}>
          <SelectTrigger><SelectValue placeholder="M.2 NVMe / SATA"/></SelectTrigger>
          <SelectContent><SelectItem value="M.2 NVMe">M.2 NVMe</SelectItem><SelectItem value="SATA">SATA</SelectItem></SelectContent>
        </Select>
      </div>
    </div>);
  }
  if (category==="PSU"){
    return (<div className="grid grid-cols-2 gap-3">
      <div><Label>กำลังไฟ (W)</Label><Input type="number" value={attr.wattage||""} onChange={e=>set("wattage", Number(e.target.value||0))}/></div>
    </div>);
  }
  if (category==="Case"){
    const sizes = ["ATX","mATX","ITX"];
    return (<div>
      <Label>รองรับเมนบอร์ด</Label>
      <div className="flex gap-2 mt-1 flex-wrap">
        {sizes.map(s => <Chip key={s} active={(attr.formFactorSupport||[]).includes(s)} onClick={()=>toggleInArray("formFactorSupport", s)}>{s}</Chip>)}
      </div>
    </div>);
  }
  if (category==="Cooler"){
    const sockets = ["AM5","LGA1700"];
    return (<div>
      <Label>รองรับซ็อกเก็ต</Label>
      <div className="flex gap-2 mt-1 flex-wrap">
        {sockets.map(s => <Chip key={s} active={(attr.socketSupport||[]).includes(s)} onClick={()=>toggleInArray("socketSupport", s)}>{s}</Chip>)}
      </div>
    </div>);
  }
  if (category==="Monitor"){
    return (<div className="grid grid-cols-2 gap-3">
      <div><Label>ขนาด (นิ้ว)</Label><Input type="number" value={attr.size||""} onChange={e=>set("size", Number(e.target.value||0))}/></div>
      <div><Label>รีเฟรช (Hz)</Label><Input type="number" value={attr.refresh||""} onChange={e=>set("refresh", Number(e.target.value||0))}/></div>
    </div>);
  }
  if (category==="Software"){
    return (<div className="grid grid-cols-2 gap-3">
      <div><Label>ลิขสิทธิ์</Label><Input value={attr.license||""} onChange={e=>set("license", e.target.value)}/></div>
    </div>);
  }
  return null;
}

function ProductEditor({ initial, onSave }: { initial?: Partial<Product>, onSave: (p: Product) => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState<Category>((initial?.category as Category) || "CPU");
  const [price, setPrice] = useState<number>(Number(initial?.price || 0));
  const [cost, setCost] = useState<number>(Number(initial?.cost || 0));
  const [stock, setStock] = useState<number>(Number(initial?.stock || 0));
  const [attr, setAttr] = useState<Record<string, any>>(initial?.attributes || {});
  const [advanced, setAdvanced] = useState<string>("{}");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  useEffect(()=>{ setAttr(initial?.attributes || {}); setAdvanced("{}"); }, [initial?.id]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>ชื่อสินค้า</Label><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="เช่น Ryzen 5 7600" /></div>
        <div>
          <Label>หมวดหมู่</Label>
          <Select value={category} onValueChange={(v)=>{ setCategory(v as Category); setAttr({}); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_CATEGORIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>ราคา (บาท)</Label><Input type="number" value={price} onChange={(e)=>setPrice(Number(e.target.value))} /></div>
        <div><Label>ต้นทุน (บาท)</Label><Input type="number" value={cost} onChange={(e)=>setCost(Number(e.target.value))} /></div>
        <div><Label>สต็อก</Label><Input type="number" value={stock} onChange={(e)=>setStock(Number(e.target.value))} /></div>
      </div>

      <div className="space-y-2">
        <Label>คุณสมบัติ</Label>
        <CategoryAttrFields category={category} attr={attr} setAttr={setAttr} />
        <div className="text-xs text-muted-foreground">* ช่องจะเปลี่ยนตามหมวดสินค้า หากต้องการใส่คีย์เพิ่มเติมกด “ขั้นสูง (JSON)”</div>
        <div className="pt-2">
          <Button variant="secondary" onClick={()=>setShowAdvanced(s=>!s)}>{showAdvanced ? "ซ่อนขั้นสูง (JSON)" : "ขั้นสูง (JSON)"}</Button>
        </div>
        {showAdvanced && (
          <div className="pt-2">
            <textarea className="w-full min-h-40 bg-muted/40 rounded-xl p-3 font-mono text-sm" value={advanced} onChange={e=>setAdvanced(e.target.value)} />
            <div className="text-xs text-muted-foreground mt-2">ตัวอย่าง: {"{"}"custom":"value","foo":123{"}"}</div>
          </div>
        )}
      </div>

      <div className="flex justify-end"><Button onClick={()=>{
        let attrs = { ...attr };
        if (advanced && advanced.trim() && advanced.trim()!=="{}"){
          try { attrs = { ...attrs, ...(JSON.parse(advanced)) }; }
          catch { toast.error("JSON ขั้นสูงไม่ถูกต้อง"); return; }
        }
        onSave({ id:(initial?.id as string)||uid(), name, category, price, stock, cost, attributes: attrs } as Product);
      }}><Save className="w-4 h-4 mr-2"/> บันทึกสินค้า</Button></div>
    </div>
  );
}

// ===== Base Picker =====
function BasePicker({ inventory, selection, onSelect, sortMode, onChangeSort, required, filters }:{ inventory: Product[]; selection: Partial<Record<BaseCategory, Product>>; onSelect:(cat:BaseCategory, product:Product|null)=>void; sortMode: SortMode; onChangeSort:(m:SortMode)=>void; required: BaseCategory[]; filters: AttrFilters; }){
  const byCatRaw = useMemo(()=>{
    const map: Record<BaseCategory, Product[]> = Object.fromEntries(BASE_CATEGORIES.map(c=>[c,[]])) as any;
    for (const p of inventory) if (BASE_CATEGORIES.includes(p.category as BaseCategory) && p.stock>0) map[p.category as BaseCategory].push(p);
    return map;
  }, [inventory]);
  const byCat = useMemo(()=>{
    const m: Record<BaseCategory, Product[]> = {} as any;
    for (const c of BASE_CATEGORIES) m[c] = applyAttrFilters(c, byCatRaw[c], filters);
    return m;
  }, [byCatRaw, filters]);

  const comp = useMemo(()=>checkCompatibility(selection), [selection]);
  const selectedTotal = Object.values(selection).reduce((sum, p) => sum + (p?.price || 0), 0);

  const missingRequired = useMemo(()=>required.filter(c => !selection[c]), [required, selection]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5"/> อุปกรณ์หลัก</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {missingRequired.length>0 && (
            <div className="rounded-xl px-3 py-2 bg-red-50 text-red-700 text-sm">
              ต้องเลือกหมวดที่จำเป็น: {missingRequired.join(", ")}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">จัดเรียง:</span>
            <Select value={sortMode} onValueChange={(v)=>onChangeSort(v as SortMode)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="เลือกการจัดเรียง"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">ค่าเริ่มต้น</SelectItem>
                <SelectItem value="priceAsc">ราคาต่ำ→สูง</SelectItem>
                <SelectItem value="priceDesc">ราคาสูง→ต่ำ</SelectItem>
                <SelectItem value="nameAsc">ชื่อ A→Z</SelectItem>
                <SelectItem value="stockDesc">สต็อกมาก→น้อย</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {BASE_CATEGORIES.map((cat)=>(
            <div key={cat} className="grid grid-cols-12 items-center gap-2 p-2 rounded-xl hover:bg-muted/40">
              <div className="col-span-4 font-medium flex items-center gap-2">{categoryIcon[cat]} {cat} {required.includes(cat) && <span className="text-red-600 text-xs">*จำเป็น</span>}</div>
              <div className="col-span-8 flex gap-2">
                <Select value={selection[cat]?.id || "__none__"} onValueChange={(id)=>{ if(id==="__none__"){ onSelect(cat, null); if (required.includes(cat)) toast.error(`${cat} เป็นหมวดจำเป็น`); return; } const item = byCat[cat].find(p=>p.id===id) || null; onSelect(cat, item); }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={`เลือก ${cat} (ข้ามได้)`} /></SelectTrigger>
                  <SelectContent>
                    {/* ไม่เลือก (ข้าม) */}
                    <SelectItem key="__none__" value="__none__">— ไม่เลือก (ข้าม) —</SelectItem>
                    {sortProducts(byCat[cat], sortMode).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {baht(p.price)} {p.stock<=3 && <span className="text-amber-600">(เหลือ {p.stock})</span>}</SelectItem>
                    ))}
                    {byCat[cat].length===0 && <div className="px-3 py-2 text-muted-foreground">ไม่มีสินค้า</div>}
                  </SelectContent>
                </Select>
                <Button variant="secondary" onClick={()=>{ onSelect(cat, null); if (required.includes(cat)) toast.error(`${cat} เป็นหมวดจำเป็น`); }}>ข้าม</Button>
                {selection[cat] && (<Button variant="secondary" onClick={()=>onSelect(cat, null)}>ลบ</Button>)}
              </div>
            </div>
          ))}
          <div className="text-right font-semibold">รวมชิ้นส่วนหลัก: {baht(selectedTotal)}</div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5"/> ความเข้ากันได้</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {comp.notes.map((n,i)=>(
              <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 ${n.level==='error'?'bg-red-50 text-red-700':n.level==='warn'?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'}`}>
                {n.level==='error'?<AlertTriangle className="w-4 h-4 mt-0.5"/>:n.level==='warn'?<AlertTriangle className="w-4 h-4 mt-0.5"/>:<CheckCircle2 className="w-4 h-4 mt-0.5"/>}
                <span>{n.msg}</span>
              </div>
            ))}
            {comp.notes.length===0 && <div className="text-muted-foreground">เลือกอุปกรณ์เพื่อประเมิน</div>}
            <div className="text-sm text-muted-foreground mt-3">ประมาณการกำลังไฟ ~ {estimateWattage(selection)}W</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Add-ons Picker =====
function AddonsPicker({ inventory, addons, addAddon, updateQty, removeAddon, sortMode }:{ inventory: Product[]; addons: AddonEntry[]; addAddon:(p:Product, qty:number)=>void; updateQty:(id:string, qty:number)=>void; removeAddon:(id:string)=>void; sortMode: SortMode; }){
  const byCat = useMemo(()=>{
    const map: Record<AddonCategory, Product[]> = Object.fromEntries(ADDON_CATEGORIES.map(c=>[c,[]])) as any;
    for (const p of inventory) if (ADDON_CATEGORIES.includes(p.category as AddonCategory) && p.stock>0) map[p.category as AddonCategory].push(p);
    return map;
  }, [inventory]);

  const [selMonitor, setSelMonitor] = useState<string>("");
  const [qtyMonitor, setQtyMonitor] = useState<number>(1);
  const [selSoftware, setSelSoftware] = useState<string>("");
  const [qtySoftware, setQtySoftware] = useState<number>(1);
  const [selSSD, setSelSSD] = useState<string>("");
  const [qtySSD, setQtySSD] = useState<number>(1);

  const add = (cat: AddonCategory, id: string, qty: number) => {
    const items = byCat[cat]; const product = items.find(p=>p.id===id); if (!product){ toast.error("กรุณาเลือกสินค้า"); return; }
    if (qty < 1) { toast.error("จำนวนอย่างน้อย 1"); return; }
    addAddon(product, qty);
    toast.success(`เพิ่ม ${product.name} x${qty}`);
  };

  const totalAddons = addons.reduce((s,a)=>s + a.product.price * a.qty, 0);

  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5"/> Option เสริม</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Monitor row */}
        <div className="grid grid-cols-12 items-center gap-2 p-2 rounded-xl hover:bg-muted/40">
          <div className="col-span-3 font-medium flex items-center gap-2">{categoryIcon["Monitor"]} Monitor</div>
          <div className="col-span-6">
            <Select value={selMonitor} onValueChange={setSelMonitor}>
              <SelectTrigger className="w-full"><SelectValue placeholder="เลือก Monitor" /></SelectTrigger>
              <SelectContent>
                {sortProducts(byCat["Monitor"], sortMode).map(p=>(<SelectItem key={p.id} value={p.id}>{p.name} — {baht(p.price)}</SelectItem>))}
                {byCat["Monitor"].length===0 && <div className="px-3 py-2 text-muted-foreground">ไม่มีสินค้า</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Input type="number" min={1} value={qtyMonitor} onChange={(e)=>setQtyMonitor(Math.max(1, Number(e.target.value||1)))} />
          </div>
          <div className="col-span-1">
            <Button onClick={()=>add("Monitor", selMonitor, qtyMonitor)}>เพิ่ม</Button>
          </div>
        </div>

        {/* Software row */}
        <div className="grid grid-cols-12 items-center gap-2 p-2 rounded-xl hover:bg-muted/40">
          <div className="col-span-3 font-medium flex items-center gap-2">{categoryIcon["Software"]} Software</div>
          <div className="col-span-6">
            <Select value={selSoftware} onValueChange={setSelSoftware}>
              <SelectTrigger className="w-full"><SelectValue placeholder="เลือก Software" /></SelectTrigger>
              <SelectContent>
                {sortProducts(byCat["Software"], sortMode).map(p=>(<SelectItem key={p.id} value={p.id}>{p.name} — {baht(p.price)}</SelectItem>))}
                {byCat["Software"].length===0 && <div className="px-3 py-2 text-muted-foreground">ไม่มีสินค้า</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Input type="number" min={1} value={qtySoftware} onChange={(e)=>setQtySoftware(Math.max(1, Number(e.target.value||1)))} />
          </div>
          <div className="col-span-1">
            <Button onClick={()=>add("Software", selSoftware, qtySoftware)}>เพิ่ม</Button>
          </div>
        </div>

        {/* SSD row */}
        <div className="grid grid-cols-12 items-center gap-2 p-2 rounded-xl hover:bg-muted/40">
          <div className="col-span-3 font-medium flex items-center gap-2">{categoryIcon["SSD"]} SSD (เพิ่มไดรฟ์เสริม)</div>
          <div className="col-span-6">
            <Select value={selSSD} onValueChange={setSelSSD}>
              <SelectTrigger className="w-full"><SelectValue placeholder="เลือก SSD" /></SelectTrigger>
              <SelectContent>
                {sortProducts(byCat["SSD"], sortMode).map(p=>(<SelectItem key={p.id} value={p.id}>{p.name} — {baht(p.price)}</SelectItem>))}
                {byCat["SSD"].length===0 && <div className="px-3 py-2 text-muted-foreground">ไม่มีสินค้า</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Input type="number" min={1} value={qtySSD} onChange={(e)=>setQtySSD(Math.max(1, Number(e.target.value||1)))} />
          </div>
          <div className="col-span-1">
            <Button onClick={()=>add("SSD", selSSD, qtySSD)}>เพิ่ม</Button>
          </div>
        </div>

        {/* List */}
        <div className="border rounded-2xl">
          <div className="grid grid-cols-12 bg-muted/50 px-4 py-2 text-sm font-semibold">
            <div className="col-span-6">รายการ</div><div className="col-span-2 text-center">จำนวน</div><div className="col-span-2 text-right">ต่อชิ้น</div><div className="col-span-2 text-right">รวม</div>
          </div>
          <div className="max-h-60 overflow-auto">
            {addons.length===0 ? <div className="px-4 py-3 text-muted-foreground">ยังไม่มี Option เสริม</div> : addons.map(a=>(
              <div key={a.id} className="grid grid-cols-12 items-center px-4 py-2 border-t text-sm">
                <div className="col-span-6 flex items-center gap-2"><Badge variant="secondary">{a.product.category}</Badge><span className="truncate" title={a.product.name}>{a.product.name}</span></div>
                <div className="col-span-2 text-center"><Input type="number" min={1} value={a.qty} onChange={(e)=>updateQty(a.id, Math.max(1, Number(e.target.value||1)))} /></div>
                <div className="col-span-2 text-right">{baht(a.product.price)}</div>
                <div className="col-span-2 text-right flex items-center justify-end gap-2">{baht(a.product.price * a.qty)}<Button size="icon" variant="destructive" onClick={()=>removeAddon(a.id)}><Trash2 className="w-4 h-4"/></Button></div>
              </div>
            ))}
          </div>
          <div className="flex justify-end px-4 py-2 font-semibold">รวม Option เสริม: {baht(totalAddons)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Summary =====
type Pricing = {
  discountType: 'none'|'percent'|'fixed';
  discountValue: number;
  vatEnabled: boolean;
  vatPercent: number;
  showCost: boolean;
};

function Summary({ build, onReset, pricing, setPricing, required }:{ build: BuildState, onReset: ()=>void, pricing: Pricing, setPricing: (p:Pricing)=>void, required: BaseCategory[] }){
  const [showAll, setShowAll] = useState(false);
  const baseSelected = BASE_CATEGORIES
    .map(c => build.base[c] ? ({ c, p: build.base[c] as Product }) : null)
    .filter(Boolean) as {c: BaseCategory, p: Product}[];

  const baseAllRows = BASE_CATEGORIES.map(c => ({ c, p: build.base[c] as Product | undefined }));

  const baseTotal = baseSelected.reduce((s, {p}) => s + p.price, 0);
  const addonTotal = build.addons.reduce((s,a)=>s + a.product.price*a.qty, 0);
  const subtotal = baseTotal + addonTotal;

  const missingRequired = required.filter(c => !build.base[c]);

  // discount
  const discount = pricing.discountType==='percent' ? Math.min(subtotal, subtotal * (pricing.discountValue||0) / 100) :
                    pricing.discountType==='fixed' ? Math.min(subtotal, (pricing.discountValue||0)) : 0;
  const netBeforeVAT = Math.max(0, subtotal - discount);
  const vat = pricing.vatEnabled ? netBeforeVAT * (pricing.vatPercent||0) / 100 : 0;
  const total = netBeforeVAT + vat;

  // cost & profit (exclude VAT)
  const baseCost = baseSelected.reduce((s,{p})=>s + (typeof p.cost==="number" ? p.cost : 0),0);
  const addonCost = build.addons.reduce((s,a)=>s + (typeof a.product.cost==="number" ? a.product.cost*a.qty : 0),0);
  const costTotal = baseCost + addonCost;
  const profit = netBeforeVAT - costTotal;
  const margin = netBeforeVAT>0 ? (profit/netBeforeVAT)*100 : 0;

  const handleCopy = async () => {
    const lines: string[] = ["สรุปสเปคคอมพิวเตอร์"];
    const rows = showAll ? baseAllRows : baseAllRows.filter(r => !!r.p);
    for (const r of rows) {
      if (r.p) lines.push(`- ${r.c}: ${r.p.name} (${baht(r.p.price)})`);
      else lines.push(`- ${r.c}: — ไม่เลือก —`);
    }
    if (build.addons.length){
      lines.push("", "Option เสริม:");
      for (const a of build.addons) lines.push(`- ${a.product.category}: ${a.product.name} x${a.qty} (${baht(a.product.price*a.qty)})`);
    }
    lines.push("", `ส่วนลด: ${baht(discount)}${pricing.discountType==='percent' ? ` (${pricing.discountValue}%)` : ""}`);
    if (pricing.vatEnabled) lines.push(`VAT ${pricing.vatPercent}%: ${baht(vat)}`);
    lines.push(`รวมทั้งสิ้น: ${baht(total)}`);
    if (pricing.showCost) lines.push(`กำไร (ไม่รวม VAT): ${baht(profit)} • มาร์จิ้น: ${margin.toFixed(1)}%`);
    try { await navigator.clipboard.writeText(lines.join("\n")); toast.success("คัดลอกสรุปแล้ว"); } catch { toast.error("คัดลอกไม่สำเร็จ"); }
  };

  const handlePrint = () => {
    const rows = showAll ? baseAllRows : baseAllRows.filter(r => !!r.p);
    const htmlRows = rows.map(r => r.p
      ? `<tr><td>${r.c}</td><td>${r.p.name}</td><td>1</td><td style="text-align:right">${baht(r.p.price)}</td></tr>`
      : `<tr><td>${r.c}</td><td>— ไม่เลือก —</td><td>-</td><td style="text-align:right">-</td></tr>`
    ).join("");
    const htmlAddons = build.addons.map(a =>
      `<tr><td>${a.product.category}</td><td>${a.product.name}</td><td>${a.qty}</td><td style="text-align:right">${baht(a.product.price*a.qty)}</td></tr>`
    ).join("");

    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`
      <html><head><title>สรุปสเปค</title>
      <style> body{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; padding:24px;} h1{font-size:20px;} table{width:100%; border-collapse:collapse} td,th{border:1px solid #ddd; padding:8px;} th{background:#f8fafc;text-align:left} tfoot td{font-weight:700}</style>
      </head><body>
        <h1>สรุปสเปคคอมพิวเตอร์</h1>
        ${missingRequired.length ? `<div style="padding:8px 12px; background:#fef2f2; color:#991b1b; border-radius:10px; margin-bottom:12px;">ยังขาดหมวดจำเป็น: ${missingRequired.join(", ")}</div>` : ""}
        <table>
          <thead><tr><th>หมวด</th><th>ชื่อ</th><th>จำนวน</th><th>ราคา</th></tr></thead>
          <tbody>
            ${htmlRows}
            ${htmlAddons}
          </tbody>
          <tfoot>
            <tr><td colspan="3">ส่วนลด</td><td style="text-align:right">${baht(discount)}</td></tr>
            ${pricing.vatEnabled ? `<tr><td colspan="3">VAT ${pricing.vatPercent}%</td><td style="text-align:right">${baht(vat)}</td></tr>` : ""}
            <tr><td colspan="3">รวม</td><td style="text-align:right">${baht(total)}</td></tr>
          </tfoot>
        </table>
        ${pricing.showCost ? `<div style="margin-top:10px;">กำไร (ไม่รวม VAT): ${baht(profit)} • มาร์จิ้น: ${margin.toFixed(1)}%</div>` : ""}
      </body></html>
    `);
    w.document.close(); w.print();
  };

  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> สรุปสเปค & ราคา</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {missingRequired.length>0 && (
          <div className="rounded-xl px-3 py-2 bg-red-50 text-red-700">
            ยังขาดหมวดจำเป็น: {missingRequired.join(", ")}
          </div>
        )}
        {/* Pricing controls */}
        <div className="grid md:grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40">
          <div className="flex items-center gap-2">
            <Label className="w-24">ส่วนลด</Label>
            <Select value={pricing.discountType} onValueChange={(v)=>setPricing({ ...pricing, discountType: v as Pricing['discountType'] })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่มี</SelectItem>
                <SelectItem value="percent">% </SelectItem>
                <SelectItem value="fixed">จำนวนเงิน</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" className="w-32" value={pricing.discountValue} onChange={e=>setPricing({ ...pricing, discountValue: Number(e.target.value||0) })} placeholder="เช่น 10" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="w-24">VAT</Label>
            <Select value={pricing.vatEnabled ? "on" : "off"} onValueChange={(v)=>setPricing({ ...pricing, vatEnabled: v==="on" })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="on">เปิด</SelectItem><SelectItem value="off">ปิด</SelectItem></SelectContent>
            </Select>
            <Input type="number" className="w-24" value={pricing.vatPercent} onChange={e=>setPricing({ ...pricing, vatPercent: Number(e.target.value||0) })} />
            <span className="text-sm text-muted-foreground">%</span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={()=>setPricing({ ...pricing, showCost: !pricing.showCost })}>{pricing.showCost ? "ซ่อนกำไร" : "แสดงกำไร"}</Button>
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {(showAll ? baseAllRows : baseAllRows.filter(r => !!r.p)).map((r) => (
            r.p ? (
              <div key={r.p.id} className="flex justify-between bg-muted/30 rounded-xl px-3 py-2"><div className="font-medium">{r.c}: <span className="font-normal">{r.p.name}</span></div><div>{baht(r.p.price)}</div></div>
            ) : (
              <div key={String(r.c)} className="flex justify-between bg-muted/10 rounded-xl px-3 py-2 text-muted-foreground"><div className="font-medium">{r.c}: <span className="font-normal">— ไม่เลือก —</span></div><div>-</div></div>
            )
          ))}

          {build.addons.map(a => (
            <div key={a.id} className="flex justify-between bg-muted/20 rounded-xl px-3 py-2"><div>{a.product.category}: {a.product.name} <span className="text-xs text-muted-foreground">x{a.qty}</span></div><div>{baht(a.product.price*a.qty)}</div></div>
          ))}

          {!showAll && baseSelected.length===0 && build.addons.length===0 && <div className="text-muted-foreground">ยังไม่ได้เลือกชิ้นส่วน</div>}
        </div>

        {/* Totals */}
        <div className="space-y-1 text-right">
          <div>ยอดก่อนส่วนลด: <span className="font-medium">{baht(subtotal)}</span></div>
          <div>ส่วนลด: <span className="font-medium">{baht(discount)}</span></div>
          {pricing.vatEnabled && <div>VAT {pricing.vatPercent}%: <span className="font-medium">{baht(vat)}</span></div>}
          <div className="text-lg font-bold">ยอดรวมสุทธิ: {baht(total)}</div>
          {pricing.showCost && <div className="text-sm text-muted-foreground">กำไร (ไม่รวม VAT): {baht(profit)} • มาร์จิ้น {margin.toFixed(1)}%</div>}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={()=>setShowAll(s=>!s)}>{showAll? "ซ่อนหมวดที่ไม่ได้เลือก" : "แสดงหมวดที่ไม่ได้เลือก"}</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={onReset}><Trash2 className="w-4 h-4 mr-2"/> รีเซ็ตสเปค</Button>
            <Button variant="secondary" onClick={handleCopy}><Download className="w-4 h-4 mr-2"/> คัดลอกสรุป</Button>
            <Button onClick={handlePrint}><Download className="w-4 h-4 mr-2"/> พิมพ์/บันทึก PDF</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Smart Sync (derive filters from selection) =====
function deriveFiltersFromSelection(base: Partial<Record<BaseCategory, Product>>, current: AttrFilters): AttrFilters {
  const next: AttrFilters = { ...current };
  const cpu = base["CPU"]; const mb = base["Motherboard"]; const cooler = base["Cooler"]; const storage = base["Storage"]; const psu = base["PSU"];
  if (cpu?.attributes?.socket) next.socket = cpu.attributes.socket;
  if (!cpu?.attributes?.socket && mb?.attributes?.socket) next.socket = mb.attributes.socket;
  if (mb?.attributes?.ramType) next.ramType = mb.attributes.ramType;
  if (mb?.attributes?.formFactor) next.formFactor = mb.attributes.formFactor;
  if (storage?.attributes?.interface) next.storageInterface = storage.attributes.interface;
  if (!storage?.attributes?.interface && Array.isArray(mb?.attributes?.storage) && mb!.attributes.storage.length>0) next.storageInterface = mb!.attributes.storage[0];
  if (cpu?.attributes?.socket) next.coolerSocket = cpu.attributes.socket;
  if (psu) next.minPSUWatt = Math.max(estimateWattage(base), 0);
  return next;
}

// ===== Main App =====
export default function App(){
  const [inventory, setInventory] = useLocalStorage<Product[]>(STORAGE_KEYS.inventory, DEMO_DATA);
  const [build, setBuild] = useLocalStorage<BuildState>(STORAGE_KEYS.build, { base: {}, addons: [] });
  const [pricing, setPricing] = useLocalStorage<Pricing>(STORAGE_KEYS.pricing, { discountType:"none", discountValue:0, vatEnabled:true, vatPercent:7, showCost:true });
  const [required, setRequired] = useLocalStorage<BaseCategory[]>(STORAGE_KEYS.required, ["CPU","Motherboard","PSU"]);
  const [filters, setFilters] = useLocalStorage<AttrFilters>(STORAGE_KEYS.filters, {});
  const [smartSync, setSmartSync] = useLocalStorage<boolean>(STORAGE_KEYS.smartSync, true);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('default');

  // Command palette search (Ctrl/Cmd+K)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const sortLabel = useMemo(() => ({
    default: 'ค่าเริ่มต้น',
    priceAsc: 'ราคาต่ำ→สูง',
    priceDesc: 'ราคาสูง→ต่ำ',
    nameAsc: 'ชื่อ A→Z',
    stockDesc: 'สต็อกมาก→น้อย',
  } as Record<SortMode, string>)[sortMode], [sortMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase(); if (!q) return inventory;
    return inventory.filter(p => [p.name, p.category, JSON.stringify(p.attributes)].join(" ").toLowerCase().includes(q));
  }, [inventory, query]);

  const sortedFiltered = useMemo(()=>sortProducts(filtered, sortMode), [filtered, sortMode]);

  const saveProduct = (p: Product) => {
    setInventory(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = p; else next.unshift(p);
      toast.success(idx >= 0 ? "อัปเดตสินค้าแล้ว" : "เพิ่มสินค้าแล้ว");
      return next;
    });
  };
  const deleteProduct = (id: string) => { setInventory(prev => prev.filter(p => p.id !== id)); toast.success("ลบสินค้าแล้ว"); };

  const handleImport = async (file: File) => {
    try { const items = await parseWorkbookToProducts(file); setInventory(prev => [...items, ...prev]); toast.success(`นำเข้า ${items.length} รายการสำเร็จ`); }
    catch (e:any){ toast.error("นำเข้าล้มเหลว: " + (e?.message || "")); }
  };

  const clearAll = () => {
    if (!confirm("ล้างข้อมูลทั้งหมด (คลัง & สเปคที่เลือก)?")) return;
    setInventory(DEMO_DATA); setBuild({ base: {}, addons: [] }); toast.message("รีเซ็ตเป็นข้อมูลตัวอย่างแล้ว");
  };

  const selectBase = (cat: BaseCategory, product: Product | null) => {
    setBuild(prev => ({ ...prev, base: { ...prev.base, [cat]: product || undefined } }));
  };
  const addAddon = (product: Product, qty: number) => {
    setBuild(prev => {
      const existing = prev.addons.find(a => a.product.id === product.id);
      if (existing) {
        return { ...prev, addons: prev.addons.map(a => a.product.id===product.id ? { ...a, qty: a.qty + qty } : a) };
      }
      return { ...prev, addons: [...prev.addons, { id: uid(), product, qty }] };
    });
  };
  const updateAddonQty = (id: string, qty: number) => setBuild(prev => ({ ...prev, addons: prev.addons.map(a => a.id===id ? { ...a, qty } : a) }));
  const removeAddon = (id: string) => setBuild(prev => ({ ...prev, addons: prev.addons.filter(a => a.id!==id) }));

  // --- One-click reset spec (base parts + addons)
  const resetSpec = () => { setBuild({ base: {}, addons: [] }); try { (window as any).scrollTo({ top: 0, behavior: 'smooth' }); } catch {} ; toast.message('รีเซ็ตสเปคเรียบร้อย'); };

  const baseTotal = Object.values(build.base).reduce((s,p)=>s+(p?.price||0),0);
  const addonTotal = build.addons.reduce((s,a)=>s+a.product.price*a.qty,0);
  const grandTotal = baseTotal + addonTotal;

  // derived options list for filters (quick suggestions)
  const socketOptions = useMemo(()=>Array.from(new Set(inventory.map(p=>p.attributes?.socket).filter(Boolean))), [inventory]) as string[];
  const ramTypeOptions = useMemo(()=>Array.from(new Set(inventory.map(p=>p.attributes?.ramType).filter(Boolean))), [inventory]) as string[];
  const formFactorOptions = useMemo(()=>Array.from(new Set(inventory.map(p=>p.attributes?.formFactor).filter(Boolean))), [inventory]) as string[];
  const storageIfOptions = useMemo(()=>Array.from(new Set(inventory.flatMap(p=>(p.attributes?.storage||[])).filter(Boolean))), [inventory]) as string[];

  // Smart Sync effect
  useEffect(()=>{
    if (!smartSync) return;
    const next = deriveFiltersFromSelection(build.base, filters);
    setFilters(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build.base, smartSync]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Modern header */}
      <div className="rounded-2xl p-5 mb-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white shadow">
        <motion.h1 initial={{opacity:0, y:-8}} animate={{opacity:1, y:0}} className="text-2xl md:text-3xl font-bold tracking-tight">
          Ubon Computer Speccom V.3
        </motion.h1>
        <div className="text-slate-300 text-sm mt-1">ระบบจัดสเปคคอมพิวเตอร์ อุบลคอมพิวเตอร์</div>
      </div>

      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="text-sm text-slate-600">กด <span className="px-2 py-1 rounded bg-slate-200 font-mono">Ctrl/⌘</span> + <span className="px-2 py-1 rounded bg-slate-200 font-mono">K</span> เพื่อค้นหาอย่างรวดเร็ว</div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={resetSpec}>รีเซ็ตสเปค</Button>
          <Button onClick={()=>setSearchOpen(true)}>ค้นหาสินค้า (⌘K)</Button>
        </div>
      </div>

      <Tabs defaultValue="builder" className="space-y-4">
        <TabsList>
          <TabsTrigger value="builder">จัดสเปค</TabsTrigger>
          <TabsTrigger value="inventory">คลังสินค้า</TabsTrigger>
          <TabsTrigger value="summary">สรุปผล</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-4">
          {/* Required categories & Filters */}
          <Card className="shadow-sm">
            <CardHeader><CardTitle>การตั้งค่า Builder</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm text-muted-foreground mr-1">หมวดที่จำเป็นต้องเลือก:</div>
                {BASE_CATEGORIES.map(c=>{
                  const active = required.includes(c);
                  return <Button key={c} variant="secondary" onClick={()=>{
                    setRequired(active ? required.filter(x=>x!==c) : [...required, c]);
                  }}>{active ? `✓ ${c}` : c}</Button>;
                })}
              </div>

              {/* Smart Sync controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm text-muted-foreground mr-1">Smart Sync (ซิงก์ตัวกรองตามชิ้นส่วนที่เลือก):</div>
                <Button variant="secondary" onClick={()=>setSmartSync(!smartSync)}>{smartSync ? "เปิดอยู่" : "ปิดอยู่"}</Button>
                <Button variant="secondary" onClick={()=>setFilters(deriveFiltersFromSelection(build.base, {}))}>ซิงก์ตอนนี้</Button>
              </div>

              {/* Attribute Filters (chips + clear) */}
              <div className="grid md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Socket (CPU/MB)</Label>
                  <div className="flex flex-wrap gap-2">
                    {socketOptions.map(s=>(<Chip key={s} active={filters.socket===s} onClick={()=>setFilters({...filters, socket: filters.socket===s? undefined : s})}>{s}</Chip>))}
                  </div>
                  {filters.socket && <div className="mt-1"><ClearChip label={`Socket: ${filters.socket}`} onClear={()=>setFilters({...filters, socket: undefined})}/></div>}
                </div>
                <div className="space-y-1">
                  <Label>RAM Type (MB/RAM)</Label>
                  <div className="flex flex-wrap gap-2">
                    {ramTypeOptions.map(s=>(<Chip key={s} active={filters.ramType===s} onClick={()=>setFilters({...filters, ramType: filters.ramType===s? undefined : s})}>{s}</Chip>))}
                  </div>
                  {filters.ramType && <div className="mt-1"><ClearChip label={`RAM: ${filters.ramType}`} onClear={()=>setFilters({...filters, ramType: undefined})}/></div>}
                </div>
                <div className="space-y-1">
                  <Label>Form Factor (MB/Case)</Label>
                  <div className="flex flex-wrap gap-2">
                    {formFactorOptions.map(s=>(<Chip key={s} active={filters.formFactor===s} onClick={()=>setFilters({...filters, formFactor: filters.formFactor===s? undefined : s})}>{s}</Chip>))}
                  </div>
                  {filters.formFactor && <div className="mt-1"><ClearChip label={`Form: ${filters.formFactor}`} onClear={()=>setFilters({...filters, formFactor: undefined})}/></div>}
                </div>
                <div className="space-y-1">
                  <Label>Storage Interface (MB/Storage)</Label>
                  <div className="flex flex-wrap gap-2">
                    {storageIfOptions.map(s=>(<Chip key={s} active={filters.storageInterface===s} onClick={()=>setFilters({...filters, storageInterface: filters.storageInterface===s? undefined : s})}>{s}</Chip>))}
                  </div>
                  {filters.storageInterface && <div className="mt-1"><ClearChip label={`Storage: ${filters.storageInterface}`} onClear={()=>setFilters({...filters, storageInterface: undefined})}/></div>}
                </div>
                <div className="space-y-1">
                  <Label>PSU ขั้นต่ำ (W)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={typeof filters.minPSUWatt==="number"?filters.minPSUWatt:""} onChange={e=>setFilters({...filters, minPSUWatt: e.target.value? Number(e.target.value): undefined})} placeholder="เช่น 650" className="w-40"/>
                    {typeof filters.minPSUWatt==="number" && <ClearChip label={`≥ ${filters.minPSUWatt}W`} onClear={()=>setFilters({...filters, minPSUWatt: undefined})}/>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Cooler รองรับซ็อกเก็ต</Label>
                  <Input value={filters.coolerSocket || ""} onChange={e=>setFilters({...filters, coolerSocket: e.target.value || undefined})} placeholder="เช่น AM5" />
                  {filters.coolerSocket && <div className="mt-1"><ClearChip label={`Cooler: ${filters.coolerSocket}`} onClear={()=>setFilters({...filters, coolerSocket: undefined})}/></div>}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={()=>setFilters({})}>ล้างตัวกรอง</Button>
              </div>
            </CardContent>
          </Card>

          <BasePicker inventory={inventory} selection={build.base} onSelect={selectBase} sortMode={sortMode} onChangeSort={setSortMode} required={required} filters={filters} />
          <AddonsPicker inventory={inventory} addons={build.addons} addAddon={addAddon} updateQty={updateAddonQty} removeAddon={removeAddon} sortMode={sortMode} />
          {/* Sticky total */}
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">สรุปรวมปัจจุบัน (ยังไม่หักส่วนลด/VAT)</div>
              <div className="font-bold text-xl">{baht(grandTotal)}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="md:col-span-3">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><HardDrive className="w-5 h-5"/> คลังสินค้า</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={sortMode} onValueChange={(v)=>setSortMode(v as SortMode)}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="จัดเรียง"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">ค่าเริ่มต้น</SelectItem>
                      <SelectItem value="priceAsc">ราคาต่ำ→สูง</SelectItem>
                      <SelectItem value="priceDesc">ราคาสูง→ต่ำ</SelectItem>
                      <SelectItem value="nameAsc">ชื่อ A→Z</SelectItem>
                      <SelectItem value="stockDesc">สต็อกมาก→น้อย</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="ค้นหา..." value={query} onChange={(e)=>setQuery(e.target.value)} className="w-48"/>
                  <Button variant="secondary" onClick={clearAll}>รีเซ็ต</Button>
                </div>
              </CardHeader>
              <CardContent>
                <InventoryTable items={sortedFiltered} onEdit={setEditing} onDelete={deleteProduct} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5"/> เพิ่ม/แก้สินค้า</CardTitle></CardHeader>
              <CardContent>
                <ProductEditor onSave={saveProduct} initial={undefined} />
                <div className="mt-4 border-t pt-4 space-y-2">
                  <div className="font-semibold flex items-center gap-2"><FileUp className="w-4 h-4"/> นำเข้า Excel / CSV</div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleImport(f); }} />
                  <div className="text-xs text-muted-foreground">คอลัมน์ที่รองรับ: Category, Name, Price, Cost, Stock, Attributes ... (รองรับ Monitor/Software/SSD)</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="summary">
          <Summary build={build} onReset={resetSpec} pricing={pricing} setPricing={setPricing} required={required} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o)=>!o && setEditing(null)}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader><DialogTitle>แก้ไขสินค้า</DialogTitle></DialogHeader>
          {editing && <ProductEditor initial={editing} onSave={(p)=>{ saveProduct(p); setEditing(null); }} />}
          <DialogFooter><Button variant="secondary" onClick={()=>setEditing(null)}>ปิด</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Search Dialog (single instance) */}
      <Dialog open={searchOpen} onOpenChange={(o)=>setSearchOpen(o)}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader><DialogTitle>ค้นหาสินค้า</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder={"พิมพ์คำค้น เช่น 'Ryzen', '27\"', 'Windows', 'NV2'"}
              value={searchText}
              onChange={(e)=>setSearchText(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">ผลลัพธ์เรียงตาม: {sortLabel}</div>
            <div className="border rounded-xl max-h-80 overflow-auto">
              {(() => {
                const q = searchText.trim().toLowerCase();
                const results = sortProducts(inventory.filter(p => !q || [p.name, p.category, JSON.stringify(p.attributes)].join(" ").toLowerCase().includes(q)), sortMode);
                if (results.length === 0) return <div className="px-4 py-3 text-muted-foreground">ไม่พบสินค้า</div>;
                return results.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2 border-t first:border-t-0 hover:bg-muted/40">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{p.category}</Badge>
                      <div className="truncate" title={p.name}>{p.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm">{baht(p.price)}</div>
                      {((BASE_CATEGORIES as readonly string[]).includes(p.category)) ? (
                        <Button onClick={()=>{ setBuild(prev => ({ ...prev, base: { ...prev.base, [p.category as BaseCategory]: p } })); toast.success(`ใส่ ${p.category} แล้ว`); setSearchOpen(false); }}>ใส่ใน {p.category}</Button>
                      ) : (
                        <Button onClick={()=>{ setBuild(prev => ({ ...prev, addons: [...prev.addons, { id: uid(), product: p, qty: 1 }] })); toast.success(`เพิ่ม ${p.name} (Option)`); setSearchOpen(false); }}>เพิ่มเป็น Option</Button>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
          <DialogFooter><Button variant="secondary" onClick={()=>setSearchOpen(false)}>ปิด</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-xs text-muted-foreground mt-6">* Client-side demo: เก็บข้อมูลในเบราว์เซอร์ของคุณ รองรับนำเข้า Excel/CSV</div>
    </div>
  );
}

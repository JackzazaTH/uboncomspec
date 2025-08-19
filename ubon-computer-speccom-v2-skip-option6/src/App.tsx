
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, Trash2, Edit, HardDrive, Cpu, MemoryStick, HardDrive as StorageIcon, Power, Monitor, Wrench, CaseSensitive, Download, FileUp, Save, ListChecks, ShoppingCart, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import * as XLSX from "xlsx";

/**
 * Ubon Computer SpecCom V.1 — single-file React app
 * - Inventory (CRUD) with price & stock
 * - Excel import (xlsx/csv) with smart column mapping
 * - Compatibility engine (CPU-MB socket, RAM type, cooler socket, PSU wattage, case form factor, storage interface)
 * - Builder workspace with live compatibility hints
 * - NEW: Add-ons (Monitor, Software) with quantity
 * - Summary with total price, stock check, export/copy/print
 * - Persistent via localStorage
 */

// ===== Categories =====
const BASE_CATEGORIES = ["CPU","Motherboard","GPU","RAM","Storage","PSU","Case","Cooler"] as const;
const ADDON_CATEGORIES = ["Monitor","Software"] as const;

const ALL_CATEGORIES = [...BASE_CATEGORIES, ...ADDON_CATEGORIES] as const;
type BaseCategory = typeof BASE_CATEGORIES[number];
type AddonCategory = typeof ADDON_CATEGORIES[number];
type Category = typeof ALL_CATEGORIES[number];

export type Product = {
  id: string;
  name: string;
  category: Category;
  price: number;
  stock: number;
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
  inventory: "ubonspec.inventory.v1",
  build: "ubonspec.build.v1",
} as const;

// ===== Demo Inventory =====
const DEMO_DATA: Product[] = [
  { id: uid(), name: "AMD Ryzen 5 7600", category: "CPU", price: 7490, stock: 8, attributes: { socket: "AM5", tdp: 65 } },
  { id: uid(), name: "Intel Core i5-13400F", category: "CPU", price: 6990, stock: 12, attributes: { socket: "LGA1700", tdp: 148 } },

  { id: uid(), name: "ASUS TUF B650-PLUS", category: "Motherboard", price: 7290, stock: 6, attributes: { socket: "AM5", ramType: "DDR5", formFactor: "ATX", pcieSlots: 2, storage: ["M.2 NVMe", "SATA"] } },
  { id: uid(), name: "MSI PRO B760M-A", category: "Motherboard", price: 4990, stock: 9, attributes: { socket: "LGA1700", ramType: "DDR5", formFactor: "mATX", pcieSlots: 2, storage: ["M.2 NVMe", "SATA"] } },

  { id: uid(), name: "NVIDIA RTX 4070 SUPER", category: "GPU", price: 19990, stock: 4, attributes: { tdp: 220, interface: "PCIe" } },
  { id: uid(), name: "MSI GTX 1660 SUPER", category: "GPU", price: 6990, stock: 5, attributes: { tdp: 125, interface: "PCIe" } },

  { id: uid(), name: "Kingston Fury 16GB (2x8) 6000 DDR5", category: "RAM", price: 2190, stock: 15, attributes: { type: "DDR5", sizeGB: 16 } },
  { id: uid(), name: "Corsair Vengeance 32GB (2x16) 3200 DDR4", category: "RAM", price: 2690, stock: 10, attributes: { type: "DDR4", sizeGB: 32 } },

  { id: uid(), name: "WD Black SN770 1TB NVMe", category: "Storage", price: 2990, stock: 18, attributes: { interface: "M.2 NVMe" } },
  { id: uid(), name: "Seagate Barracuda 2TB SATA", category: "Storage", price: 1690, stock: 8, attributes: { interface: "SATA" } },

  { id: uid(), name: "Corsair RM750", category: "PSU", price: 3290, stock: 7, attributes: { wattage: 750 } },
  { id: uid(), name: "Antec NeoECO 550", category: "PSU", price: 1890, stock: 11, attributes: { wattage: 550 } },

  { id: uid(), name: "NZXT H5 Flow", category: "Case", price: 3590, stock: 3, attributes: { formFactorSupport: ["ATX", "mATX", "ITX"] } },
  { id: uid(), name: "Cooler Master NR200", category: "Case", price: 3290, stock: 5, attributes: { formFactorSupport: ["ITX"] } },

  { id: uid(), name: "DeepCool AK400", category: "Cooler", price: 1190, stock: 9, attributes: { socketSupport: ["AM5", "LGA1700"] } },
  { id: uid(), name: "NZXT Kraken 240", category: "Cooler", price: 4490, stock: 4, attributes: { socketSupport: ["AM5", "LGA1700"] } },

  // Add-ons
  { id: uid(), name: "AOC 24G2 24\" 144Hz IPS", category: "Monitor", price: 4490, stock: 10, attributes: { size: 24, refresh: 144 } },
  { id: uid(), name: "LG 27GP850 27\" 165Hz", category: "Monitor", price: 10990, stock: 5, attributes: { size: 27, refresh: 165 } },
  { id: uid(), name: "Windows 11 Pro (OEM)", category: "Software", price: 4590, stock: 20, attributes: { license: "OEM" } },
  { id: uid(), name: "Microsoft Office 365 Family (1y)", category: "Software", price: 2190, stock: 30, attributes: { license: "Subscription" } },
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
          };
          for (const [key, aliases] of Object.entries(aliasPairs)) {
            for (const a of aliases) {
              const v = map[normalizeHeader(a)];
              if (v !== undefined && v !== "") {
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

          out.push({ id: uid(), name, category, price, stock, attributes });
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
};

// ===== Inventory Table =====
function InventoryTable({ items, onEdit, onDelete }:{ items: Product[]; onEdit:(p:Product)=>void; onDelete:(id:string)=>void; }){
  return (<div className="border rounded-2xl overflow-hidden">
    <div className="grid grid-cols-12 bg-muted/50 px-4 py-2 text-sm font-semibold">
      <div className="col-span-5">สินค้า</div><div className="col-span-2">หมวด</div><div className="col-span-2 text-right">ราคา</div><div className="col-span-1 text-right">สต็อก</div><div className="col-span-2 text-right">จัดการ</div>
    </div>
    <div className="max-h-[360px] overflow-auto">
      {items.map(p=>(<div key={p.id} className="grid grid-cols-12 items-center px-4 py-2 border-t hover:bg-muted/30 text-sm">
        <div className="col-span-5 truncate flex items-center gap-2"><Badge variant="secondary" className="rounded-xl">{categoryIcon[p.category]}<span className="ml-2">{p.category}</span></Badge><span className="font-medium truncate" title={p.name}>{p.name}</span></div>
        <div className="col-span-2">{(p as any).attributes.socket || (p as any).attributes.type || (p as any).attributes.size || (p as any).attributes.license || "-"}</div>
        <div className="col-span-2 text-right">{baht(p.price)}</div>
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
function ProductEditor({ initial, onSave }: { initial?: Partial<Product>, onSave: (p: Product) => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState<Category>((initial?.category as Category) || "CPU");
  const [price, setPrice] = useState<number>(Number(initial?.price || 0));
  const [stock, setStock] = useState<number>(Number(initial?.stock || 0));
  const [attributes, setAttributes] = useState<string>(initial?.attributes ? JSON.stringify(initial.attributes, null, 2) : "{}");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>ชื่อสินค้า</Label><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="เช่น Ryzen 5 7600" /></div>
        <div>
          <Label>หมวดหมู่</Label>
          <Select value={category} onValueChange={(v)=>setCategory(v as Category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_CATEGORIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>ราคา (บาท)</Label><Input type="number" value={price} onChange={(e)=>setPrice(Number(e.target.value))} /></div>
        <div><Label>สต็อก</Label><Input type="number" value={stock} onChange={(e)=>setStock(Number(e.target.value))} /></div>
      </div>
      <div>
        <Label>คุณสมบัติ (JSON)</Label>
        <textarea className="w-full min-h-40 bg-muted/40 rounded-xl p-3 font-mono text-sm" value={attributes} onChange={e=>setAttributes(e.target.value)} />
        <div className="text-xs text-muted-foreground mt-2">
          ตัวอย่าง CPU: {"{"}"socket":"AM5","tdp":65{"}"} | RAM: {"{"}"type":"DDR5","sizeGB":32{"}"} | Monitor: {"{"}"size":27,"refresh":165{"}"} | Software: {"{"}"license":"OEM"{"}"}
        </div>
      </div>
      <div className="flex justify-end"><Button onClick={()=>{
        try{ const attrs = JSON.parse(attributes || "{}"); onSave({ id:(initial?.id as string)||uid(), name, category, price, stock, attributes: attrs } as Product); }
        catch{ toast.error("JSON Attributes ไม่ถูกต้อง"); }
      }}><Save className="w-4 h-4 mr-2"/> บันทึกสินค้า</Button></div>
    <Dialog open={searchOpen} onOpenChange={(o)=>setSearchOpen(o)}>
  <DialogContent className="sm:max-w-[720px]">
    <DialogHeader><DialogTitle>ค้นหาสินค้า</DialogTitle></DialogHeader>
    <div className="space-y-3">
      <Input
        autoFocus
        placeholder="พิมพ์คำค้น เช่น 'Ryzen', '27\"', 'Windows'"', 'Windows'"
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
                  <Button onClick={()=>{ setBuild(prev => ({ ...prev, addons: [...prev.addons, { id: Math.random().toString(36).slice(2,9), product: p, qty: 1 }] })); toast.success(`เพิ่ม ${p.name} (Option)`); setSearchOpen(false); }}>เพิ่มเป็น Option</Button>
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

    </div>
  );
}

// ===== Base Picker =====
function BasePicker({ inventory, selection, onSelect, sortMode }:{ inventory: Product[]; selection: Partial<Record<BaseCategory, Product>>; onSelect:(cat:BaseCategory, product:Product|null)=>void; sortMode: SortMode; }){
  const byCat = useMemo(()=>{
    const map: Record<BaseCategory, Product[]> = Object.fromEntries(BASE_CATEGORIES.map(c=>[c,[]])) as any;
    for (const p of inventory) if (BASE_CATEGORIES.includes(p.category as BaseCategory) && p.stock>0) map[p.category as BaseCategory].push(p);
    return map;
  }, [inventory]);
  const comp = useMemo(()=>checkCompatibility(selection), [selection]);
  const selectedTotal = Object.values(selection).reduce((sum, p) => sum + (p?.price || 0), 0);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5"/> อุปกรณ์หลัก</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">จัดเรียง:</span>
            <Select value={sortMode} onValueChange={(v)=>{}}>
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
              <div className="col-span-4 font-medium flex items-center gap-2">{categoryIcon[cat]} {cat}</div>
              <div className="col-span-8 flex gap-2">
                <Select value={selection[cat]?.id || ""} onValueChange={(id)=>{ const item = byCat[cat].find(p=>p.id===id) || null; onSelect(cat, item); }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={`เลือก ${cat}`} /></SelectTrigger>
                  <SelectContent>
                    {sortProducts(byCat[cat], sortMode).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {baht(p.price)} {p.stock<=3 && <span className="text-amber-600">(เหลือ {p.stock})</span>}</SelectItem>
                    ))}
                    {byCat[cat].length===0 && <div className="px-3 py-2 text-muted-foreground">ไม่มีสินค้า</div>}
                  </SelectContent>
                </Select>
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
    <Dialog open={searchOpen} onOpenChange={(o)=>setSearchOpen(o)}>
  <DialogContent className="sm:max-w-[720px]">
    <DialogHeader><DialogTitle>ค้นหาสินค้า</DialogTitle></DialogHeader>
    <div className="space-y-3">
      <Input
        autoFocus
        placeholder="พิมพ์คำค้น เช่น 'Ryzen', '27\"', 'Windows'"', 'Windows'"
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
                  <Button onClick={()=>{ setBuild(prev => ({ ...prev, addons: [...prev.addons, { id: Math.random().toString(36).slice(2,9), product: p, qty: 1 }] })); toast.success(`เพิ่ม ${p.name} (Option)`); setSearchOpen(false); }}>เพิ่มเป็น Option</Button>
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
function Summary({ build }:{ build: BuildState }){
  const baseItems = BASE_CATEGORIES.map(c=>build.base[c]).filter(Boolean) as Product[];
  const baseTotal = baseItems.reduce((s,p)=>s+p.price,0);
  const addonTotal = build.addons.reduce((s,a)=>s + a.product.price*a.qty, 0);
  const total = baseTotal + addonTotal;

  const handleCopy = async () => {
    const text = [
      "สรุปสเปคคอมพิวเตอร์",
      ...baseItems.map(p => `- ${p.category}: ${p.name} (${baht(p.price)})`),
      ...(build.addons.length? ["", "Option เสริม:", ...build.addons.map(a => `- ${a.product.category}: ${a.product.name} x${a.qty} (${baht(a.product.price*a.qty)})`)] : []),
      ``, `รวมทั้งสิ้น: ${baht(total)}`,
    ].join("\n");
    try { await navigator.clipboard.writeText(text); toast.success("คัดลอกสรุปแล้ว"); } catch { toast.error("คัดลอกไม่สำเร็จ"); }
  };

  const handlePrint = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`
      <html><head><title>สรุปสเปค</title>
      <style> body{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; padding:24px;} h1{font-size:20px;} table{width:100%; border-collapse:collapse} td,th{border:1px solid #ddd; padding:8px;} th{background:#f8fafc;text-align:left} tfoot td{font-weight:700}</style>
      </head><body>
        <h1>สรุปสเปคคอมพิวเตอร์</h1>
        <table>
          <thead><tr><th>หมวด</th><th>ชื่อ</th><th>จำนวน</th><th>ราคา</th></tr></thead>
          <tbody>
            ${baseItems.map(p => `<tr><td>${p.category}</td><td>${p.name}</td><td>1</td><td style="text-align:right">${baht(p.price)}</td></tr>`).join("")}
            ${build.addons.map(a => `<tr><td>${a.product.category}</td><td>${a.product.name}</td><td>${a.qty}</td><td style="text-align:right">${baht(a.product.price*a.qty)}</td></tr>`).join("")}
          </tbody>
          <tfoot><tr><td colspan="3">รวม</td><td style="text-align:right">${baht(total)}</td></tr></tfoot>
        </table>
      </body></html>
    `);
    w.document.close(); w.print();
  };

  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> สรุปสเปค & ราคา</CardTitle></CardHeader>
      <CardContent className="space-y-3">
          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted-foreground">จัดเรียง:</span>
            <Select value={sortMode} onValueChange={(v)=>{}}>
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
        <div className="space-y-2">
          {baseItems.map(p => (
            <div key={p.id} className="flex justify-between bg-muted/30 rounded-xl px-3 py-2"><div className="font-medium">{p.category}: <span className="font-normal">{p.name}</span></div><div>{baht(p.price)}</div></div>
          ))}
          {build.addons.map(a => (
            <div key={a.id} className="flex justify-between bg-muted/20 rounded-xl px-3 py-2"><div>{a.product.category}: {a.product.name} <span className="text-xs text-muted-foreground">x{a.qty}</span></div><div>{baht(a.product.price*a.qty)}</div></div>
          ))}
          {baseItems.length===0 && build.addons.length===0 && <div className="text-muted-foreground">ยังไม่ได้เลือกชิ้นส่วน</div>}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">พร้อมสรุปรายการสั่งซื้อ</div>
          <div className="font-bold text-xl">รวม: {baht(total)}</div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="destructive" onClick={resetSpec}><Trash2 className="w-4 h-4 mr-2"/> รีเซ็ตสเปค</Button>
          <Button variant="secondary" onClick={handleCopy}><Download className="w-4 h-4 mr-2"/> คัดลอกสรุป</Button>
          <Button onClick={handlePrint}><Download className="w-4 h-4 mr-2"/> พิมพ์/บันทึก PDF</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Main App =====
export default function App(){
  const [inventory, setInventory] = useLocalStorage<Product[]>(STORAGE_KEYS.inventory, DEMO_DATA);
  // migrate previous build format (object of categories) -> BuildState
  const [build, setBuild] = useLocalStorage<BuildState>(STORAGE_KEYS.build, { base: {}, addons: [] });
  useEffect(()=>{
    // If old structure detected (not having 'addons'), wrap into new structure
    if ((build as any) && !("addons" in build)) {
      const old = build as unknown as Partial<Record<BaseCategory, Product>>;
      const newBuild: BuildState = { base: {}, addons: [] };
      BASE_CATEGORIES.forEach(c => { if ((old as any)[c]) newBuild.base[c] = (old as any)[c]; });
      setBuild(newBuild);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
const [sortMode, setSortMode] = useState<SortMode>('default');

// Command palette search (Ctrl/Cmd+K)
const [searchOpen, setSearchOpen] = useState(false);
const [searchText, setSearchText] = useState('');
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

  const selectBase = (cat: BaseCategory, product: Product | null) => { setBuild(prev => ({ ...prev, base: { ...prev.base, [cat]: product || undefined } })); };
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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Modern header */}
      <div className="rounded-2xl p-5 mb-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white shadow">
        <motion.h1 initial={{opacity:0, y:-8}} animate={{opacity:1, y:0}} className="text-2xl md:text-3xl font-bold tracking-tight">
          Ubon Computer SpecCom V.1 — จัดสเปค/จัดการสินค้า (Excel ได้)
        </motion.h1>
        <div className="text-slate-300 text-sm mt-1">เพิ่ม Option เสริม (Monitor, Software) ได้หลายรายการ</div>
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
          <BasePicker inventory={inventory} selection={build.base} onSelect={selectBase} sortMode={sortMode} />
          <AddonsPicker inventory={inventory} addons={build.addons} addAddon={addAddon} updateQty={updateAddonQty} removeAddon={removeAddon} sortMode={sortMode} />
          {/* Sticky total */}
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between py-4">
              <div className="text-sm text-muted-foreground">สรุปรวมปัจจุบัน</div>
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
                <ProductEditor onSave={saveProduct} />
                <div className="mt-4 border-t pt-4 space-y-2">
                  <div className="font-semibold flex items-center gap-2"><FileUp className="w-4 h-4"/> นำเข้า Excel / CSV</div>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) handleImport(f); }} />
                  <div className="text-xs text-muted-foreground">คอลัมน์ที่รองรับ: Category, Name, Price, Stock, Attributes ... (รองรับ Monitor/Software)</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="summary">
          <Summary build={build} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o)=>!o && setEditing(null)}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader><DialogTitle>แก้ไขสินค้า</DialogTitle></DialogHeader>
          {editing && <ProductEditor initial={editing} onSave={(p)=>{ saveProduct(p); setEditing(null); }} />}
          <DialogFooter><Button variant="secondary" onClick={()=>setEditing(null)}>ปิด</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-xs text-muted-foreground mt-6">* Client-side demo: เก็บข้อมูลในเบราว์เซอร์ของคุณ รองรับนำเข้า Excel/CSV</div>
    <Dialog open={searchOpen} onOpenChange={(o)=>setSearchOpen(o)}>
  <DialogContent className="sm:max-w-[720px]">
    <DialogHeader><DialogTitle>ค้นหาสินค้า</DialogTitle></DialogHeader>
    <div className="space-y-3">
      <Input
        autoFocus
        placeholder="พิมพ์คำค้น เช่น 'Ryzen', '27\"', 'Windows'"', 'Windows'"
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
                  <Button onClick={()=>{ setBuild(prev => ({ ...prev, addons: [...prev.addons, { id: Math.random().toString(36).slice(2,9), product: p, qty: 1 }] })); toast.success(`เพิ่ม ${p.name} (Option)`); setSearchOpen(false); }}>เพิ่มเป็น Option</Button>
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

    </div>
  );
}

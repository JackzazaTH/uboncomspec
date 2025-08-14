import React, { useState } from 'react'
export const Tabs = ({ defaultValue, children, className='' }:{ defaultValue:string, children?:any, className?:string }) => {
  const [val, setVal] = useState(defaultValue)
  return <div className={className}>
    {React.Children.map(children, (c:any)=>React.cloneElement(c, { val, setVal }))}
  </div>
}
export const TabsList = ({ children, val, setVal, className='' }:{ children?: any, val?:string, setVal?:(v:string)=>void, className?:string }) => (
  <div className={`inline-flex bg-slate-200 rounded-xl p-1 ${className}`}>{React.Children.map(children, (c:any)=>React.cloneElement(c, { val, setVal }))}</div>
)
export const TabsTrigger = ({ value, children, val, setVal, className='' }:{ value:string, children?:React.ReactNode, val?:string, setVal?:(v:string)=>void, className?:string }) => (
  <button onClick={()=>setVal?.(value)} className={`px-3 py-1 rounded-lg ${val===value?'bg-white shadow':''} ${className}`}>{children}</button>
)
export const TabsContent = ({ value, children, val, className='' }:{ value:string, children?:React.ReactNode, val?:string, className?:string }) => val===value ? <div className={className}>{children}</div> : null

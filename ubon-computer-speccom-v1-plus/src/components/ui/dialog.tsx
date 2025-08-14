import React from 'react'
export const Dialog = ({ open, onOpenChange, children }:{ open:boolean, onOpenChange?:(o:boolean)=>void, children?:React.ReactNode }) => open ? <div>{children}</div> : null
export const DialogTrigger = ({ children }:{children?:React.ReactNode}) => <>{children}</>
export const DialogContent = ({ children, className='' }:{children?:React.ReactNode, className?:string}) => (
  <>
    <div className="modal-backdrop" />
    <div className={`modal ${className}`}>{children}</div>
  </>
)
export const DialogHeader = ({ children }:{children?:React.ReactNode}) => <div className="px-1 pt-1">{children}</div>
export const DialogTitle = ({ children }:{children?:React.ReactNode}) => <div className="text-lg font-semibold">{children}</div>
export const DialogFooter = ({ children }:{children?:React.ReactNode}) => <div className="px-1 pb-1 pt-2 flex justify-end gap-2">{children}</div>

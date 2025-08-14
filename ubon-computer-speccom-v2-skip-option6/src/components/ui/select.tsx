import React, { useEffect, useRef, useState } from 'react'

type SelectProps = {
  value?: string
  onValueChange?: (v: string) => void
  children?: React.ReactNode
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Find placeholder from <SelectValue placeholder="..."/>
  const findPlaceholder = (nodes: React.ReactNode): string | null => {
    let ph: string | null = null
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return
      const props: any = child.props
      if (child.type === SelectValue && typeof props?.placeholder === 'string') {
        ph = props.placeholder
      } else if (props?.children) {
        const inner = findPlaceholder(props.children)
        if (inner) ph = inner
      }
    })
    return ph
  }

  // Find selected label from any nested <SelectItem value="...">children</SelectItem>
  const findLabel = (nodes: React.ReactNode): React.ReactNode => {
    let label: React.ReactNode = null
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return
      const props: any = child.props
      if (child.type === SelectItem && props.value === value) {
        label = props.children
      } else if (props?.children) {
        const inner = findLabel(props.children)
        if (inner) label = inner
      }
    })
    return label
  }

  const placeholder = findPlaceholder(children)
  const display = findLabel(children) || placeholder || 'เลือก'

  // Render only the content from <SelectContent> and inject onSelect into <SelectItem>
  const renderDropdown = (nodes: React.ReactNode): React.ReactNode => {
    return React.Children.map(nodes, (child) => {
      if (!React.isValidElement(child)) return null
      const props: any = child.props || {}

      if (child.type === SelectContent) {
        // keep non-SelectItem children (fallback text), and inject into SelectItem
        return <div>
          {React.Children.map(props.children, (inner) => {
            if (!React.isValidElement(inner)) return inner
            const iprops: any = inner.props || {}
            if (inner.type === SelectItem) {
              return React.cloneElement(inner, {
                onSelect: (v: string) => { onValueChange?.(v); setOpen(false) }
              } as any)
            }
            return inner
          })}
        </div>
      }

      // Skip SelectTrigger / others at dropdown level
      if (props?.children) return renderDropdown(props.children)
      return null
    })
  }

  return (
    <div className="relative w-full" ref={ref}>
      <button type="button" className="border rounded-xl px-3 py-2 w-full text-left" onClick={() => setOpen(o => !o)}>
        {display}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-xl max-h-56 overflow-auto shadow">
          {renderDropdown(children)}
        </div>
      )}
    </div>
  )
}

export const SelectTrigger: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className='', children }) => (
  <div className={className}>{children}</div>
)

export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => (
  <span className="text-slate-500">{placeholder}</span>
)

export const SelectContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => <div>{children}</div>

type SelectItemProps = {
  value: string
  onSelect?: (v: string) => void
  children?: React.ReactNode
}
export const SelectItem: React.FC<SelectItemProps> = ({ value, onSelect, children }) => (
  <div
    role="option"
    tabIndex={0}
    className="px-3 py-2 hover:bg-slate-100 cursor-pointer"
    onClick={() => onSelect?.(value)}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect?.(value) }}
  >
    {children}
  </div>
)

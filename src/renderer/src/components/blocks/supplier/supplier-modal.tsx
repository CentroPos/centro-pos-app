import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, User } from 'lucide-react'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'

type Supplier = {
  name: string
  supplier_id?: string
  supplier_name?: string
  mobile_no?: string
  email?: string
  tax_id?: string
}

type SupplierModalProps = {
  open: boolean
  onClose: () => void
  onSelect: (supplier: Supplier) => void
}

const SupplierModal: React.FC<SupplierModalProps> = ({ open, onClose, onSelect }) => {
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const normalizedSuppliers = useMemo(() => {
    return suppliers.map((s) => ({
      ...s,
      supplier_id: s.supplier_id || (s as any).name || s.name,
      supplier_name: s.supplier_name || (s as any).supplier_name || s.name
    }))
  }, [suppliers])

  const fetchSuppliers = async (term: string) => {
    setIsLoading(true)
    try {
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.supplier.supplier_list',
        method: 'GET',
        params: {
          search_term: term || '',
          limit_start: 0,
          limit_page_length: 20
        }
      })

      const data = res?.data?.data
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
      setSuppliers(list as Supplier[])
      setSelectedIndex(list.length > 0 ? 0 : -1)
    } catch (e: any) {
      console.error('❌ Failed to fetch suppliers', e)
      toast.error(e?.message || 'Failed to fetch suppliers')
      setSuppliers([])
      setSelectedIndex(-1)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setSearch('')
    setSuppliers([])
    setSelectedIndex(-1)
    setTimeout(() => searchInputRef.current?.focus(), 0)
    void fetchSuppliers('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      void fetchSuppliers(search.trim())
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, open])

  const handlePick = (supplier: Supplier) => {
    onSelect(supplier)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}>
      <DialogContent
        className="max-w-4xl max-h-[75vh] bg-white m-4 flex flex-col"
        onKeyDown={(e) => {
          // Keep arrow keys in modal; allow cursor movement in input
          const target = e.target as HTMLElement
          const isInputField =
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            !!target.closest('input') ||
            !!target.closest('textarea')

          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !isInputField) {
            e.stopPropagation()
          }
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Select Supplier
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="relative mb-4 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier..."
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSelectedIndex((prev) => Math.min(prev + 1, normalizedSuppliers.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSelectedIndex((prev) => Math.max(prev - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  const s = normalizedSuppliers[selectedIndex]
                  if (s) handlePick(s)
                }
                // ArrowLeft/ArrowRight intentionally not prevented: cursor movement
              }}
            />
          </div>

          <div
            ref={listRef}
            className="flex-1 min-h-0 overflow-auto border rounded-md bg-white"
            tabIndex={-1}
          >
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading...</div>
            ) : normalizedSuppliers.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No suppliers found</div>
            ) : (
              <div className="divide-y">
                {normalizedSuppliers.map((s, idx) => (
                  <button
                    key={`${s.supplier_id}-${idx}`}
                    type="button"
                    onClick={() => handlePick(s)}
                    className={[
                      'w-full text-left px-4 py-3 hover:bg-muted transition-colors',
                      idx === selectedIndex ? 'bg-muted' : ''
                    ].join(' ')}
                  >
                    <div className="text-sm font-medium text-gray-900">{s.supplier_name}</div>
                    <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                      <span>{s.supplier_id}</span>
                      {s.mobile_no ? <span>{s.mobile_no}</span> : null}
                      {s.tax_id ? <span>{s.tax_id}</span> : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>,
    document.body
  )
}

export default SupplierModal



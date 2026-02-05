import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Plus, Search, User } from 'lucide-react'
import { toast } from 'sonner'
import { handleServerErrorMessages } from '@renderer/lib/error-handler'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'

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
  const [view, setView] = useState<'search' | 'create'>('search')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Create form state (mirror customer modal / create_supplier API)
  const [newSupplier, setNewSupplier] = useState({
    supplier_name: '',
    supplier_name_arabic: '',
    email: '',
    mobile_no: '',
    tax_id: '',
    address_line1: '',
    address_line2: '',
    city: '',
    country: '',
    pincode: ''
  })
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)

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
    setView('search')
    setSearch('')
    setSuppliers([])
    setSelectedIndex(-1)
    setTimeout(() => searchInputRef.current?.focus(), 0)
    void fetchSuppliers('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || view !== 'search') return
    const t = setTimeout(() => {
      void fetchSuppliers(search.trim())
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, open, view])

  const handlePick = (supplier: Supplier) => {
    onSelect(supplier)
    onClose()
  }

  const handleCreateSupplier = async () => {
    if (isCreatingSupplier) return
    if (!newSupplier.supplier_name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    setIsCreatingSupplier(true)
    try {
      const mobile = newSupplier.mobile_no?.trim() || ''
      const payload = {
        supplier_name: newSupplier.supplier_name || '',
        supplier_name_arabic: newSupplier.supplier_name_arabic || '',
        email: newSupplier.email || '',
        mobile: mobile,
        mobile_no: mobile,
        tax_id: newSupplier.tax_id || '',
        address_line1: newSupplier.address_line1 || '',
        address_line2: newSupplier.address_line2 || '',
        city: newSupplier.city || '',
        country: newSupplier.country || '',
        pincode: newSupplier.pincode || ''
      }
      const response = await window.electronAPI?.proxy?.request({
        method: 'POST',
        url: '/api/method/centro_pos_apis.api.supplier.create_supplier',
        data: payload
      })
      if (response?.status === 200 || response?.success === true) {
        toast.success('Supplier created successfully')
        const newId = response?.data?.name ?? response?.data?.data?.name ?? newSupplier.supplier_name
        const newSupplierForSelect: Supplier = {
          name: newSupplier.supplier_name,
          supplier_id: newId,
          supplier_name: newSupplier.supplier_name,
          mobile_no: newSupplier.mobile_no || undefined,
          email: newSupplier.email || undefined,
          tax_id: newSupplier.tax_id || undefined
        }
        await fetchSuppliers('')
        onSelect(newSupplierForSelect)
        onClose()
      } else {
        handleServerErrorMessages(response?.data?._server_messages, '')
      }
    } catch (err: any) {
      console.error('Create supplier error:', err)
      toast.error(err?.message || 'Failed to create supplier')
    } finally {
      setIsCreatingSupplier(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? undefined : onClose())}>
      <DialogContent
        className="max-w-5xl max-h-[75vh] bg-white m-4 flex flex-col"
        onKeyDown={(e) => {
          const target = e.target as HTMLElement
          const isInputField =
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.closest('input') ||
            target.closest('textarea')
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !isInputField) {
            e.stopPropagation()
          }
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {view === 'search' ? 'Select Supplier' : 'Create New Supplier'}
            </DialogTitle>
          </div>
        </DialogHeader>

        {view === 'search' ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="relative mb-4 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search suppliers..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelectedIndex(-1)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    e.stopPropagation()
                    if (normalizedSuppliers.length > 0) {
                      setSelectedIndex((prev) => Math.min(prev + 1, normalizedSuppliers.length - 1))
                    }
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedIndex((prev) => Math.max(prev - 1, 0))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    const s = normalizedSuppliers[selectedIndex]
                    if (s) handlePick(s)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    onClose()
                  }
                }}
                className="pl-10 pr-28 file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
                autoFocus
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setView('create')} className="h-7">
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
            </div>

            <div
              ref={listRef}
              className="flex-1 overflow-y-auto min-h-0"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  e.stopPropagation()
                  if (normalizedSuppliers.length > 0) {
                    setSelectedIndex((prev) => Math.min(prev + 1, normalizedSuppliers.length - 1))
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedIndex((prev) => Math.max(prev - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  const s = normalizedSuppliers[selectedIndex]
                  if (s) handlePick(s)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  onClose()
                }
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading suppliers...</span>
                </div>
              ) : normalizedSuppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  <div>No suppliers found</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {normalizedSuppliers.map((s, idx) => (
                    <div
                      key={`${s.supplier_id}-${idx}`}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${selectedIndex === idx
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                        }`}
                      onClick={() => {
                        setSelectedIndex(idx)
                        handlePick(s)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm leading-tight">{s.supplier_name}</h4>
                          <p
                            className={`text-xs mt-1 ${selectedIndex === idx
                              ? 'text-primary-foreground/80'
                              : 'text-muted-foreground'
                              }`}
                          >
                            <span>Tax ID: {s.tax_id || 'Not Available'}</span>
                            <span className="mx-1">•</span>
                            <span>Mobile: {s.mobile_no || 'Not Available'}</span>
                          </p>
                        </div>
                        <Badge variant={selectedIndex === idx ? 'secondary' : 'outline'}>
                          Supplier
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 flex-shrink-0">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setView('search')} disabled={isCreatingSupplier}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
            <div className="space-y-3 p-2 flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Supplier Name *</label>
                  <Input
                    value={newSupplier.supplier_name}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, supplier_name: e.target.value }))}
                    placeholder="Enter supplier name"
                    disabled={isCreatingSupplier}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Name in Arabic</label>
                  <Input
                    value={newSupplier.supplier_name_arabic}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, supplier_name_arabic: e.target.value }))}
                    placeholder="اكتب الاسم بالعربية"
                    disabled={isCreatingSupplier}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    disabled={isCreatingSupplier}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Mobile</label>
                  <Input
                    value={newSupplier.mobile_no}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, mobile_no: e.target.value }))}
                    placeholder="+966509876543"
                    disabled={isCreatingSupplier}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Tax ID</label>
                  <Input
                    value={newSupplier.tax_id}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, tax_id: e.target.value }))}
                    placeholder="310123456700003"
                    disabled={isCreatingSupplier}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Country</label>
                  <Input
                    value={newSupplier.country}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, country: e.target.value }))}
                    placeholder="Saudi Arabia"
                    disabled={isCreatingSupplier}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Address Line 1</label>
                  <Input
                    value={newSupplier.address_line1}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, address_line1: e.target.value }))}
                    placeholder="Street address"
                    disabled={isCreatingSupplier}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Address Line 2</label>
                  <Input
                    value={newSupplier.address_line2}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, address_line2: e.target.value }))}
                    placeholder="Building, floor"
                    disabled={isCreatingSupplier}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">City</label>
                  <Input
                    value={newSupplier.city}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, city: e.target.value }))}
                    placeholder="Riyadh"
                    disabled={isCreatingSupplier}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Pincode</label>
                  <Input
                    value={newSupplier.pincode}
                    onChange={(e) => setNewSupplier((p) => ({ ...p, pincode: e.target.value }))}
                    placeholder="11564"
                    disabled={isCreatingSupplier}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4 flex-shrink-0 border-t pt-4">
              <Button variant="outline" onClick={() => setView('search')} disabled={isCreatingSupplier}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateSupplier}
                disabled={isCreatingSupplier || !newSupplier.supplier_name.trim()}
              >
                {isCreatingSupplier ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Creating supplier...
                  </span>
                ) : (
                  'Create Supplier'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default SupplierModal



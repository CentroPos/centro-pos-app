import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { Input } from '@renderer/components/ui/input'
import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { Label } from '@renderer/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'

type UnbilledReceipt = {
  name: string
  supplier: string
  posting_date: string
  grand_total: number
  per_billed: number
  status: string
  currency: string
  custom_reference_number?: string
}

type ReceiptItem = {
  item_code: string
  item_name: string
  qty: number
  uom: string
  stock_uom?: string
  rate: number
  amount: number
  warehouse?: string
  pr_item_id: string
  description?: string
  conversion_factor?: number
}

type ReceiptDetails = {
  purchase_receipt_id: string
  supplier: string
  posting_date: string
  company?: string
  currency: string
  buying_price_list?: string
  items: ReceiptItem[]
}

const getCurrentDate = () => {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

interface PurchaseReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  onAdded?: () => void
}

const PurchaseReceiptModal: React.FC<PurchaseReceiptModalProps> = ({
  isOpen,
  onClose,
  onAdded
}) => {
  const {
    activeTabId,
    getCurrentTab,
    addItemsToTab,
    updateTabSupplier,
    updateTabPostingDate,
    setTabEdited
  } = usePurchaseTabStore()

  const { profile } = usePOSProfileStore()
  const currencySymbol = profile?.custom_currency_symbol || profile?.currency_symbol || profile?.currency || 'SAR'

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState(getCurrentDate())
  const [searchKey, setSearchKey] = useState('')
  const [receipts, setReceipts] = useState<UnbilledReceipt[]>([])
  const [loading, setLoading] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [detailsMap, setDetailsMap] = useState<Record<string, ReceiptDetails>>({})
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<string>('')
  const [supplierError, setSupplierError] = useState(false)
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const supplierTriggerRef = useRef<HTMLButtonElement>(null)
  const currentTab = getCurrentTab()

  const fetchSuppliers = useCallback(async () => {
    setSuppliersLoading(true)
    try {
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.supplier.supplier_list',
        method: 'GET',
        params: {
          search_term: '',
          limit_start: 0,
          limit_page_length: 500
        }
      })

      const body = res?.data
      let list: any[] = []

      if (Array.isArray(body?.data)) list = body.data
      else if (Array.isArray(body?.data?.data)) list = body.data.data
      else if (Array.isArray(body?.message)) list = body.message
      else if (Array.isArray(body)) list = body
      else if (body?.data && Array.isArray(body.data)) list = body.data

      setSuppliers(list)

      // Auto-select based on tab's supplier
      const tab = getCurrentTab()
      if (tab?.supplier?.supplier_id && list.length > 0) {
        const id = tab.supplier.supplier_id
        // Look for the ID in various possible fields
        const exists = list.some((s: any) =>
          (s.name === id) ||
          (s.supplier_id === id) ||
          (s.id === id)
        )
        if (exists) setSelectedSupplier(id)
      }
    } catch (e) {
      console.error('Failed to fetch suppliers', e)
      toast.error('Could not load supplier list')
    } finally {
      setSuppliersLoading(false)
    }
  }, [getCurrentTab])

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers()
    }
  }, [isOpen])

  const normalizedSuppliers = useMemo(() => {
    return suppliers.map((s) => ({
      ...s,
      id: s.supplier_id || (s as any).name || s.name || '',
      displayName: s.supplier_name || (s as any).supplier_name || s.name || ''
    })).filter(s => s.id)
  }, [suppliers])

  // Sync selected supplier with tab if not set
  useEffect(() => {
    if (currentTab?.supplier?.supplier_id && !selectedSupplier && normalizedSuppliers.length > 0) {
      const exists = normalizedSuppliers.some(s => s.id === (currentTab.supplier && currentTab.supplier.supplier_id))
      if (exists) {
        setSelectedSupplier(currentTab.supplier.supplier_id)
      }
    }
  }, [currentTab, selectedSupplier, normalizedSuppliers])

  const totalSelectedAmount = useMemo(() => {
    return selectedNames.reduce((sum, name) => {
      const receipt = receipts.find(r => r.name === name)
      return sum + (receipt?.grand_total || 0)
    }, 0)
  }, [selectedNames, receipts])

  // Combined local search + API results for snappy UX
  const filteredReceipts = useMemo(() => {
    if (!searchKey.trim()) return receipts
    const key = searchKey.toLowerCase().trim()
    return receipts.filter(r =>
      String(r.name).toLowerCase().includes(key) ||
      String(r.custom_reference_number || '').toLowerCase().includes(key)
    )
  }, [receipts, searchKey])

  const allSelectedItems = useMemo(() => {
    return selectedNames.flatMap(name => detailsMap[name]?.items || [])
  }, [selectedNames, detailsMap])

  const fetchReceipts = useCallback(async () => {
    if (!selectedSupplier) {
      setSupplierError(true)
      toast.error('Please select a supplier first')
      setTimeout(() => {
        supplierTriggerRef.current?.focus()
      }, 0)
      return
    }
    setSupplierError(false)
    setLoading(true)
    setDetailsMap({})
    setSelectedNames([])
    try {
      const params: Record<string, string> = {
        supplier: selectedSupplier
      }
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      if (searchKey) params.search_key = searchKey
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.purchase.get_unbilled_purchase_receipts',
        method: 'GET',
        params
      })
      const data = res?.data?.data ?? res?.data
      const list = (Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : [])) as UnbilledReceipt[]
      setReceipts(list)
      setSelectedNames(list.map(r => r.name))

      // If no fromDate was set, find the oldest receipt and set it as the default
      if (!fromDate && list.length > 0) {
        const dates = list.map(r => r.posting_date).filter(Boolean).sort()
        if (dates.length > 0) {
          setFromDate(dates[0]) // Oldest date
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch unbilled receipts', e)
      toast.error(e?.message || 'Failed to load receipts')
      setReceipts([])
    } finally {
      setLoading(false)
    }
  }, [selectedSupplier, fromDate, toDate])

  const handleAddToOrder = async () => {
    if (!activeTabId || selectedNames.length === 0 || !getCurrentTab()) {
      toast.error('No active tab or receipts selected')
      return
    }
    setAdding(true)
    let totalItemsAdded = 0
    try {
      const tab = getCurrentTab()!
      const allDetails = selectedNames.map(name => detailsMap[name]).filter(Boolean)

      const allItemsToAdd: any[] = []

      for (const details of allDetails) {
        if (!details) continue

        // Update supplier if not set
        if (!tab.supplier?.name && details.supplier) {
          updateTabSupplier(activeTabId, {
            name: details.supplier,
            supplier_id: details.supplier
          })
        }
        // Update posting date if not set
        if (details.posting_date && !tab.posting_date) {
          updateTabPostingDate(activeTabId, details.posting_date)
        }

        for (const it of details.items) {
          allItemsToAdd.push({
            item_code: it.item_code,
            item_name: it.item_name,
            quantity: Number(it.qty || 0),
            uom: it.uom || it.stock_uom || 'Nos',
            standard_rate: Number(it.rate || 0),
            discount_percentage: 0,
            pr_item_id: it.pr_item_id || '',
            fromReceipt: true
          })
          totalItemsAdded++
        }
      }

      if (allItemsToAdd.length > 0) {
        addItemsToTab(activeTabId, allItemsToAdd)
      }

      setTabEdited(activeTabId, true)
      toast.success(`Added ${totalItemsAdded} item(s) from ${selectedNames.length} receipt(s)`)
      onAdded?.()
      onClose()
      setDetailsMap({})
      setSelectedNames([])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add items')
    } finally {
      setAdding(false)
    }
  }

  useHotkeys('ctrl+f, command+f', (e) => {
    if (isOpen && !loading) {
      e.preventDefault()
      fetchReceipts()
    }
  }, {
    enableOnFormTags: true,
    enabled: isOpen && !loading
  }, [isOpen, loading, selectedSupplier, fetchReceipts])

  useHotkeys('enter, ctrl+enter, command+enter', (e) => {
    if (isOpen && !adding && selectedNames.length > 0) {
      // Don't trigger if we are typing in the search bar (let search handle its own enter if needed)
      // or if a select is open. Actually, standard POS behavior is confirming with Enter.
      e.preventDefault()
      handleAddToOrder()
    }
  }, {
    enableOnFormTags: true,
    enabled: isOpen && !adding && selectedNames.length > 0
  }, [isOpen, adding, selectedNames, handleAddToOrder])

  // Auto-refetch when filters change
  useEffect(() => {
    if (isOpen && selectedSupplier) {
      void fetchReceipts()
    }
  }, [selectedSupplier, fromDate, toDate, searchKey, isOpen, fetchReceipts])

  const fetchMultipleDetails = useCallback(async (names: string[]) => {
    const missingNames = names.filter(name => !detailsMap[name])
    if (missingNames.length === 0) return

    setDetailsLoading(true)
    try {
      const promises = missingNames.map(async (name) => {
        try {
          const res = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.purchase.get_purchase_receipt_details',
            method: 'GET',
            params: { purchase_receipt_id: name }
          })
          const raw = res?.data?.data ?? res?.data
          const details = (raw?.purchase_receipt_id ? raw : (raw?.data ?? raw)) as ReceiptDetails
          return { name, details }
        } catch (err) {
          console.error(`Failed to fetch details for ${name}`, err)
          return { name, details: null }
        }
      })

      const results = await Promise.all(promises)
      setDetailsMap(prev => {
        const next = { ...prev }
        results.forEach(({ name, details }) => {
          if (details) next[name] = details
        })
        return next
      })
    } finally {
      setDetailsLoading(false)
    }
  }, [detailsMap])

  useEffect(() => {
    if (selectedNames.length > 0) {
      fetchMultipleDetails(selectedNames)
    }
  }, [selectedNames, fetchMultipleDetails])

  const handleToggleSelect = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const handleToggleAll = () => {
    if (selectedNames.length === receipts.length && receipts.length > 0) {
      setSelectedNames([])
    } else {
      setSelectedNames(receipts.map((r) => r.name))
    }
  }

  const handlePreviewReceipt = (r: UnbilledReceipt) => {
    if (!selectedNames.includes(r.name)) {
      handleToggleSelect(r.name)
    }
  }



  const handleClose = () => {
    setReceipts([])
    setSelectedNames([])
    setDetailsMap({})
    setFromDate('')
    setToDate(getCurrentDate())
    setSearchKey('')
    setSelectedSupplier('')
    setSupplierError(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[92vh] flex flex-col min-h-[650px] bg-white border-2 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800">Add from Purchase Receipt</DialogTitle>
          <div className="mt-4 flex items-end gap-3 w-full">
            <div className="w-80 shrink-0">
              <Label className={`text-xs font-semibold mb-1.5 block ${supplierError ? 'text-red-500' : 'text-gray-700'}`}>
                Select Supplier {supplierError && <span className="text-red-500 ml-1">(Required)</span>}
              </Label>
              <Select
                key={suppliersLoading ? 'loading' : 'idle'}
                value={selectedSupplier}
                onValueChange={(val) => {
                  setSelectedSupplier(val)
                  setSupplierError(false)
                  setReceipts([])
                  setSelectedNames([])
                  setDetailsMap({})
                }}
              >
                <SelectTrigger
                  ref={supplierTriggerRef}
                  className={`w-full bg-white transition-all ${supplierError ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'}`}
                >
                  <SelectValue placeholder={suppliersLoading ? 'Loading list...' : 'Select a supplier'} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {suppliersLoading && (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      <span className="animate-spin inline-block mr-2">⏳</span>
                      Loading suppliers...
                    </div>
                  )}
                  {!suppliersLoading && normalizedSuppliers.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No suppliers found. Click to retry.
                      <Button variant="ghost" size="sm" onClick={fetchSuppliers} className="mt-2 h-7 text-[10px]">
                        Refresh
                      </Button>
                    </div>
                  )}
                  {normalizedSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs font-semibold mb-1.5 block text-gray-700">Ref Id Search</Label>
              <Input
                placeholder="Search Reference Id..."
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    void fetchReceipts()
                  }
                }}
                className="w-full bg-white"
              />
            </div>
          </div>
          {supplierError && (
            <p className="text-[10px] text-red-500 mt-1 font-medium animate-in fade-in slide-in-from-top-1">
              Fetching unbilled receipts requires a selected supplier.
            </p>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
          <div className="flex items-end gap-3 shrink-0 w-full">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground block mb-1">From date (optional)</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground block mb-1">To date (optional)</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full"
              />
            </div>
            <Button
              onClick={fetchReceipts}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 transition-all duration-300 hover:shadow-md"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
                  Loading...
                </>
              ) : (
                <>
                  Fetch receipts
                  <span className="text-[9px] opacity-80 bg-white/20 px-1 py-0 rounded ml-0.5 border border-white/30 font-medium">
                    Ctrl+F
                  </span>
                </>
              )}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-col min-h-0 overflow-hidden">
              <h4 className="text-sm font-semibold mb-2 shrink-0 flex justify-between items-center">
                <span>Unbilled receipts ({selectedNames.length} selected)</span>
                {selectedNames.length > 0 && (
                  <span className="text-emerald-600 font-bold">
                    Total Selected: {currencySymbol} {totalSelectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </h4>
              <div className="border rounded-md h-[450px] overflow-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                <Table className="min-w-max w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={receipts.length > 0 && selectedNames.length === receipts.length}
                          onCheckedChange={handleToggleAll}
                        />
                      </TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Name</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Ref Id</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-xs text-right whitespace-nowrap">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceipts.map((r) => (
                      <TableRow
                        key={r.name}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 
                          ${selectedNames.includes(r.name) ? 'bg-primary/5' : ''}`}
                        onClick={() => handlePreviewReceipt(r)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedNames.includes(r.name)}
                            onCheckedChange={() => handleToggleSelect(r.name)}
                          />
                        </TableCell>
                        <TableCell className="text-xs font-medium whitespace-nowrap">{r.name}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{r.custom_reference_number || '-'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{r.posting_date}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">
                          {currencySymbol} {Number(r.grand_total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="flex flex-col min-h-0 overflow-hidden">
              <h4 className="text-sm font-semibold mb-2 shrink-0">Items in selected receipts</h4>
              {detailsLoading && allSelectedItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground min-h-[200px]">
                  Loading items...
                </div>
              ) : allSelectedItems.length > 0 ? (
                <>
                  <div className="text-xs text-muted-foreground mb-2 shrink-0 truncate">
                    Showing {allSelectedItems.length} items from {selectedNames.length} receipts
                  </div>
                  <div className="border rounded-md h-[450px] overflow-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                    <Table className="min-w-max w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs whitespace-nowrap">Item</TableHead>
                          <TableHead className="text-xs text-right whitespace-nowrap">Qty</TableHead>
                          <TableHead className="text-xs whitespace-nowrap">UOM</TableHead>
                          <TableHead className="text-xs text-right whitespace-nowrap">Rate</TableHead>
                          <TableHead className="text-xs text-right whitespace-nowrap">Amount</TableHead>
                          <TableHead className="text-xs whitespace-nowrap">From</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedNames.map(name => {
                          const details = detailsMap[name]
                          if (!details) return null
                          return details.items.map((it, idx) => (
                            <TableRow key={`${name}-${it.pr_item_id || idx}`}>
                              <TableCell className="text-xs whitespace-nowrap min-w-[180px]">
                                {it.item_name} ({it.item_code})
                              </TableCell>
                              <TableCell className="text-xs text-right whitespace-nowrap">{it.qty}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{it.uom}</TableCell>
                              <TableCell className="text-xs text-right whitespace-nowrap">{it.rate}</TableCell>
                              <TableCell className="text-xs text-right whitespace-nowrap">{it.amount}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap text-muted-foreground italic">
                                {name.slice(-7)}
                              </TableCell>
                            </TableRow>
                          ))
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-2 shrink-0">
                    <Button
                      onClick={handleAddToOrder}
                      disabled={adding || selectedNames.length === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 w-full"
                    >
                      {adding ? 'Adding...' : (
                        <div className="flex items-center justify-center gap-2">
                          <span>Add all {allSelectedItems.length} items to order</span>
                          <span className="text-[10px] opacity-80 bg-white/20 px-1 py-0.5 rounded border border-white/30 font-bold">
                            Enter
                          </span>
                        </div>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground min-h-[200px]">
                  {loading ? 'Fetching receipts...' : 'Select receipts to see all items'}
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PurchaseReceiptModal

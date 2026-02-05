import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'
import { toast } from 'sonner'
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
    addItemToTab,
    updateTabSupplier,
    updateTabPostingDate,
    setTabEdited
  } = usePurchaseTabStore()

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [receipts, setReceipts] = useState<UnbilledReceipt[]>([])
  const [loading, setLoading] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<UnbilledReceipt | null>(null)
  const [receiptDetails, setReceiptDetails] = useState<ReceiptDetails | null>(null)
  const [adding, setAdding] = useState(false)

  const fetchReceipts = async () => {
    setLoading(true)
    setReceiptDetails(null)
    setSelectedReceipt(null)
    try {
      const params: Record<string, string> = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.purchase.get_unbilled_purchase_receipts',
        method: 'GET',
        params
      })
      const data = res?.data?.data ?? res?.data
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : [])
      setReceipts(list)
      if (list.length === 0) toast.info('No unbilled purchase receipts found')
    } catch (e: any) {
      console.error('Failed to fetch unbilled receipts', e)
      toast.error(e?.message || 'Failed to load receipts')
      setReceipts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchReceiptDetails = async (receiptName: string) => {
    setDetailsLoading(true)
    try {
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.purchase.get_purchase_receipt_details',
        method: 'GET',
        params: { purchase_receipt_id: receiptName }
      })
      const raw = res?.data?.data ?? res?.data
      const details: ReceiptDetails = raw?.purchase_receipt_id
        ? raw
        : raw?.data ?? raw
      setReceiptDetails(details)
    } catch (e: any) {
      console.error('Failed to fetch receipt details', e)
      toast.error(e?.message || 'Failed to load receipt details')
      setReceiptDetails(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleSelectReceipt = (r: UnbilledReceipt) => {
    // Toggle: click same receipt again to deselect
    if (selectedReceipt?.name === r.name) {
      setSelectedReceipt(null)
      setReceiptDetails(null)
      return
    }
    setSelectedReceipt(r)
    fetchReceiptDetails(r.name)
  }

  const handleAddToOrder = async () => {
    if (!activeTabId || !receiptDetails || !getCurrentTab()) {
      toast.error('No active tab or receipt selected')
      return
    }
    setAdding(true)
    try {
      const tab = getCurrentTab()!
      if (!tab.supplier?.name && receiptDetails.supplier) {
        updateTabSupplier(activeTabId, {
          name: receiptDetails.supplier,
          supplier_id: receiptDetails.supplier
        })
      }
      if (receiptDetails.posting_date) {
        updateTabPostingDate(activeTabId, receiptDetails.posting_date)
      }
      for (const it of receiptDetails.items) {
        addItemToTab(activeTabId, {
          item_code: it.item_code,
          item_name: it.item_name,
          quantity: Number(it.qty || 0),
          uom: it.uom || it.stock_uom || 'Nos',
          standard_rate: Number(it.rate || 0),
          discount_percentage: 0,
          pr_item_id: it.pr_item_id || '',
          fromReceipt: true
        })
      }
      setTabEdited(activeTabId, true)
      toast.success(`Added ${receiptDetails.items.length} item(s) from receipt`)
      onAdded?.()
      onClose()
      setReceiptDetails(null)
      setSelectedReceipt(null)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add items')
    } finally {
      setAdding(false)
    }
  }

  const handleClose = () => {
    setReceipts([])
    setSelectedReceipt(null)
    setReceiptDetails(null)
    setFromDate('')
    setToDate('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col min-h-[560px]">
        <DialogHeader>
          <DialogTitle>Add from Purchase Receipt</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-wrap items-end gap-3 shrink-0">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">From date (optional)</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">To date (optional)</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={fetchReceipts} disabled={loading}>
              {loading ? 'Loading...' : 'Fetch receipts'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-col min-h-0 overflow-hidden">
              <h4 className="text-sm font-semibold mb-2 shrink-0">Unbilled receipts (click to select, click again to deselect)</h4>
              <div className="border rounded-md h-[320px] overflow-auto">
                <Table className="min-w-max w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs whitespace-nowrap">Name</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Supplier</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-xs text-right whitespace-nowrap">Total</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((r) => (
                      <TableRow
                        key={r.name}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedReceipt?.name === r.name ? 'bg-primary/20 ring-1 ring-primary/40' : ''}`}
                        onClick={() => handleSelectReceipt(r)}
                      >
                        <TableCell className="text-xs font-medium whitespace-nowrap">{r.name}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{r.supplier}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{r.posting_date}</TableCell>
                        <TableCell className="text-xs text-right whitespace-nowrap">
                          {r.currency} {Number(r.grand_total ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{r.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="flex flex-col min-h-0 overflow-hidden">
              <h4 className="text-sm font-semibold mb-2 shrink-0">Receipt details</h4>
              {detailsLoading ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground min-h-[200px]">
                  Loading...
                </div>
              ) : receiptDetails ? (
                <>
                  <div className="text-xs text-muted-foreground mb-2 shrink-0 truncate" title={`${receiptDetails.purchase_receipt_id} · ${receiptDetails.supplier} · ${receiptDetails.posting_date}`}>
                    {receiptDetails.purchase_receipt_id} · {receiptDetails.supplier} · {receiptDetails.posting_date}
                  </div>
                  <div className="border rounded-md h-[320px] overflow-auto">
                    <Table className="min-w-max w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs whitespace-nowrap">Item</TableHead>
                          <TableHead className="text-xs text-right whitespace-nowrap">Qty</TableHead>
                          <TableHead className="text-xs whitespace-nowrap">UOM</TableHead>
                          <TableHead className="text-xs text-right whitespace-nowrap">Rate</TableHead>
                          <TableHead className="text-xs text-right whitespace-nowrap">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receiptDetails.items.map((it, idx) => (
                          <TableRow key={it.pr_item_id || idx}>
                            <TableCell className="text-xs whitespace-nowrap min-w-[180px]">
                              {it.item_name} ({it.item_code})
                            </TableCell>
                            <TableCell className="text-xs text-right whitespace-nowrap">{it.qty}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{it.uom}</TableCell>
                            <TableCell className="text-xs text-right whitespace-nowrap">{it.rate}</TableCell>
                            <TableCell className="text-xs text-right whitespace-nowrap">{it.amount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-2 shrink-0">
                    <Button
                      onClick={handleAddToOrder}
                      disabled={adding || receiptDetails.items.length === 0}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {adding ? 'Adding...' : `Add ${receiptDetails.items.length} item(s) to order`}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground min-h-[200px]">
                  Select a receipt
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

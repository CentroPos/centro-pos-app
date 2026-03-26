import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { formatDate } from '@renderer/lib/date-utils'

interface ReturnInvoiceWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
}

export const ReturnInvoiceWizard: React.FC<ReturnInvoiceWizardProps> = ({
  open,
  onOpenChange,
  invoiceId
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoiceData, setInvoiceData] = useState<any>(null)

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoiceDetails()
    } else {
      setInvoiceData(null)
      setError(null)
    }
  }, [open, invoiceId])

  const fetchInvoiceDetails = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await window.electronAPI?.proxy?.request({
        url: `/api/resource/Sales Invoice/${invoiceId}`,
        method: 'GET'
      })

      if (response?.data?.data) {
        setInvoiceData(response.data.data)
      } else {
        throw new Error('Failed to fetch invoice details')
      }
    } catch (err: any) {
      console.error('Error fetching return invoice details:', err)
      setError(err?.message || 'Failed to load return invoice details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-slate-50/50">
          <DialogTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            Return Invoice Details
            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 flex items-center rounded-md border border-gray-200">
              {invoiceId}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6 bg-white min-h-[300px] flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-gray-500">Loading invoice details...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-red-500">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="font-semibold text-lg mb-2">{error}</p>
            </div>
          ) : invoiceData ? (
            <div className="flex flex-col h-full space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Customer</label>
                  <div className="font-medium text-gray-900">{invoiceData.customer_name || invoiceData.customer}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
                  <div className="font-medium text-gray-900">{invoiceData.posting_date ? formatDate(invoiceData.posting_date) : '-'}</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
                  <div className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    {invoiceData.status || 'Return'}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Total</label>
                  <div className="font-semibold text-gray-900">{invoiceData.currency} {Math.abs(invoiceData.grand_total || 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b grid grid-cols-12 gap-4 text-xs font-semibold text-gray-500">
                  <div className="col-span-1 border-r border-gray-200">#</div>
                  <div className="col-span-5 border-r border-gray-200">Item</div>
                  <div className="col-span-2 text-right border-r border-gray-200 pr-2">Qty</div>
                  <div className="col-span-2 text-right border-r border-gray-200 pr-2">Rate</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-0">
                    {invoiceData.items?.map((item: any, idx: number) => (
                      <div key={item.name || idx} className={`grid grid-cols-12 gap-4 px-4 py-3 text-sm border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-gray-100 transition-colors`}>
                        <div className="col-span-1 text-gray-500 flex items-center">{idx + 1}</div>
                        <div className="col-span-5 flex flex-col justify-center">
                          <div className="font-medium text-gray-900">{item.item_name}</div>
                          <div className="text-xs text-gray-500">{item.item_code}</div>
                        </div>
                        <div className="col-span-2 text-right font-medium text-slate-700 flex items-center justify-end">{Math.abs(item.qty || 0)} {item.uom}</div>
                        <div className="col-span-2 text-right text-gray-600 font-medium flex items-center justify-end">{Math.abs(item.rate || 0).toFixed(2)}</div>
                        <div className="col-span-2 text-right font-semibold text-gray-900 flex items-center justify-end">{Math.abs(item.amount || 0).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

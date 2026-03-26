import React, { useState, useMemo } from 'react'
import { Layers, CheckCircle2, Receipt } from 'lucide-react'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { ReturnInvoiceWizard } from './return-invoice-wizard'
import { formatDate } from '@renderer/lib/date-utils'

export const ReturnInvoiceStack: React.FC = () => {
  const { getCurrentTab } = usePOSTabStore()
  const currentTab = getCurrentTab()
  
  const [isOpen, setIsOpen] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  
  // Extract return invoices
  const linkedInvoices = currentTab?.orderData?.linked_invoices
  
  const returnInvoices = useMemo(() => {
    if (!linkedInvoices) return []
    
    // It can be an object or an array
    const invoicesArray = Array.isArray(linkedInvoices) ? linkedInvoices : [linkedInvoices]
    
    return invoicesArray.filter(
      (inv: any) => inv?.status && inv.status.toLowerCase() === 'return'
    )
  }, [linkedInvoices])
  
  if (!returnInvoices || returnInvoices.length === 0) {
    return null
  }
  
  const handleInvoiceClick = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId)
    setIsOpen(false)
  }
  
  return (
    <>
      {/* Absolute positioning relative to POSInterface main area */}
      <div className="absolute bottom-[160px] right-6 z-40 flex flex-col items-end">
        {/* Dropdown / Popover List */}
        {isOpen && (
          <div className="mb-2 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100/80 w-64 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
            <div className="bg-slate-50 border-b border-gray-100 px-4 py-3 text-sm font-semibold flex items-center justify-between text-slate-800">
              <span className="flex items-center gap-2 text-gray-700">
                <Receipt className="w-4 h-4 text-gray-500" />
                Return Invoices
              </span>
              <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {returnInvoices.length}
              </span>
            </div>
            
            <div className="max-h-60 overflow-y-auto outline-none scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent" role="menu">
              {returnInvoices.map((inv: any, idx: number) => (
                <button
                  key={inv.name || idx}
                  onClick={() => handleInvoiceClick(inv.name)}
                  className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-slate-50 transition-colors flex items-center gap-3 group"
                >
                  <div className="bg-slate-100 text-slate-400 p-1.5 rounded-md group-hover:bg-blue-100 group-hover:text-blue-500 shadow-sm transition-all duration-200">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700 group-hover:text-blue-700 transition-colors">
                      {inv.name}
                    </div>
                    {inv.posting_date && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatDate(inv.posting_date)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Floating Action Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`group flex items-center justify-center p-3.5 rounded-full shadow-lg transition-all duration-300 border-2 active:scale-95 ${
            isOpen 
              ? 'bg-slate-700 border-slate-600 shadow-slate-300/50 text-white' 
              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 shadow-slate-200/50 hover:shadow-slate-300'
          }`}
          title="View Return Invoices"
        >
          <div className="relative flex items-center justify-center">
            <Layers className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'scale-110' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
            <span className={`absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold shadow-sm ring-2 ring-white ${isOpen ? 'bg-slate-500 text-white border-transparent' : 'bg-slate-600 text-white'}`}>
              {returnInvoices.length}
            </span>
          </div>
        </button>
      </div>
      
      {/* Wizard Modal */}
      <ReturnInvoiceWizard
        open={!!selectedInvoiceId}
        onOpenChange={(open) => !open && setSelectedInvoiceId(null)}
        invoiceId={selectedInvoiceId || ''}
      />
    </>
  )
}

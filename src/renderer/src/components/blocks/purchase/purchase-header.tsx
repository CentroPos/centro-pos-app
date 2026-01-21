import React from 'react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'

type PurchaseHeaderProps = {
  onNewOrder?: () => void
}

const PurchaseHeader: React.FC<PurchaseHeaderProps> = ({ onNewOrder }) => {
  const { tabs, activeTabId, setActiveTab, closeTab, createNewTab } = usePurchaseTabStore()

  const [pendingCloseTabId, setPendingCloseTabId] = React.useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const confirmBtnRef = React.useRef<HTMLButtonElement>(null)
  const cancelBtnRef = React.useRef<HTMLButtonElement>(null)

  const openCloseConfirm = (tabId: string) => {
    setPendingCloseTabId(tabId)
    setConfirmOpen(true)
  }

  const handleAttemptClose = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    const isUnsaved = !!tab.isEdited || (Array.isArray(tab.items) && tab.items.length > 0 && !tab.purchaseOrderId)
    if (isUnsaved) {
      openCloseConfirm(tabId)
    } else {
      closeTab(tabId)
    }
  }

  const handleConfirmClose = () => {
    if (pendingCloseTabId) closeTab(pendingCloseTabId)
    setConfirmOpen(false)
    setPendingCloseTabId(null)
  }

  const handleCancelClose = () => {
    setConfirmOpen(false)
    setPendingCloseTabId(null)
  }

  React.useEffect(() => {
    if (confirmOpen) {
      setTimeout(() => confirmBtnRef.current?.focus(), 0)
    }
  }, [confirmOpen])

  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const active = document.activeElement
      if (active === confirmBtnRef.current) {
        cancelBtnRef.current?.focus()
      } else {
        confirmBtnRef.current?.focus()
      }
    } else if (e.key === 'Enter') {
      ;(document.activeElement as HTMLElement)?.click()
    }
  }

  const handleNewOrder = () => {
    const created = createNewTab()
    if (created) onNewOrder?.()
  }

  const abbreviateOrderId = (orderId: string) => {
    if (!orderId) return orderId
    const last5Digits = orderId.slice(-5)
    return `#${last5Digits}`
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            className="px-2 py-1.5 bg-gradient-to-r from-primary to-slate-700 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[10px]"
            onClick={handleNewOrder}
          >
            <i className="fas fa-plus text-xs"></i>
            New
            <span className="text-[9px] opacity-80 bg-white/10 px-1 py-0.5 rounded ml-0.5">Ctrl+N</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                className={[
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
                  isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-white border-gray-200 text-gray-700'
                ].join(' ')}
                onClick={() => setActiveTab(tab.id)}
                role="button"
                tabIndex={0}
              >
                <span className="text-[11px] font-medium">
                  {tab.purchaseOrderId ? abbreviateOrderId(tab.purchaseOrderId) : tab.displayName}
                </span>
                <button
                  type="button"
                  className="text-[12px] opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAttemptClose(tab.id)
                  }}
                  aria-label="Close tab"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={false} onKeyDown={handleDialogKeyDown}>
          <DialogHeader>
            <DialogTitle>Close order?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-700">
            This order has unsaved changes. Do you want to discard and close it?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelClose} ref={cancelBtnRef}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirmClose} ref={confirmBtnRef}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PurchaseHeader



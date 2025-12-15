import React from 'react'
import { Button } from '@renderer/components/ui/button'
import { usePOSTabStore } from '../../../store/usePOSTabStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'

type HeaderProps = {
  onNewOrder?: () => void
}

const Header: React.FC<HeaderProps> = ({ onNewOrder }) => {

  const { tabs, activeTabId, setActiveTab, closeTab, createNewTab } = usePOSTabStore()

  // Close-confirmation dialog state
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
    const isUnsaved = !!tab.isEdited || (Array.isArray(tab.items) && tab.items.length > 0 && !tab.orderId)
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

  // Default focus on Confirm; allow Left/Right to switch between buttons
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
      // trigger the focused button
      (document.activeElement as HTMLElement)?.click()
    }
  }

  const handleNewOrder = () => {
    const created = createNewTab()
    if (created) {
      onNewOrder?.()
    }
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey) return
      const key = e.key.toLowerCase()
      if (key === 'n') {
        e.preventDefault()
        handleNewOrder()
      } else if (key === 'x') {
        e.preventDefault()
        if (activeTabId) {
          handleAttemptClose(activeTabId)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeTabId, tabs])

  // Helper function to abbreviate order ID to last 5 digits
  const abbreviateOrderId = (orderId: string) => {
    if (!orderId) return orderId
    // Extract last 5 digits from order ID
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

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 text-xs border ${activeTabId === tab.id
                  ? 'bg-white text-gray-900 font-bold shadow-sm shadow-gray-300 border-primary'
                  : 'bg-white/60 text-gray-800 hover:bg-white/80 border-transparent'
                  }`}
                onClick={() => setActiveTab(tab.id)}
                aria-selected={activeTabId === tab.id}
                title={tab.orderId || (tab.type === 'new' ? 'New Order' : 'Order')}
              >
                <span className="flex items-center gap-2">
                  {activeTabId === tab.id && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300" />
                  )}
                  {tab.displayName || (tab.orderId ? abbreviateOrderId(tab.orderId) : tab.type === 'new' ? 'New' : 'Order')}
                </span>
                <button
                  className="ml-2 text-gray-400 hover:text-red-500 text-base leading-none"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAttemptClose(tab.id)
                  }}
                  title="Close tab"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>



      </div>
      {/* Confirm close dialog */}
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

export default Header

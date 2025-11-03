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
    <div className="p-3 glass-effect border-b border-white/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Button
            className="px-5 py-3 bg-gradient-to-r from-primary to-slate-700 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-300 flex items-center gap-3 "
            onClick={handleNewOrder}
          >
            <i className="fas fa-plus text-lg"></i>
            New Order{' '}
            <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg ml-2">Ctrl+N</span>
          </Button>

          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 ${
                  activeTabId === tab.id
                    ? 'bg-white text-gray-900 font-bold shadow-md shadow-gray-300'
                    : 'bg-white/60 text-gray-800 hover:bg-white/80'
                }`}
                onClick={() => setActiveTab(tab.id)}
                aria-selected={activeTabId === tab.id}
                title={tab.orderId || (tab.type === 'new' ? 'New Order' : 'Order')}
              >
                <span className="flex items-center gap-2">
                  {activeTabId === tab.id && (
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                  )}
                  {tab.displayName || (tab.orderId ? abbreviateOrderId(tab.orderId) : tab.type === 'new' ? 'New' : 'Order')}
                </span>
                <button
                  className="ml-2 text-gray-400 hover:text-red-500"
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

        

        <div className="ml-auto text-right bg-white/60 backdrop-blur rounded-xl p-4 shadow-lg">
          <div className="font-bold text-lg">{new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</div>
          <div className="text-sm text-gray-600">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

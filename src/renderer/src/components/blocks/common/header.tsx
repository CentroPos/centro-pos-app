import { Button } from '@renderer/components/ui/button'
import { usePOSTabStore } from '../../../store/usePOSTabStore'

type HeaderProps = {
  onNewOrder?: () => void
}

const Header: React.FC<HeaderProps> = ({ onNewOrder }) => {

  const { tabs, activeTabId, setActiveTab, closeTab, createNewTab } = usePOSTabStore()

  const handleNewOrder = () => {
    createNewTab()
    onNewOrder?.()
  }

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
            className="px-8 py-3 bg-gradient-to-r from-primary to-slate-700 text-white font-medium rounded-xl hover:shadow-lg transition-all duration-300 flex items-center gap-3 "
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
                    closeTab(tab.id)
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
    </div>
  )
}

export default Header

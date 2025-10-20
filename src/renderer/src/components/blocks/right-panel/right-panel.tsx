import React, { useEffect, useMemo, useState } from 'react'

// A right-side panel for the POS screen, adapted from pos.html
// Contains tabs for Product, Customer, Prints, Payments, Orders
// and renders the contextual info shown in the design mock.

type RightPanelProps = {
  selectedItemId?: string
  items: any[]
}

const RightPanel: React.FC<RightPanelProps> = ({ selectedItemId, items }) => {
  const [activeTab, setActiveTab] = useState<'product' | 'customer' | 'prints' | 'payments' | 'orders'>('product')
  const [subTab, setSubTab] = useState<'orders' | 'returns'>('orders')
  const [customerSubTab, setCustomerSubTab] = useState<'recent' | 'most'>('recent')
  const [ordersSubTab, setOrdersSubTab] = useState<'orders' | 'returns'>('orders')

  // Get the currently selected item
  const selectedItem = selectedItemId ? items.find(item => item.item_code === selectedItemId) : null
  const currentUom = (selectedItem && (selectedItem.uom || 'Nos')) || 'Nos'

  // Live warehouse stock fetched from backend (for current UOM)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [warehouseStock, setWarehouseStock] = useState<{ name: string; qty: number }[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadStock() {
      if (!selectedItem?.item_code) {
        setWarehouseStock([])
        return
      }
      try {
        setStockLoading(true)
        setStockError(null)
        console.log('🔍 Loading stock for:', selectedItem.item_code, 'UOM:', currentUom)
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
          params: {
            item_id: selectedItem.item_code,
            search_text: '',
            limit_start: 0,
            limit_page_length: 20
          }
        })
        console.log('📦 Stock API response:', res)
        console.log('📦 Response success:', res?.success)
        console.log('📦 Response status:', res?.status)
        console.log('📦 Response data:', res?.data)
        const list = Array.isArray(res?.data?.data) ? res.data.data : []
        const mapped = list.map((w: any) => {
          const q = Array.isArray(w.quantities) ? w.quantities : []
          const match = q.find((qq: any) => String(qq.uom).toLowerCase() === String(currentUom).toLowerCase())
          return { name: w.warehouse, qty: Number(match?.qty || 0) }
        })
        console.log('🗂️ Mapped warehouses:', mapped)
        if (!cancelled) setWarehouseStock(mapped)
        
        // Add test command to window for debugging
        ;(window as any).testStockAPI = async (itemCode: string) => {
          try {
            const res = await window.electronAPI?.proxy?.request({
              url: '/api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
              params: {
                item_id: itemCode,
                search_text: '',
                limit_start: 0,
                limit_page_length: 20
              }
            })
            console.log('🧪 Test API result:', res)
            return res
          } catch (e) {
            console.error('🧪 Test API error:', e)
            return e
          }
        }
      } catch (e: any) {
        console.error('❌ Stock loading error:', e)
        if (!cancelled) setStockError(e?.message || 'Failed to load stock')
      } finally {
        if (!cancelled) setStockLoading(false)
      }
    }
    loadStock()
    return () => {
      cancelled = true
    }
  }, [selectedItem?.item_code, currentUom])

  // Default product data when no item is selected
  const defaultProduct = {
    item_code: 'SGS24-256',
    item_name: 'Samsung Galaxy S24',
    category: 'Smartphones',
    location: 'Rack A-15, Shelf 3',
    standard_rate: 799.00,
    on_hand: 3,
    cost: 650.00,
    margin: 18.6,
    warehouses: [
      { name: 'Warehouse - 2', qty: 10 },
      { name: 'Warehouse - 3', qty: 12 },
      { name: 'Warehouse - 4', qty: 30 }
    ]
  }

  // Use selected item data or default
  const productData = selectedItem ? {
    item_code: selectedItem.item_code || 'N/A',
    item_name: selectedItem.item_name || selectedItem.label || 'Unknown Product',
    category: selectedItem.category || 'General',
    location: selectedItem.location || 'Location not specified',
    standard_rate: parseFloat(selectedItem.standard_rate || '0') || 0,
    on_hand: selectedItem.on_hand || 0,
    cost: selectedItem.cost || 0,
    margin: selectedItem.margin || 0,
    warehouses: warehouseStock.length > 0
      ? warehouseStock
      : selectedItem.warehouses || []
  } : {
    ...defaultProduct,
    warehouses: [] // Empty warehouses when no item selected
  }

  return (
    <div className="w-[440px] bg-white/60 backdrop-blur border-l border-white/20 flex flex-col">
      <div className="flex border-b border-gray-200/60 bg-white/80 overflow-x-auto">
        <button
          className={`px-4 py-3 font-semibold text-sm border-b-3 ${
            activeTab === 'product'
              ? 'border-accent bg-white/90 text-accent'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => setActiveTab('product')}
        >
          Product
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'customer'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => setActiveTab('customer')}
        >
          Customer
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'prints'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => setActiveTab('prints')}
        >
          Prints
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'payments'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => setActiveTab('payments')}
        >
          Payments
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'orders'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </button>
      </div>

      {activeTab === 'product' && (
        <div className="flex-1 overflow-y-auto">
          {/* Product Overview */}
          <div className="p-4 border-b border-gray-200/60 bg-white/90">
            <div className="flex">
              <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-4 flex items-center justify-center">
                <div className="w-24 h-24 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold">
                  {productData.item_code.substring(0, 3).toUpperCase()}
                </div>
              </div>
              <div className="space-y-2 ml-4">
                <div className="font-bold text-lg text-primary">{productData.item_code}</div>
                <div className="font-semibold text-gray-800">{productData.item_name}</div>
                <div className="text-sm text-gray-600">Category: {productData.category}</div>
                <div className="text-sm text-gray-600">Location: {productData.location}</div>
              </div>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="p-4 border-b border-gray-200/60 bg-white/90">
            <h4 className="font-bold text-gray-800 mb-3">Pricing & Stock</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <div className="text-xs text-gray-600">Unit Price</div>
                <div className="font-bold text-blue-600">${productData.standard_rate.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
                <div className="text-xs text-gray-600">On Hand</div>
                <div className="font-bold text-red-600">{productData.on_hand} units</div>
              </div>
              <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl">
                <div className="text-xs text-gray-600">Cost</div>
                <div className="font-bold text-orange-600">${productData.cost.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                <div className="text-xs text-gray-600">Margin</div>
                <div className="font-bold text-purple-600">{productData.margin.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Stock Details */}
          <div className="p-4 border-b border-gray-200/60 bg-white/90">
            <h4 className="font-bold text-gray-800 mb-3">Stock Details</h4>
            <div className="space-y-2">
              {stockLoading && (
                <div className="text-xs text-gray-500">Loading stock...</div>
              )}
              {stockError && (
                <div className="text-xs text-red-600">{stockError}</div>
              )}
              {!stockLoading && !stockError && productData.warehouses.length > 0 && productData.warehouses.map((warehouse, index) => (
                <div key={index} className="p-2 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold text-primary">{warehouse.name}</div>
                    <span className="font-semibold text-green-600">Qty: {warehouse.qty || warehouse.available || 0}</span>
                  </div>
                </div>
              ))}
              {!stockLoading && !stockError && productData.warehouses.length === 0 && (
                <div className="text-xs text-gray-500 text-center py-4">
                  {selectedItem ? 'No stock available' : 'Select an item to view stock details'}
                </div>
              )}
            </div>
          </div>

          {/* Customer's History / Alternatives */}
          <div className="bg-white/90">
            <div className="flex border-b border-gray-200/60">
              <button
                id="upsell-tab"
                className={`flex-1 px-4 py-3 font-semibold text-sm border-b-2 ${
                  subTab === 'upsell' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('upsell')}
              >
                <h4 className="font-bold text-gray-800 mb-0">Customer&apos;s History</h4>
              </button>
              <button
                id="alternative-tab"
                className={`flex-1 px-4 py-3 font-medium text-sm border-b-2 ${
                  subTab === 'alternative' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('alternative')}
              >
                <h4 className="font-bold text-gray-800 mb-0">Alternatives</h4>
              </button>
            </div>

            {subTab === 'upsell' ? (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">Previous purchases of Samsung Galaxy S24</div>
                <div className="space-y-2">
                  <div className="p-2 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs">
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-primary">POS-2024-892</div>
                      <div className="text-gray-600">Dec 15, 2024</div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-600">Qty: 1</span>
                      <span className="font-semibold text-green-600">$799.00</span>
                    </div>
                  </div>
                  <div className="p-2 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs">
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-primary">POS-2024-654</div>
                      <div className="text-gray-600">Oct 22, 2024</div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-600">Qty: 2</span>
                      <span className="font-semibold text-green-600">$1,598.00</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="space-y-3">
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-bold text-sm text-primary">SGS24-512</div>
                        <div className="text-xs text-gray-600">Galaxy S24 (512GB)</div>
                        <div className="text-xs text-green-600 font-semibold mt-1">Available: 5</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-purple-600">$949.00</div>
                        <button className="mt-1 px-3 py-1 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 transition-all">
                          Replace
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-bold text-sm text-primary">IPH15-128</div>
                        <div className="text-xs text-gray-600">iPhone 15 (128GB)</div>
                        <div className="text-xs text-green-600 font-semibold mt-1">Available: 7</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-orange-600">$899.00</div>
                        <button className="mt-1 px-3 py-1 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 transition-all">
                          Replace
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'customer' && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-gray-200/60 bg-white/90">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-primary to-slate-700 rounded-full flex items-center justify-center">
                <i className="fas fa-user text-white text-lg" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Walking Customer</h3>
                <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">
                  VAT: Not Applicable
                </p>
                <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">
                  ADDRESS: ABC BUILING, 2nds Street
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <div className="text-xs text-gray-600">Total Invoiced</div>
                <div className="font-bold text-blue-600">$12,450.00</div>
              </div>
              <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
                <div className="text-xs text-gray-600">Amount Due</div>
                <div className="font-bold text-red-600">$2,570.00</div>
              </div>
              <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                <div className="text-xs text-gray-600">Last Payment  |  <small><i> 20 Oct 2025 </i></small></div>
                <div className="font-bold text-green-600">$1,200.00</div>
              </div>
              <div className="p-3 bg-gradient-to-r from-blue-50 to-yellow-50 rounded-xl">
                <div className="text-xs text-gray-600">Credit Limit</div>
                <div className="font-bold text-orange-600">$10000.40</div>
              </div>
              <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl">
                <div className="text-xs text-gray-600">Available Credit Limit</div>
                <div className="font-bold text-orange-600">$7500.40</div>
              </div>
            </div>
          </div>

          {/* Customer insights: Recent Orders and Most Ordered */}
          <div className="bg-white/90 mt-2">
            <div className="flex border-b border-gray-200/60">
              <button
                className={`flex-1 px-4 py-3 font-semibold text-sm border-b-2 ${
                  customerSubTab === 'recent' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setCustomerSubTab('recent')}
              >
                Recent Orders
              </button>
              <button
                className={`flex-1 px-4 py-3 font-medium text-sm border-b-2 ${
                  customerSubTab === 'most' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setCustomerSubTab('most')}
              >
                Most Ordered
              </button>
            </div>

            {customerSubTab === 'recent' ? (
              <div className="p-4 space-y-3">
                {[{
                  orderNo: 'POS-2025-002',
                  qty: 3,
                  dateTime: 'Jan 20, 2025 • 3:45 PM',
                  amount: '$1,847.50',
                  status: 'Paid'
                },{
                  orderNo: 'POS-2025-001',
                  qty: 2,
                  dateTime: 'Jan 19, 2025 • 11:20 AM',
                  amount: '$999.99',
                  status: 'Unpaid'
                }].map((o, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-primary text-sm">#{o.orderNo}</div>
                        <div className="text-xs text-gray-600 mt-1">{o.dateTime}</div>
                        <div className="text-xs text-gray-600 mt-1">Qty: {o.qty}</div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-1 ${o.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{o.status}</span>
                        <div className="font-semibold">{o.amount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {[{
                  code: 'IPH15-PRO', name: 'iPhone 15 Pro', units: '15 units', amount: '$13,485'
                },{
                  code: 'SGS24-256', name: 'Galaxy S24', units: '12 units', amount: '$9,588'
                }].map((m, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-primary text-sm">{m.name}</div>
                        <div className="text-xs text-gray-600">{m.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{m.units}</div>
                        <div className="text-xs text-gray-600">{m.amount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white/90 mt-2">
            <div className="flex border-b border-gray-200/60">
              <button
                className={`flex-1 px-4 py-3 font-semibold text-sm border-b-2 ${
                  subTab === 'orders' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('orders')}
              >
                Orders
              </button>
              <button
                className={`flex-1 px-4 py-3 font-medium text-sm border-b-2 ${
                  subTab === 'returns' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('returns')}
              >
                Returns
              </button>
            </div>

            {subTab === 'orders' ? (
              <div className="p-4 space-y-3">
                {[{
                  customer: 'John Smith',
                  orderNo: 'POS-2025-002',
                  invoiceNo: 'INV-2025-1002',
                  qty: 3,
                  dateTime: 'Jan 20, 2025 • 3:45 PM',
                  amount: '$1,847.50',
                  status: 'Paid',
                  returnStatus: null
                },{
                  customer: 'Jane Doe',
                  orderNo: 'POS-2025-001',
                  invoiceNo: 'INV-2025-1001',
                  qty: 2,
                  dateTime: 'Jan 19, 2025 • 11:20 AM',
                  amount: '$999.99',
                  status: 'Unpaid',
                  returnStatus: 'Return'
                }].map((o, idx) => (
                  <div key={idx} className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-primary text-sm">{o.customer}</div>
                        <div className="text-xs text-gray-600 mt-1 flex gap-3 flex-wrap">
                          <span className="font-medium">#{o.orderNo}</span>
                          <span className="font-medium">Invoice: {o.invoiceNo}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1 flex gap-3 flex-wrap">
                          <span>Qty: {o.qty}</span>
                          <span>{o.dateTime}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{o.amount}</div>
                        <div className="mt-1 flex items-center gap-2 justify-end">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${o.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{o.status}</span>
                          {o.returnStatus && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              {o.returnStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {[{
                  customer: 'John Smith',
                  invoiceNo: 'INV-2025-1005',
                  qty: 1,
                  dateTime: 'Jan 21, 2025 • 3:45 PM',
                  amount: '$199.99',
                  status: 'Paid',
                  returnStatus: 'Returned'
                }].map((r, idx) => (
                  <div key={idx} className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-primary text-sm">{r.customer}</div>
                        <div className="text-xs text-gray-600 mt-1 flex gap-3 flex-wrap">
                          <span className="font-medium">Invoice: {r.invoiceNo}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1 flex gap-3 flex-wrap">
                          <span>Qty: {r.qty}</span>
                          <span>{r.dateTime}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{r.amount}</div>
                        <div className="mt-1 flex items-center gap-2 justify-end">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{r.status}</span>
                          {r.returnStatus && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              {r.returnStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab !== 'product' && activeTab !== 'customer' && activeTab !== 'orders' && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
          <span>{activeTab[0].toUpperCase() + activeTab.slice(1)} panel coming soon</span>
        </div>
      )}
    </div>
  )
}

export default RightPanel

// import { useState, useEffect } from 'react';
// import { FaHistory, FaBoxes, FaUserCircle } from 'react-icons/fa';
// import InfoBoxGrid from './InfoBoxGrid';
// import RightPanelProductTab from './RightPanelProductTab';
// import RightPanelCustomerTab from './RightPanelCustomerTab';
// import RightPanelOrdersTab from './RightPanelOrdersTab';
// import RightPanelPrintTab from './RightPanelPrintTab';
// import { useCartStore } from '../store/useCartStore';

// // Type definitions
// interface MostOrderedItem {
//   name: string;
//   code: string;
//   units: string;
//   amount: string;
// }

// interface InfoBoxItem {
//   label: string;
//   value: string;
//   color: string;
//   bg: string;
// }

// interface Product {
//   id?: string;
//   name?: string;
//   code?: string;
//   price?: number;
//   quantity?: number;
//   [key: string]: any;
// }

// interface Customer {
//   id?: string;
//   name?: string;
//   [key: string]: any;
// }

// interface CartStore {
//   activeRightPanelTab: string;
//   setActiveRightPanelTab: (tab: string) => void;
//   selectedProduct: Product | null;
//   selectedCustomer: Customer | null;
//   orderActionTrigger: string | null;
//   setOrderActionTrigger: (trigger: string | null) => void;
// }

// interface RightPanelProductTabProps {
//   upsellTab: string;
//   setUpsellTab: (tab: string) => void;
//   productInfo: InfoBoxItem[];
//   selectedProduct: Product | null;
// }

// interface RightPanelCustomerTabProps {
//   customerInfo: InfoBoxItem[];
//   mostOrderedData: MostOrderedItem[];
// }

// const mostOrderedData: MostOrderedItem[] = [
//   {
//     name: 'iPhone 15 Pro',
//     code: 'IPH15-PRO',
//     units: '15 units',
//     amount: '$13,485',
//   },
//   {
//     name: 'Galaxy S24',
//     code: 'SGS24-256',
//     units: '12 units',
//     amount: '$9,588',
//   },
// ];

// const RightPanel: React.FC = () => {
//   // Get active tab from cart store
//   const { 
//     activeRightPanelTab, 
//     setActiveRightPanelTab, 
//     selectedProduct, 
//     selectedCustomer, 
//     orderActionTrigger, 
//     setOrderActionTrigger 
//   }: CartStore = useCartStore();
  
//   const [upsellTab, setUpsellTab] = useState<string>('upsell');
//   const [isInitialized, setIsInitialized] = useState<boolean>(false);

//   // Auto-switch to product tab when a product is selected
//   useEffect(() => {
//     if (selectedProduct) {
//       setActiveRightPanelTab('product');
//     }
//   }, [selectedProduct, setActiveRightPanelTab]);

//   // Auto-switch to customer tab when customer is selected
//   useEffect(() => {
//     if (selectedCustomer && selectedCustomer.name !== 'Walking Customer') {
//       setActiveRightPanelTab('customer');
//     }
//   }, [selectedCustomer, setActiveRightPanelTab]);

//   // Auto-switch to orders tab when order action happens
//   useEffect(() => {
//     if (orderActionTrigger) {
//       setActiveRightPanelTab('orders');
//       // Reset the trigger after switching
//       setOrderActionTrigger(null);
//     }
//   }, [orderActionTrigger, setActiveRightPanelTab, setOrderActionTrigger]);

//   useEffect(() => {
//     // Only set default tab once when app first loads
//     if (!isInitialized) {
//       setActiveRightPanelTab('orders');
//       setIsInitialized(true);
//       return;
//     }

//     // After initialization, only auto-switch when there are actual selections
//     if (selectedProduct || selectedCustomer || orderActionTrigger) {
//       return; // Something is selected, don't change
//     }
//   }, [isInitialized, selectedProduct, selectedCustomer, orderActionTrigger, setActiveRightPanelTab]);

//   // InfoBoxGrid data for each tab
//   const productInfo: InfoBoxItem[] = [
//     { label: 'Unit Price', value: '$799.00', color: 'text-blue-600', bg: 'from-blue-50 to-indigo-50' },
//     { label: 'On Hand', value: '3 units', color: 'text-red-600', bg: 'from-red-50 to-pink-50' },
//     { label: 'Cost', value: '$650.00', color: 'text-orange-600', bg: 'from-orange-50 to-yellow-50' },
//     { label: 'Margin', value: '18.6%', color: 'text-purple-600', bg: 'from-purple-50 to-pink-50' },
//   ];

//   const customerInfo: InfoBoxItem[] = [
//     { label: 'Total Invoiced', value: '$12,450.00', color: 'text-blue-600', bg: 'from-blue-50 to-indigo-50' },
//     { label: 'Amount Due', value: '$2,570.00', color: 'text-red-600', bg: 'from-red-50 to-pink-50' },
//     { label: 'Last Payment', value: '$1,200.00', color: 'text-green-600', bg: 'from-green-50 to-emerald-50' },
//     { label: 'Commission', value: '$125.40', color: 'text-orange-600', bg: 'from-orange-50 to-yellow-50' },
//   ];

//   return (
//     <div className="w-full h-full bg-white/60 backdrop-blur border-l border-white/20 flex flex-col relative">
//       {/* Top Tabs */}
//       <div className="flex border-b border-gray-200/60 bg-white/80 overflow-x-auto">
//         <button
//           className={`px-4 py-3 font-semibold text-sm border-b-3 ${activeRightPanelTab === 'product' ? 'border-accent bg-white/90 text-accent' : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'}`}
//           onClick={() => setActiveRightPanelTab('product')}
//         >
//           Product
//         </button>
//         <button
//           className={`px-4 py-3 font-medium text-sm border-b-3 ${activeRightPanelTab === 'customer' ? 'border-accent bg-white/90 text-accent font-semibold' : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'}`}
//           onClick={() => setActiveRightPanelTab('customer')}
//         >
//           Customer
//         </button>
//         <button 
//           className={`px-4 py-3 font-medium text-sm border-b-3 ${activeRightPanelTab === 'print' ? 'border-accent bg-white/90 text-accent font-semibold' : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'}`}
//           onClick={() => setActiveRightPanelTab('print')}
//         >
//           Print
//         </button>
//         <button
//           className={`px-4 py-3 font-medium text-sm border-b-3 ${activeRightPanelTab === 'orders' ? 'border-accent bg-white/90 text-accent font-semibold' : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'}`}
//           onClick={() => setActiveRightPanelTab('orders')}
//         >
//           Orders
//         </button>
//         <button className="px-4 py-3 font-medium text-gray-500 hover:text-black hover:bg-white/40 transition-all text-sm">
//           Cash In/Out
//         </button>
//       </div>

//       {/* Quick Action Controls - Only show for Product tab */}
//       {activeRightPanelTab === 'product' && (
//         <div className="p-4 bg-white/90 border-b border-gray-200/60">
//           <div className="grid grid-cols-3 gap-3">
//             <button className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2">
//               <FaHistory />
//               History
//             </button>
//             <button className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2">
//               <FaBoxes />
//               Stock
//             </button>
//             <button className="px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2">
//               <FaUserCircle />
//               Account
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Tab Content */}
//       {activeRightPanelTab === 'product' && (
//         <RightPanelProductTab
//           upsellTab={upsellTab}
//           setUpsellTab={setUpsellTab}
//           productInfo={productInfo}
//           selectedProduct={selectedProduct}
//         />
//       )}
//       {activeRightPanelTab === 'customer' && (
//         <RightPanelCustomerTab
//           customerInfo={customerInfo}
//           mostOrderedData={mostOrderedData}
//         />
//       )}
//       {activeRightPanelTab === 'print' && (
//         <RightPanelPrintTab />
//       )}
//       {activeRightPanelTab === 'orders' && (
//         <RightPanelOrdersTab />
//       )}
//       {/* TODO: Add modular components for Invoice, Cash In/Out tabs in the future */}
//     </div>
//   );
// };

// export default RightPanel;
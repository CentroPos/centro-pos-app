import { useEffect, useState, useRef } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Trash2, Eye, X, CheckSquare, Square } from 'lucide-react'

import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'

export const LandedCostEntry = () => {
  const { profile } = usePOSProfileStore()
  const { activeTabId, getCurrentTabLandedCost, updateTabLandedCost, getCurrentTab } = usePurchaseTabStore()

  const landedCost = getCurrentTabLandedCost()
  const currentTab = getCurrentTab()
  const isReadOnly = currentTab?.status === 'confirmed' || currentTab?.status === 'paid'

  const getExactAmount = (item: any) => {
    const qty = Number(item.quantity || 0)
    const rate = Number(item.rate || item.standard_rate || 0)
    const baseTotal = qty * rate
    let discountAmt = 0
    if (item.discount_type === 'Amount') {
      discountAmt = Number(item.discount_amount || 0)
      const effectiveDiscountMode = currentTab?.orderData?.custom_line_item_discount_mode || profile?.custom_default_line_item_discount_mode || 'Row Total'
      if (effectiveDiscountMode !== 'Row Total') {
        discountAmt = discountAmt * qty
      }
    } else {
      const discountPercent = Number(item.discount_percentage || 0)
      discountAmt = (baseTotal * discountPercent) / 100
    }
    return Math.max(0, baseTotal - discountAmt)
  }

  const [itemsList, setItemsList] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  // Allocation Wizard state
  const [allocationModalItem, setAllocationModalItem] = useState<any>(null)
  const [selectedPOItems, setSelectedPOItems] = useState<Set<string>>(new Set())

  // Custom dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [openSupplierDropdownId, setOpenSupplierDropdownId] = useState<string | null>(null)
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('')
  const [suppliersList, setSuppliersList] = useState<any[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const supplierDropdownRef = useRef<HTMLDivElement>(null)
  
  const [taxTemplates, setTaxTemplates] = useState<string[]>([])
  const [taxRates, setTaxRates] = useState<Record<string, number>>({})

  useEffect(() => {
    const fetchTaxTemplates = async () => {
      // Initialize with profile defaults ONLY
      const p = profile as any
      if (p?.custom_purchase_taxes_and_charges) {
        setTaxTemplates([p.custom_purchase_taxes_and_charges])
        if (p.custom_purchase_tax_rate !== undefined) {
          setTaxRates({ [p.custom_purchase_taxes_and_charges]: Number(p.custom_purchase_tax_rate) || 0 })
        }
      } else {
        setTaxTemplates([])
        setTaxRates({})
      }
    }

    fetchTaxTemplates()
  }, [(profile as any)?.custom_purchase_taxes_and_charges, (profile as any)?.custom_purchase_tax_rate])

  useEffect(() => {
    if (activeTabId && openDropdownId) {
      fetchItems(searchQuery)
    }
  }, [activeTabId, openDropdownId, searchQuery])

  useEffect(() => {
    if (activeTabId && openSupplierDropdownId) {
      fetchSuppliers(supplierSearchQuery)
    }
  }, [activeTabId, openSupplierDropdownId, supplierSearchQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null)
      }
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
        setOpenSupplierDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchItems = async (search: string) => {
    if (!profile?.company) return
    setLoadingItems(true)
    try {
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.product.get_landed_cost_items',
        method: 'GET',
        params: {
          company: profile.company,
          search: search || '',
          limit_start: 0,
          limit_page_length: 50
        }
      })
      if (response?.data?.data?.items) {
        setItemsList(response.data.data.items)
      }
    } catch (e) {
      console.error('Failed to fetch landed cost items:', e)
    } finally {
      setLoadingItems(false)
    }
  }

  const fetchSuppliers = async (search: string) => {
    setLoadingSuppliers(true)
    try {
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.supplier.supplier_list',
        method: 'GET',
        params: {
          search_term: search || '',
          limit_start: 0,
          limit_page_length: 20
        }
      })
      const data = response?.data?.data
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
      const mappedList = list.map((s: any) => ({
        name: s.name || s.supplier_id || s.supplier_name,
        supplier_name: s.supplier_name || s.name
      }))
      setSuppliersList(mappedList)
    } catch (e) {
      console.error('Failed to fetch suppliers:', e)
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const handleUpdateField = (field: string, value: any) => {
    if (!activeTabId || !landedCost || isReadOnly) return
    updateTabLandedCost(activeTabId, { ...landedCost, [field]: value })
  }

  const handleUpdateItem = (itemId: string, field: string, value: any) => {
    if (!activeTabId || !landedCost || isReadOnly) return
    const newItems = landedCost.items.map(it => it.id === itemId ? { ...it, [field]: value } : it)
    updateTabLandedCost(activeTabId, { ...landedCost, items: newItems })
  }

  const handleUpdateItemFields = (itemId: string, updates: Record<string, any>) => {
    if (!activeTabId || !landedCost || isReadOnly) return
    const newItems = landedCost.items.map(it => it.id === itemId ? { ...it, ...updates } : it)
    updateTabLandedCost(activeTabId, { ...landedCost, items: newItems })
  }

  const handleAmountChange = async (item: any, newAmount: number) => {
    if (!activeTabId || !landedCost || isReadOnly) return

    let rate = 0
    if (item.tax_template && item.tax_template !== 'none') {
      rate = taxRates[item.tax_template] || 0
    }

    const totalAmount = newAmount + (newAmount * rate / 100)
    handleUpdateItemFields(item.id, { amount: newAmount, total_amount: parseFloat(totalAmount.toFixed(2)) })
  }

  const handleTaxTemplateChange = async (item: any, templateName: string) => {
    if (!activeTabId || !landedCost || isReadOnly) return

    if (!templateName || templateName === 'none') {
      handleUpdateItemFields(item.id, { tax_template: '', total_amount: item.amount || 0 })
      return
    }

    let rate = taxRates[templateName]

    if (rate === undefined) {
      try {
        const response = await window.electronAPI?.proxy?.request({
          method: 'GET',
          url: `/api/resource/Purchase Taxes and Charges Template/${encodeURIComponent(templateName)}`
        })
        const taxes = response?.data?.data?.taxes || []
        rate = taxes.reduce((sum: number, t: any) => sum + (t.rate || 0), 0)
        setTaxRates(prev => ({ ...prev, [templateName]: rate }))
      } catch (e) {
        console.error('Failed to fetch tax template details:', e)
        rate = 0
      }
    }

    const currentAmount = item.amount || 0
    const totalAmount = currentAmount + (currentAmount * rate / 100)
    handleUpdateItemFields(item.id, {
      tax_template: templateName,
      total_amount: parseFloat(totalAmount.toFixed(2))
    })
  }

  const handleAddItem = () => {
    if (!activeTabId || !landedCost || isReadOnly) return

    const newItem = {
      id: `lc-item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      item_code: '',
      description: '',
      supplier: currentTab?.supplier?.name || '',
      amount: 0,
      total_amount: 0,
      expense_account: '',
      tax_template: ''
    }
    updateTabLandedCost(activeTabId, { ...landedCost, items: [...landedCost.items, newItem] })
  }

  const handleRemoveItem = (itemId: string) => {
    if (!activeTabId || !landedCost || isReadOnly) return
    const newItems = landedCost.items.filter(it => it.id !== itemId)
    updateTabLandedCost(activeTabId, { ...landedCost, items: newItems })
  }

  if (!landedCost) return null

  const handleOpenAllocation = (item: any) => {
    // If it has previously allocated items, use those. 
    // Otherwise, default to ALL items in the purchase order.
    let preSelected: string[] = []
    if (item.allocated_items && item.allocated_items.length > 0) {
      preSelected = item.allocated_items.map((a: any) => a.item_code)
    } else {
      preSelected = (currentTab?.items || []).map(it => it.item_code)
    }
    
    setSelectedPOItems(new Set(preSelected))
    setAllocationModalItem(item)
  }

  const handleSaveAllocation = () => {
    if (!allocationModalItem) return
    const poItems = currentTab?.items || []
    const selected = poItems.filter(it => selectedPOItems.has(it.item_code))
    
    let allocated_items: any[] = []
    
    if (selected.length > 0) {
      const distributeBy = landedCost.distributeChargesBasedOn || 'Amount'
      
      const totalMetric = selected.reduce((sum, it) => {
        const qty = Number(it.quantity || 0)
        if (distributeBy === 'Qty') return sum + qty
        // Amount calculation (discount-aware)
        return sum + getExactAmount(it)
      }, 0)

      const rowAmount = Number(allocationModalItem.total_amount || allocationModalItem.amount || 0)

      allocated_items = selected.map(it => {
        const qty = Number(it.quantity || 0)
        let metric = 0
        if (distributeBy === 'Qty') {
          metric = qty
        } else {
          metric = getExactAmount(it)
        }

        const proportion = totalMetric > 0 ? (metric / totalMetric) : (1 / selected.length)
        const assignedAmount = Number((rowAmount * proportion).toFixed(2))

        return {
          item_code: it.item_code,
          allocated_amount: assignedAmount
        }
      })
    }

    handleUpdateItemFields(allocationModalItem.id, { allocated_items })
    setAllocationModalItem(null)
  }

  const togglePOItemSelection = (itemCode: string) => {
    const newSet = new Set(selectedPOItems)
    if (newSet.has(itemCode)) {
      newSet.delete(itemCode)
    } else {
      newSet.add(itemCode)
    }
    setSelectedPOItems(newSet)
  }

  const totalAmount = landedCost.items.reduce((sum, it) => sum + Number(it.amount || 0), 0)
  const totalLandedCost = landedCost.items.reduce((sum, it) => sum + Number(it.total_amount || 0), 0)
  const totalTaxes = totalLandedCost - totalAmount
  
  const backendGrandTotal = currentTab?.orderData?.custom_lcv_grand_total
  const displayGrandTotal = backendGrandTotal != null ? Number(backendGrandTotal) : totalLandedCost

  const currencySymbol = profile?.custom_currency_symbol || 'SAR'

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex gap-4">
        <div className="flex items-center gap-3 w-1/2">
          <label className="text-sm font-medium whitespace-nowrap">Distribute Charges Based On</label>
          <Select
            value={landedCost.distributeChargesBasedOn}
            onValueChange={(val) => handleUpdateField('distributeChargesBasedOn', val)}
            disabled={isReadOnly}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Amount">Amount</SelectItem>
              <SelectItem value="Qty">Qty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md flex-1 flex flex-col min-h-0 bg-white">
        <div className="grid grid-cols-12 gap-2 bg-gray-50 p-2 border-b text-xs font-semibold text-gray-500">
          <div className="col-span-1 text-center">No.</div>
          <div className="col-span-2 text-center">Item</div>
          <div className="col-span-2 text-center">Description</div>
          <div className="col-span-2 text-center">Supplier</div>
          <div className="col-span-1 text-center">Amount</div>
          <div className="col-span-2 text-center">Tax Template</div>
          <div className="col-span-1 text-center">Total</div>
          <div className="col-span-1 text-center">Actions</div>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-2 relative">
          {landedCost.items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-center text-sm border-b pb-2 last:border-0 relative">
              <div className="col-span-1 text-center text-gray-500">{index + 1}</div>
              <div className="col-span-2 relative" ref={dropdownRef}>
                <Button
                  variant="outline"
                  className={`w-full justify-between px-2 h-8 text-xs font-normal ${!item.item_code ? "text-muted-foreground" : ""}`}
                  disabled={isReadOnly}
                  onClick={() => {
                    if (openDropdownId === item.id) {
                      setOpenDropdownId(null)
                    } else {
                      setSearchQuery('')
                      setOpenDropdownId(item.id)
                    }
                  }}
                >
                  <span className="truncate">{item.item_code ? item.item_code : "Select Item"}</span>
                </Button>

                {openDropdownId === item.id && (
                  <div className="absolute z-50 w-[300px] top-full mt-1 left-0 bg-white border rounded-md shadow-md">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 text-xs"
                        autoFocus
                      />
                    </div>
                    <ul className="max-h-[200px] overflow-auto py-1">
                      {loadingItems ? (
                        <li className="px-3 py-2 text-xs text-gray-500 text-center">Loading...</li>
                      ) : itemsList.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-gray-500 text-center">No items found</li>
                      ) : (
                        itemsList.map((li) => (
                          <li
                            key={li.item_code}
                            className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                              handleUpdateItemFields(item.id, {
                                item_code: li.item_code,
                                description: li.description || li.item_name,
                                expense_account: li.lcv_expense_account || li.custom_lcv_expense_account || li.expense_account
                              })
                              setOpenDropdownId(null)
                            }}
                          >
                            <div className="font-medium">{li.item_code}</div>
                            <div className="text-[10px] text-gray-500">{li.description || li.item_name}</div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <Input
                  value={item.description}
                  onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Description"
                  disabled={isReadOnly}
                />
              </div>
              <div className="col-span-2 relative" ref={supplierDropdownRef}>
                <Button
                  variant="outline"
                  className={`w-full justify-between px-2 h-8 text-xs font-normal ${!item.supplier ? "text-muted-foreground" : ""}`}
                  disabled={isReadOnly}
                  onClick={() => {
                    if (openSupplierDropdownId === item.id) {
                      setOpenSupplierDropdownId(null)
                    } else {
                      setSupplierSearchQuery('')
                      setOpenSupplierDropdownId(item.id)
                    }
                  }}
                >
                  <span className="truncate">{item.supplier ? item.supplier : "Select Supplier"}</span>
                </Button>
                
                {openSupplierDropdownId === item.id && (
                  <div className="absolute z-50 w-[300px] top-full mt-1 left-0 bg-white border rounded-md shadow-md">
                    <div className="p-2 border-b">
                      <Input 
                        placeholder="Search suppliers..." 
                        value={supplierSearchQuery}
                        onChange={(e) => setSupplierSearchQuery(e.target.value)}
                        className="h-8 text-xs"
                        autoFocus
                      />
                    </div>
                    <ul className="max-h-[200px] overflow-auto py-1">
                      {loadingSuppliers ? (
                        <li className="px-3 py-2 text-xs text-gray-500 text-center">Loading...</li>
                      ) : suppliersList.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-gray-500 text-center">No suppliers found</li>
                      ) : (
                        suppliersList.map((sup) => (
                          <li
                            key={sup.name}
                            className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer"
                            onClick={() => {
                              handleUpdateItem(item.id, 'supplier', sup.name)
                              setOpenSupplierDropdownId(null)
                            }}
                          >
                            <div className="font-medium">{sup.supplier_name || sup.name}</div>
                            <div className="text-[10px] text-gray-500">{sup.name}</div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.amount || ''}
                  onChange={(e) => handleAmountChange(item, parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs text-right"
                  disabled={isReadOnly}
                />
              </div>
              <div className="col-span-2">
                <Select
                  value={item.tax_template || 'none'}
                  onValueChange={(val) => handleTaxTemplateChange(item, val)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="h-8 text-xs w-full overflow-hidden [&>span]:truncate">
                    <SelectValue placeholder="Select Tax..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {taxTemplates.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.total_amount || ''}
                  onChange={(e) => handleUpdateItem(item.id, 'total_amount', parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs text-right"
                  disabled={isReadOnly}
                />
              </div>
              <div className="col-span-1 flex items-center justify-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700"
                  onClick={() => handleOpenAllocation(item)}
                  disabled={isReadOnly}
                  title="Allocate to Items"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={isReadOnly}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!isReadOnly && (
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={handleAddItem} className="text-xs">
                Add Row
              </Button>
            </div>
          )}
        </div>

        <div className="bg-gray-50 border-t p-3 grid grid-cols-3 gap-4 rounded-b-md">
          <div className="space-y-1 text-left">
            <label className="text-xs text-gray-500 font-medium">Total LCV Amount</label>
            <div className="font-semibold">{currencySymbol} {totalAmount.toFixed(2)}</div>
          </div>
          <div className="space-y-1 text-center">
            <label className="text-xs text-gray-500 font-medium">Total LCV Taxes</label>
            <div className="font-semibold">{currencySymbol} {totalTaxes.toFixed(2)}</div>
          </div>
          <div className="space-y-1 text-right">
            <label className="text-xs text-gray-500 font-medium">Grand Total</label>
            <div className="font-semibold">{currencySymbol} {displayGrandTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {allocationModalItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-w-[90vw] max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50/80 backdrop-blur">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Allocate Service Cost</h3>
                <p className="text-sm text-gray-500 truncate max-w-[400px]">
                  {allocationModalItem.description || allocationModalItem.item_code || 'Landed Cost Item'}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAllocationModalItem(null)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-4 flex-1 overflow-auto bg-gray-50/30">
              <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-md border shadow-sm">
                <span className="text-sm font-medium text-gray-600">Total Row Amount:</span>
                <span className="text-lg font-bold text-gray-900">
                  {currencySymbol} {Number(allocationModalItem.total_amount || allocationModalItem.amount || 0).toFixed(2)}
                </span>
              </div>

              <div className="border rounded-md bg-white overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-2 bg-gray-100 p-2 border-b text-xs font-semibold text-gray-500 sticky top-0 z-10">
                  <div className="col-span-1 text-center flex items-center justify-center">
                    <button 
                      onClick={() => {
                        if (selectedPOItems.size === (currentTab?.items?.length || 0)) {
                          setSelectedPOItems(new Set())
                        } else {
                          setSelectedPOItems(new Set((currentTab?.items || []).map(it => it.item_code)))
                        }
                      }}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {selectedPOItems.size === (currentTab?.items?.length || 0) && (currentTab?.items?.length || 0) > 0 ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="col-span-4">Item</div>
                  <div className="col-span-1 text-right">Qty</div>
                  <div className="col-span-2 text-right">Item Amt</div>
                  <div className="col-span-4 text-right">Assigned Amount</div>
                </div>
                <div className="divide-y max-h-[400px] overflow-auto">
                  {(currentTab?.items || []).length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No items found in the purchase order.</div>
                  ) : (
                    (currentTab?.items || []).map(it => {
                      const isSelected = selectedPOItems.has(it.item_code)
                      
                      // Calculate preview amount
                      let previewAmount = 0
                      if (isSelected) {
                        const distributeBy = landedCost.distributeChargesBasedOn || 'Amount'
                        const selectedList = (currentTab?.items || []).filter(i => selectedPOItems.has(i.item_code))
                        const totalMetric = selectedList.reduce((sum, i) => {
                          const q = Number(i.quantity || 0)
                          if (distributeBy === 'Qty') return sum + q
                          // Amount calculation (discount-aware)
                          return sum + getExactAmount(i)
                        }, 0)

                        const qty = Number(it.quantity || 0)
                        let metric = 0
                        if (distributeBy === 'Qty') {
                          metric = qty
                        } else {
                          metric = getExactAmount(it)
                        }

                        const proportion = totalMetric > 0 ? (metric / totalMetric) : (1 / selectedList.length)
                        const rowAmount = Number(allocationModalItem.total_amount || allocationModalItem.amount || 0)
                        previewAmount = rowAmount * proportion
                      }

                      return (
                        <div 
                          key={it.item_code} 
                          className={`grid grid-cols-12 gap-2 items-center p-2 text-sm transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                          onClick={() => togglePOItemSelection(it.item_code)}
                        >
                          <div className="col-span-1 text-center flex items-center justify-center">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <div className="col-span-4 truncate pr-2">
                            <div className="font-medium text-gray-900 truncate">{it.item_code}</div>
                            <div className="text-[10px] text-gray-500 truncate">{it.item_name}</div>
                          </div>
                          <div className="col-span-1 text-right text-gray-600">
                            {it.quantity} <span className="text-[10px]">{it.uom}</span>
                          </div>
                          <div className="col-span-2 text-right text-gray-600 text-xs">
                            {currencySymbol} {getExactAmount(it).toFixed(2)}
                          </div>
                          <div className="col-span-4 text-right">
                            {isSelected ? (
                              <span className="font-semibold text-blue-700 bg-white border border-blue-200 px-2 py-1 rounded shadow-sm inline-block min-w-[80px]">
                                {currencySymbol} {previewAmount.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-xs">-</span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAllocationModalItem(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAllocation} className="bg-blue-600 hover:bg-blue-700 text-white">
                Save Allocations
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

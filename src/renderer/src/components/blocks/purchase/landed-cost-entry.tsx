import { useEffect, useState, useRef } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Trash2 } from 'lucide-react'
import { usePurchaseTabStore } from '@renderer/store/usePurchaseTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'

export const LandedCostEntry = () => {
  const { profile } = usePOSProfileStore()
  const { activeTabId, getCurrentTabLandedCost, updateTabLandedCost, getCurrentTab } = usePurchaseTabStore()

  const landedCost = getCurrentTabLandedCost()
  const currentTab = getCurrentTab()
  const isReadOnly = currentTab?.status === 'confirmed' || currentTab?.status === 'paid'

  const [itemsList, setItemsList] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

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
      const filters = search ? JSON.stringify([["supplier_name", "like", `%${search}%`]]) : undefined
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/resource/Supplier',
        method: 'GET',
        params: {
          filters,
          fields: JSON.stringify(["name", "supplier_name"]),
          limit_start: 0,
          limit_page_length: 20
        }
      })
      if (response?.data?.data) {
        setSuppliersList(response.data.data)
      }
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

  const totalAmount = landedCost.items.reduce((sum, it) => sum + Number(it.amount || 0), 0)
  const totalLandedCost = landedCost.items.reduce((sum, it) => sum + Number(it.total_amount || 0), 0)
  const totalTaxes = totalLandedCost - totalAmount
  const currencySymbol = profile?.custom_currency_symbol || 'SAR'

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex gap-4">
        <div className="space-y-1 w-1/2">
          <label className="text-sm font-medium">Distribute Charges Based On</label>
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
              <div className="col-span-1 text-center">
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

        <div className="bg-gray-50 border-t p-3 grid grid-cols-2 gap-4 rounded-b-md">
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">Total LCV Amount</label>
            <div className="font-semibold">{currencySymbol} {totalAmount.toFixed(2)}</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 font-medium">Total LCV Taxes</label>
            <div className="font-semibold">{currencySymbol} {totalTaxes.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

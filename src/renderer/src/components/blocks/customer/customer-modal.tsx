/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Plus, Search, User } from 'lucide-react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { useCreateCustomer, useCustomers } from '@renderer/hooks/useCustomer'
import { customersAPI } from '@renderer/api/customer'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Badge } from '@renderer/components/ui/badge'
import { Separator } from '@renderer/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'

// Default walking customer (unchanged)
const walkingCustomer = { name: 'Walking Customer', gst: 'Not Applicable' }

interface CustomerSearchModalProps {
  open: boolean
  onClose: () => void
  onSelect: (customer: any) => void
}

const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({ open, onClose, onSelect }) => {
  // View switching (UI-only change)
  const [view, setView] = useState<'search' | 'create'>('search')

  // Search state (kept)
  const [search, setSearch] = useState('')

  // Selection index (kept)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  // Create form state - updated to match API structure
  const [newCustomer, setNewCustomer] = useState({
    customer_name: '',
    email: '',
    mobile: '',
    customer_type: 'Individual',
    tax_id: '',
    customer_id_type_for_zatca: '',
    customer_id_number_for_zatca: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: ''
  })

  // Loading state for create customer
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  // Direct API call - bypass React Query for now
  const [apiCustomers, setApiCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<any>(null)
  
  // Extract loadCustomers function to be reusable
  const loadCustomers = async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log('🧪 Loading customers via direct proxy request...')
      const res = await window.electronAPI.proxy.request({
        url: '/api/method/centro_pos_apis.api.customer.customer_list',
        params: {
          search_term: '',
          limit_start: 0,
          limit_page_length: 1000
        }
      })
      console.log('🧪 Proxy response:', res)
      
      // Extract customers from response.data.data array
      const customers = Array.isArray(res?.data?.data) ? res.data.data : []
      console.log('🧪 Extracted customers:', customers)
      
      // Transform to the format expected by the UI
      const transformedCustomers = customers.map((customer: any) => {
        console.log('🔍 Raw customer from API:', customer)
        console.log('🔍 Customer API fields:', {
          name: customer.name,
          customer_name: customer.customer_name,
          email_id: customer.email_id,
          tax_id: customer.tax_id
        })
        const transformed = {
          id: customer.name, // This is the actual customer_id (CUS-00001)
          name: customer.customer_name || customer.name, // Display name
          email: customer.email_id || '',
          phone: customer.phone || null,
          address: customer.address_line1 || null,
          city: customer.city || null,
          state: customer.state || null,
          country: 'Saudi Arabia',
          pincode: customer.pincode || null,
          customerType: 'Individual',
          gst: customer.tax_id || null, // Keep tax_id for reference
          customer_id: customer.name, // Store the actual customer_id separately
          isActive: true,
          createdAt: '',
          updatedAt: ''
        }
        console.log('🔍 Transformed customer:', transformed)
        return transformed
      })
      
      console.log('🧪 Transformed customers:', transformedCustomers)
      setApiCustomers(transformedCustomers)
    } catch (err) {
      console.error('🧪 Error loading customers:', err)
      setError(err instanceof Error ? err.message : 'Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }

  // Load customers on component mount and when modal opens
  useEffect(() => {
    if (open) {
      console.log('🔄 Modal opened, loading customers...')
      loadCustomers()
    }
  }, [open])

  // Refresh customers when switching back to search view
  useEffect(() => {
    if (view === 'search') {
      console.log('🔄 Switching to search view, refreshing customer list...')
      loadCustomers()
    }
  }, [view])
  
  console.log('👥 Customer data:', { 
    apiCustomers, 
    isLoading, 
    error,
    apiCustomersLength: apiCustomers.length
  })
  
  // Add test command to window for debugging
  ;(window as any).testCustomerAPI = async () => {
    try {
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.customer.customer_list',
        params: {
          search_term: '',
          limit_start: 0,
          limit_page_length: 1000
        }
      })
      console.log('🧪 Customer API result:', res)
      return res
    } catch (e) {
      console.error('🧪 Customer API error:', e)
      return e
    }
  }
  
  const createCustomerMutation = useCreateCustomer()

  // Build customer list - apiCustomers is already transformed by customersAPI.getAll()
  const customersFromAPI = apiCustomers || []
  const allCustomers = useMemo(
    () => {
      console.log('📋 Raw API customers:', customersFromAPI)
      // apiCustomers is already Customer[] objects from customersAPI.getAll()
      // Just map to the format needed for display
      const mapped = customersFromAPI.map((customer: any) => ({
        name: customer.name, // Customer.name is already the display name
        gst: customer.gst || 'Not Available'
      }))
      console.log('📋 Mapped customers for display:', mapped)
      return mapped
    },
    [customersFromAPI]
  )

  // Filter (kept)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    console.log('🔍 Filtering with term:', term, 'allCustomers:', allCustomers)
    if (!term) return allCustomers
    const result = allCustomers.filter((c) => c.name && c.name.toLowerCase().includes(term))
    console.log('🎯 Filtered result:', result)
    return result
  }, [allCustomers, search])

  // Keyboard scroll support (UI-only)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedIndex])

  // Handlers (logic kept)
  const handleSelect = () => {
    if (selectedIndex >= 0 && filtered[selectedIndex]) {
      const selectedCustomer = filtered[selectedIndex]
      // Store customer with correct customer_id for order creation
      const customerForOrder = {
        name: selectedCustomer.name, // Display name (customer_name field)
        gst: selectedCustomer.gst, // Tax ID for reference
        customer_id: selectedCustomer.id // Actual customer_id (CUS-00001) - use the name field which contains CUS-XXXXX
      }
      console.log('🔍 Customer selection debug:', {
        selectedCustomer,
        customer_name: selectedCustomer.name,
        name: selectedCustomer.name,
        final_customer_id: customerForOrder.customer_id,
        final_display_name: customerForOrder.name
      })
      console.log('👤 Customer selected for order:', customerForOrder)
      onSelect(customerForOrder)
      resetAndClose()
    }
  }

  const handleCreateCustomer = async () => {
    // Prevent multiple clicks
    if (isCreatingCustomer) {
      return
    }

    try {
      if (!newCustomer.customer_name.trim()) {
        toast.error('Customer name is required', {
          duration: 5000,
        })
        return
      }

      if (!newCustomer.email.trim()) {
        toast.error('Email is required', {
          duration: 5000,
        })
        return
      }

      // Validate required fields based on customer type
      if (newCustomer.customer_type === 'Company') {
        if (!newCustomer.tax_id.trim()) {
          toast.error('Tax ID is required for Company customers', {
            duration: 5000,
          })
          return
        }
        if (!newCustomer.customer_id_type_for_zatca.trim()) {
          toast.error('Customer ID Type for ZATCA is required for Company customers', {
            duration: 5000,
          })
          return
        }
        if (!newCustomer.customer_id_number_for_zatca.trim()) {
          toast.error('Customer ID Number for ZATCA is required for Company customers', {
            duration: 5000,
          })
          return
        }
      }

      // Set loading state
      setIsCreatingCustomer(true)

      // Call the API directly using proxy
      const response = await window.electronAPI.proxy.request({
        method: 'POST',
        url: '/api/method/centro_pos_apis.api.customer.create_customer',
        data: newCustomer
      })

      console.log('Create customer response:', response)

      // Check if the response indicates success (status 200)
      if (response?.status === 200) {
        // Show success message
        toast.success('Customer created successfully!', {
          duration: 2000,
        })
        
        // Reset create form
        setNewCustomer({
          customer_name: '',
          email: '',
          mobile: '',
          customer_type: 'Individual',
          tax_id: '',
          customer_id_type_for_zatca: '',
          customer_id_number_for_zatca: '',
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          pincode: ''
        })

        // Auto-select newly created
        const newCustomerForSelection = {
          name: newCustomer.customer_name, // Display name
          gst: newCustomer.tax_id || 'Not Available',
          customer_id: response.data.name // The actual customer_id returned from API (CUS-XXXXX format)
        }

        console.log('👤 New customer created for order:', newCustomerForSelection)
        
        // Refresh customer list to show the newly created customer
        console.log('🔄 Refreshing customer list after creation...')
        await loadCustomers()
        
        onSelect(newCustomerForSelection)
        resetAndClose()
      } else {
        // Parse server error message
        let errorMessage = 'Failed to create customer'
        
        if (response?.data?._server_messages) {
          try {
            // Parse the server messages array
            const serverMessages = JSON.parse(response.data._server_messages)
            if (Array.isArray(serverMessages) && serverMessages.length > 0) {
              // Parse the first message
              const firstMessage = JSON.parse(serverMessages[0])
              if (firstMessage.message) {
                errorMessage = firstMessage.message
              }
            }
          } catch (parseError) {
            console.error('Error parsing server messages:', parseError)
            // Fallback to generic error
            errorMessage = `Failed to create customer. Status: ${response?.status || 'Unknown'}`
          }
        } else {
          errorMessage = `Failed to create customer. Status: ${response?.status || 'Unknown'}`
        }
        
        throw new Error(errorMessage)
      }
    } catch (err: any) {
      console.error('Error creating customer:', err)
      toast.error(`Failed to create customer: ${err?.message || 'Please try again.'}`, {
        duration: 5000,
      })
    } finally {
      // Always reset loading state
      setIsCreatingCustomer(false)
    }
  }

  // UI helpers
  const resetAndClose = () => {
    setView('search')
    setSearch('')
    setSelectedIndex(-1)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? undefined : resetAndClose())}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-white m-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {view === 'search' ? 'Select Customer' : 'Create New Customer'}
          </DialogTitle>
        </DialogHeader>

        {view === 'search' ? (
          <>
            {/* Search Bar with New button (ProductModal style) */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelectedIndex(-1)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSelectedIndex((prev) => Math.max(prev - 1, 0))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSelect()
                  } else if (e.key === 'Escape') {
                    resetAndClose()
                  }
                }}
                className="pl-10 pr-32"
                autoFocus
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('🔄 Manual refresh triggered')
                    loadCustomers()
                  }}
                  className="h-7 px-2"
                  title="Refresh customer list"
                >
                  ↻
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setView('create')}
                  className="h-7"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
            </div>

            {/* Results */}
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading customers...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-32 text-red-500 text-sm px-4 text-center">
                  <span className="font-semibold mb-1">Error loading customers</span>
                  <span className="text-red-600/90 break-words">
                    {(() => {
                      const err: any = error
                      const msg = err?.message || err?.error || err?.exc || err?.statusText
                      try {
                        if (!msg && typeof err === 'object') return JSON.stringify(err)
                      } catch {}
                      return msg || 'Unknown error'
                    })()}
                  </span>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                  >
                    Retry
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  <div>No customers found</div>
                  <div className="text-xs mt-1">
                    API: {apiCustomers.length}, All: {allCustomers.length}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((c, index) => (
                    <div
                      key={c.name}
                      ref={(el) => {
                        itemRefs.current[index] = el
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${selectedIndex === index ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                      onClick={() => {
                        setSelectedIndex(index)
                        handleSelect()
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm leading-tight">{c.name}</h4>
                          <p
                            className={`text-xs mt-1 ${selectedIndex === index
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                              }`}
                          >
                            GST: {c.gst || 'Not Available'}
                          </p>
                        </div>
                        <Badge variant={selectedIndex === index ? 'secondary' : 'outline'}>
                          Customer
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Create Header */}
            <div className="flex items-center justify-between mb-0">
              <Button variant="outline" size="sm" onClick={() => setView('search')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>

            {/* Create Form - Compact layout to fit in one window */}
            <div className="space-y-3 p-2">
              {/* Row 1: Customer Name and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Customer Name *</label>
                  <Input
                    value={newCustomer.customer_name}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        customer_name: e.target.value
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.stopPropagation()
                      }
                    }}
                    placeholder="Enter customer name"
                    disabled={isCreatingCustomer}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Customer Type *</label>
                  <Select
                    value={newCustomer.customer_type}
                    onValueChange={(value) =>
                      setNewCustomer((p) => ({
                        ...p,
                        customer_type: value
                      }))
                    }
                    disabled={isCreatingCustomer}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer type" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999] bg-white border border-gray-200 shadow-xl">
                      <SelectItem value="Individual">Individual</SelectItem>
                      <SelectItem value="Company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Email and Mobile */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email *</label>
                  <Input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        email: e.target.value
                      }))
                    }
                    placeholder="email@example.com"
                    disabled={isCreatingCustomer}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Mobile *</label>
                  <Input
                    value={newCustomer.mobile}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        mobile: e.target.value
                      }))
                    }
                    placeholder="+966509876543"
                  />
                </div>
              </div>

              {/* Row 3: Tax ID and ZATCA fields (conditional) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Tax ID {newCustomer.customer_type === 'Company' ? '*' : '(Optional)'}
                  </label>
                  <Input
                    value={newCustomer.tax_id}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        tax_id: e.target.value
                      }))
                    }
                    placeholder="310123456700003"
                  />
                </div>
                {newCustomer.customer_type === 'Company' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Customer ID Type for ZATCA *</label>
                    <Select
                      value={newCustomer.customer_id_type_for_zatca}
                      onValueChange={(value) =>
                        setNewCustomer((p) => ({
                          ...p,
                          customer_id_type_for_zatca: value
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] bg-white border border-gray-200 shadow-xl">
                        <SelectItem value="CRN">CRN</SelectItem>
                        <SelectItem value="TIN">TIN</SelectItem>
                        <SelectItem value="VAT">VAT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Row 4: ZATCA ID Number (only for Company) */}
              {newCustomer.customer_type === 'Company' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Customer ID Number for ZATCA *</label>
                  <Input
                    value={newCustomer.customer_id_number_for_zatca}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        customer_id_number_for_zatca: e.target.value
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.stopPropagation()
                      }
                    }}
                    placeholder="1010123456"
                  />
                </div>
              )}

              {/* Row 5: Address Line 1 and 2 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Address Line 1 *</label>
                  <Input
                    value={newCustomer.address_line1}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        address_line1: e.target.value
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.stopPropagation()
                      }
                    }}
                    placeholder="789 King Abdullah Road"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Address Line 2</label>
                  <Input
                    value={newCustomer.address_line2}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        address_line2: e.target.value
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.stopPropagation()
                      }
                    }}
                    placeholder="Building 8221"
                  />
                </div>
              </div>

              {/* Row 6: City, State, Pincode */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">City *</label>
                  <Input
                    value={newCustomer.city}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        city: e.target.value
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.stopPropagation()
                      }
                    }}
                    placeholder="Riyadh"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Province *</label>
                  <Input
                    value={newCustomer.state}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        state: e.target.value
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.stopPropagation()
                      }
                    }}
                    placeholder="Riyadh Province"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Pincode *</label>
                  <Input
                    value={newCustomer.pincode}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        pincode: e.target.value
                      }))
                    }
                    placeholder="11564"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setView('search')}
                disabled={isCreatingCustomer}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCustomer}
                disabled={
                  isCreatingCustomer || 
                  !newCustomer.customer_name.trim() || 
                  !newCustomer.email.trim() ||
                  !newCustomer.mobile.trim() || 
                  !newCustomer.address_line1.trim() || 
                  !newCustomer.city.trim() || 
                  !newCustomer.state.trim() || 
                  !newCustomer.pincode.trim()
                }
              >
                {isCreatingCustomer ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating customer...
                  </div>
                ) : (
                  'Create Customer'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>,
    document.body
  )
}

export default CustomerSearchModal

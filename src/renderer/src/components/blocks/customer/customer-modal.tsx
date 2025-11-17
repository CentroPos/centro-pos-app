import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Plus, Search, User } from 'lucide-react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { handleServerErrorMessages } from '@renderer/lib/error-handler'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'

// Default walking customer removed (unused)

interface CustomerSearchModalProps {
  open: boolean
  onClose: () => void
  onSelect: (customer: any) => void
}

const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({ open, onClose, onSelect }) => {
  const { getCurrentTabCustomer } = usePOSTabStore()
  const currentSelectedCustomer = getCurrentTabCustomer()
  // View switching (UI-only change)
  const [view, setView] = useState<'search' | 'create'>('search')

  // Search state (kept)
  const [search, setSearch] = useState('')

  // Selection index and last interaction source
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [lastInteraction, setLastInteraction] = useState<'keyboard' | 'mouse'>('keyboard')

  // Create form state - updated to match API structure
  const [newCustomer, setNewCustomer] = useState({
    customer_name: '',
    customer_name_arabic: '',
    email: '',
    mobile: '',
    customer_type: 'Individual',
    tax_id: '',
    customer_id_type_for_zatca: '',
    customer_id_number_for_zatca: '',
    address_line1: '',
    address_line2: '',
    building_number: '',
    city: '',
    pincode: '',
    country: ''
  })

  // Loading state for create customer
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  // Direct API call with pagination and server-side search
  const [apiCustomers, setApiCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [error, setError] = useState<any>(null)
  const perPage = 15
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const latestRequestId = useRef(0)

  // Load customers (server-side search + pagination). When append=true, we add to list.
  const loadCustomers = async (term: string, pageToLoad = 1, append = false) => {
    // Manage loading flags
    if (append) setIsFetchingMore(true)
    else setIsLoading(true)
    setError(null)

    const requestId = ++latestRequestId.current
    try {
      // Fixed-size page: always request 1-7 (no cumulative growth)
      const limit_start = 1
      const limit_page_length = perPage
      console.log('[CustomerModal] Fetching page', pageToLoad, {
        search_term: term,
        limit_start,
        limit_page_length,
        append
      })
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.customer.customer_list',
        params: {
          search_term: term || '',  // Send empty string when no search term
          limit_start,
          limit_page_length
        }
      })

      console.log('[CustomerModal] customer_list raw response:', res)

      // Ignore if a newer request has been issued
      if (requestId !== latestRequestId.current) return

      const customers = Array.isArray(res?.data?.data) ? res.data.data : []
      console.log(
        '[CustomerModal] Received',
        customers.length,
        'rows (cumulative) for page',
        pageToLoad
      )

      const transformedCustomers = customers.map((customer: any) => ({
        id: customer.name,
        name: customer.customer_name || customer.name,
        email: customer.email_id || '',
        phone: customer.mobile_no || customer.phone || null,
        address: customer.address_line1 || null,
        city: customer.city || null,
        state: customer.state || null,
        country: 'Saudi Arabia',
        pincode: customer.pincode || null,
        customerType: 'Individual',
        gst: customer.tax_id || null,
        customer_id: customer.name,
        default_price_list: customer.default_price_list || null,
        isActive: true,
        createdAt: '',
        updatedAt: ''
      }))
      console.log('[CustomerModal] Mapped customers (first 5):', transformedCustomers.slice(0,5).map(c => ({ name: c.name, default_price_list: (c as any).default_price_list })))

      // Fixed page size; disable further loads
      setHasMore(false)
      setPage(pageToLoad)
      // Replace list with current page
      setApiCustomers(transformedCustomers)
    } catch (err) {
      if (requestId !== latestRequestId.current) return
      setError(err instanceof Error ? err.message : 'Failed to load customers')
    } finally {
      if (append) setIsFetchingMore(false)
      else setIsLoading(false)
    }
  }
  // Unified debounced loader: runs on open/view/search changes
  // Ensures only ONE request path is used to avoid duplicate/blink

  // Debounced server-side search/open/view changes with cutoff (only last request applies)
  useEffect(() => {
    if (!open || view !== 'search') return
    console.log('[CustomerModal] trigger load (debounced)', { search, open, view })
    setApiCustomers([])
    setPage(1)
    setHasMore(true)
    const handle = setTimeout(() => {
      loadCustomers(search, 1, false)
    }, 300)
    return () => clearTimeout(handle)
  }, [search, open, view])

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
          search_term: search,
          limit_start: 1,
          limit_page_length: 15
        }
      })
      console.log('🧪 Customer API result:', res)
      return res
    } catch (e) {
      console.error('🧪 Customer API error:', e)
      return e
    }
  }

  // Removed unused mutation hook

  // Build customer list for display (server already filtered)
  const customersForDisplay = useMemo(() => {
    return (apiCustomers || []).map((customer: any) => ({
      id: customer.id,
      name: customer.name,
      gst: customer.gst || 'Not Available',
      phone: customer.phone || 'Not Available'
    }))
  }, [apiCustomers])

  useEffect(() => {
    if (!open || view !== 'search') return
    if (customersForDisplay.length === 0) return
    console.log('📋 Customer list loaded:', customersForDisplay)
  }, [customersForDisplay, open, view])

  // Keyboard scroll support (UI-only)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const customerListRef = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    if (lastInteraction !== 'keyboard') return
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedIndex, lastInteraction])

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (open && view === 'search') {
      // Multiple attempts to ensure focus is set
      const attemptFocus = () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
          // Also blur any active element in the item table
          const activeElement = document.activeElement
          if (activeElement && activeElement !== searchInputRef.current) {
            ;(activeElement as HTMLElement).blur()
          }
          return true
        } else if (customerListRef.current) {
          // Fallback: focus the list container so arrow keys work
          customerListRef.current.focus()
          const activeElement = document.activeElement
          if (activeElement && activeElement !== customerListRef.current) {
            ;(activeElement as HTMLElement).blur()
          }
          return true
        }
        return false
      }
      
      // Try immediately
      if (!attemptFocus()) {
        // Try after a short delay
        const timer1 = setTimeout(() => {
          if (!attemptFocus()) {
            // Try one more time after longer delay
            const timer2 = setTimeout(() => {
              attemptFocus()
            }, 200)
            return () => clearTimeout(timer2)
          }
        }, 50)
        return () => clearTimeout(timer1)
      }
    }
  }, [open, view])

  // Handlers (logic kept)
  const handleSelect = () => {
    if (selectedIndex >= 0 && customersForDisplay[selectedIndex]) {
      const selectedCustomer = customersForDisplay[selectedIndex]
      // Store customer with correct customer_id for order creation
      const customerForOrder = {
        name: selectedCustomer.name, // Display name (customer_name field)
        gst: selectedCustomer.gst, // Tax ID for reference
        customer_id: selectedCustomer.id // Actual customer_id
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
          duration: 5000
        })
        return
      }

      // Validate required fields based on customer type
      if (newCustomer.customer_type === 'Company') {
        if (!newCustomer.mobile.trim()) {
          toast.error('Mobile is required for Company customers', { duration: 5000 })
          return
        }
        if (!newCustomer.tax_id.trim()) {
          toast.error('Tax ID is required for Company customers', {
            duration: 5000
          })
          return
        }
        if (!newCustomer.customer_id_type_for_zatca.trim()) {
          toast.error('Customer ID Type for ZATCA is required for Company customers', {
            duration: 5000
          })
          return
        }
        if (!newCustomer.customer_id_number_for_zatca.trim()) {
          toast.error('Customer ID Number for ZATCA is required for Company customers', {
            duration: 5000
          })
          return
        }
      }

      // Set loading state
      setIsCreatingCustomer(true)

      // Prepare API payload with all required fields, ensuring empty values are sent as empty strings
      const apiPayload = {
        customer_name: newCustomer.customer_name || '',
        customer_name_arabic: newCustomer.customer_name_arabic || '',
        email: newCustomer.email || '',
        mobile: newCustomer.mobile || '',
        customer_type: newCustomer.customer_type || 'Individual',
        tax_id: newCustomer.tax_id || '',
        customer_id_type_for_zatca: newCustomer.customer_id_type_for_zatca || '',
        customer_id_number_for_zatca: newCustomer.customer_id_number_for_zatca || '',
        address_line1: newCustomer.address_line1 || '',
        address_line2: newCustomer.address_line2 || '',
        building_number: newCustomer.building_number || '',
        city: newCustomer.city || '',
        pincode: newCustomer.pincode || '',
        country: newCustomer.country || ''
      }

      console.log('📝 Creating customer - API payload:', apiPayload)

      // Call the API directly using proxy
      const response = await window.electronAPI?.proxy?.request({
        method: 'POST',
        url: '/api/method/centro_pos_apis.api.customer.create_customer',
        data: apiPayload
      })

      console.log('Create customer response:', response)

      // Check if the response indicates success (status 200)
      if (response?.status === 200) {
        // Show success message
        toast.success('Customer created successfully!', {
          duration: 2000
        })

        // Reset create form
        setNewCustomer({
          customer_name: '',
          customer_name_arabic: '',
          email: '',
          mobile: '',
          customer_type: 'Individual',
          tax_id: '',
          customer_id_type_for_zatca: '',
          customer_id_number_for_zatca: '',
          address_line1: '',
          address_line2: '',
          building_number: '',
          city: '',
          pincode: '',
          country: ''
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
        await loadCustomers('', 1, false)

        onSelect(newCustomerForSelection)
        resetAndClose()
      } else {
        // Handle server error messages
        handleServerErrorMessages(response?.data?._server_messages, '')
        return
      }
    } catch (err: any) {
      console.error('Error creating customer:', err)

      // Check if this is a server message error that was already handled
      const errorMessage = err?.message || 'Please try again.'

      // If the error message contains validation errors or server messages,
      // it means the error was already handled by handleServerErrorMessages
      if (
        errorMessage.includes('Multiple validation errors') ||
        errorMessage.includes('Failed to create customer') ||
        errorMessage.includes('Missing mandatory fields') ||
        errorMessage.includes('Invalid format or value for') ||
        errorMessage.includes('Buyer ID Type') ||
        errorMessage.includes('Pincode must be') ||
        errorMessage.includes('VAT Number') ||
        errorMessage.includes('Building Number') ||
        errorMessage.includes('customer_id_type_for_zatca') ||
        errorMessage.includes('tax_id') ||
        errorMessage.includes('building_number') ||
        errorMessage.includes('Validation Error') ||
        errorMessage.includes('exactly 5 digits') ||
        errorMessage.includes('exactly 15 digits') ||
        errorMessage.includes("must be 'CRN' or 'OTH'")
      ) {
        // Server messages were already handled, don't show generic error
        console.log('🔍 Server messages already handled, skipping generic error display')
        console.log('🔍 Error message that was handled:', errorMessage)
      } else {
        // Show generic error for other types of errors
        toast.error(`Failed to create customer: ${errorMessage}`, {
          duration: 5000
        })
      }
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
      <DialogContent className="max-w-5xl max-h-[75vh] bg-white m-4 flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {view === 'search' ? 'Select Customer' : 'Create New Customer'}
            </DialogTitle>
            {view === 'search' && currentSelectedCustomer?.name && (
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded mr-8">
                Selected: {currentSelectedCustomer.name}
              </div>
            )}
          </div>
        </DialogHeader>

        {view === 'search' ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Search Bar with New button (Refresh removed) */}
            <div className="relative mb-4 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                ref={searchInputRef}
                placeholder="Search customers..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelectedIndex(-1)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    e.stopPropagation()
                    setLastInteraction('keyboard')
                    if (customersForDisplay.length > 0) {
                      setSelectedIndex((prev) => Math.min(prev + 1, customersForDisplay.length - 1))
                    }
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    e.stopPropagation()
                    setLastInteraction('keyboard')
                    setSelectedIndex((prev) => Math.max(prev - 1, 0))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSelect()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    resetAndClose()
                  }
                }}
                className="pl-10 pr-28"
                autoFocus
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
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
            <div
              ref={customerListRef}
              className="flex-1 overflow-y-auto min-h-0"
              tabIndex={0}
              onKeyDown={(e) => {
                // Handle arrow keys when list container has focus
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  e.stopPropagation()
                  setLastInteraction('keyboard')
                  if (customersForDisplay.length > 0) {
                    setSelectedIndex((prev) => Math.min(prev + 1, customersForDisplay.length - 1))
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  e.stopPropagation()
                  setLastInteraction('keyboard')
                  setSelectedIndex((prev) => Math.max(prev - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSelect()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  resetAndClose()
                }
              }}
              onScroll={(e) => {
                const el = e.currentTarget as HTMLDivElement
                const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120
                if (nearBottom && !isFetchingMore && hasMore && !isLoading) {
                  console.log(
                    '[CustomerModal] Near bottom → increase page size to',
                    (page + 1) * perPage
                  )
                  loadCustomers(search, page + 1, true)
                }
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading customers...</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-32 text-red-500 text-sm px-4 text-center">
                  <span className="font-semibold mb-1">Error loading customers</span>
                  <span className="text-red-600/90 break-words">{String(error)}</span>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                  >
                    Retry
                  </button>
                </div>
              ) : customersForDisplay.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  <div>No customers found</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {customersForDisplay.map((c, index) => (
                    <div
                      key={`${c.id}-${index}`}
                      ref={(el) => {
                        itemRefs.current[index] = el
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedIndex === index
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        setSelectedIndex(index)
                        handleSelect()
                      }}
                      // Disable cursor-driven navigation; cursor is for click only
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm leading-tight">{c.name}</h4>
                          <p
                            className={`text-xs mt-1 ${
                              selectedIndex === index
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                            }`}
                          >
                            <span>Tax ID: {c.gst || 'Not Available'}</span>
                            <span className="mx-1">•</span>
                            <span>Mobile: {c.phone || 'Not Available'}</span>
                          </p>
                        </div>
                        <Badge variant={selectedIndex === index ? 'secondary' : 'outline'}>
                          Customer
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {isFetchingMore && (
                    <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                      Loading more...
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 flex-shrink-0">
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
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
              {/* Row 1: Customer Name and Name in Arabic */}
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
                  <label className="text-sm font-medium">Name in Arabic</label>
                  <Input
                    value={newCustomer.customer_name_arabic}
                    onChange={(e) =>
                      setNewCustomer((p) => ({ ...p, customer_name_arabic: e.target.value }))
                    }
                    placeholder="اكتب الاسم بالعربية"
                    disabled={isCreatingCustomer}
                  />
                </div>
              </div>

              {/* Row 1b: Customer Type */}
              <div className="grid grid-cols-2 gap-4">
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
                  <label className="text-sm font-medium">Email</label>
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
                  <label className="text-sm font-medium">Mobile{newCustomer.customer_type === 'Company' ? ' *' : ''}</label>
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

              {/* Separator */}
              <div className="border-t border-gray-300 my-2"></div>

              {/* Row 3: Tax ID and ZATCA fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Tax ID{newCustomer.customer_type === 'Company' ? ' *' : ''}</label>
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
                <div className="space-y-1">
                  <label className="text-sm font-medium">Customer ID Type for ZATCA{newCustomer.customer_type === 'Company' ? ' *' : ''}</label>
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
                    <SelectContent className="z-[9999] bg-white border border-gray-200 shadow-xl max-h-[200px]">
                      <SelectItem value="TIN">TIN</SelectItem>
                      <SelectItem value="CRN">CRN</SelectItem>
                      <SelectItem value="MOM">MOM</SelectItem>
                      <SelectItem value="MLS">MLS</SelectItem>
                      <SelectItem value="700">700</SelectItem>
                      <SelectItem value="SAG">SAG</SelectItem>
                      <SelectItem value="NAT">NAT</SelectItem>
                      <SelectItem value="GCC">GCC</SelectItem>
                      <SelectItem value="IQA">IQA</SelectItem>
                      <SelectItem value="PAS">PAS</SelectItem>
                      <SelectItem value="OTH">OTH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 4: ZATCA ID Number */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Customer ID Number for ZATCA{newCustomer.customer_type === 'Company' ? ' *' : ''}</label>
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

              {/* Row 5: Address Line 1 and 2 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Address Line 1{newCustomer.customer_type === 'Company' ? ' *' : ''}</label>
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

              {/* Row 6: City/Town, Building No., Pincode */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">City/Town{newCustomer.customer_type === 'Company' ? ' *' : ''}</label>
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
                  <label className="text-sm font-medium">Building No.{newCustomer.customer_type === 'Company' ? ' *' : ''}</label>
                  <Input
                    value={newCustomer.building_number}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        building_number: e.target.value
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === ' ') {
                        e.stopPropagation()
                      }
                    }}
                    placeholder="Building number"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Pincode{newCustomer.customer_type === 'Company' ? ' *' : ''}</label>
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

              {/* Row 7: Country */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Country</label>
                <Input
                  value={newCustomer.country}
                  onChange={(e) =>
                    setNewCustomer((p) => ({
                      ...p,
                      country: e.target.value
                    }))
                  }
                  placeholder="Saudi Arabia"
                />
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
                  (newCustomer.customer_type === 'Company' && (
                    !newCustomer.mobile.trim() ||
                    !newCustomer.tax_id.trim() ||
                    !newCustomer.customer_id_type_for_zatca.trim() ||
                    !newCustomer.customer_id_number_for_zatca.trim() ||
                    !newCustomer.address_line1.trim() ||
                    !newCustomer.city.trim() ||
                    !newCustomer.building_number.trim() ||
                    !newCustomer.pincode.trim()
                  ))
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

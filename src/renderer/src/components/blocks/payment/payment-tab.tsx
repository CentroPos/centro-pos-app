import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCcw, User, Search, Plus, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'
import { toast } from 'sonner'
import { handleServerErrorMessages } from '@renderer/lib/error-handler'

interface Customer {
  id: string
  customer_name: string
  name: string
  tax_id?: string
  mobile_no?: string
  phone?: string
  gst?: string
}

interface DueInvoice {
  invoice_no: string
  customer: string
  date: string
  total_amount: number
  due_amount: number
  due_date: string
  allocated_amount?: number
  is_selected?: boolean
}

interface PaymentVoucher {
  name: string
  party: string
  party_name?: string
  posting_date: string
  paid_amount: number
  status: string
  mode_of_payment: string
  payment_type?: string
}

const PaymentTab: React.FC = () => {
  const [paymentType, setPaymentType] = useState<string>('Receive')
  const [partyType, setPartyType] = useState<string>('Customer')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [_customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [customerPage, setCustomerPage] = useState(1)
  const [customerHasMore, setCustomerHasMore] = useState(false) // Fixed page size, no more loads
  const [isFetchingMoreCustomers, setIsFetchingMoreCustomers] = useState(false)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const latestCustomerReq = React.useRef(0)
  const customerPerPage = 15 // Fixed page size, same as main POS customer modal
  // Get current date in local timezone (YYYY-MM-DD format)
  const getCurrentDate = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [dueInvoices, setDueInvoices] = useState<DueInvoice[]>([])
  const [modeOfPayment, setModeOfPayment] = useState<string>('Cash')
  const [paymentDate, setPaymentDate] = useState<string>(() => getCurrentDate())
  const [paymentAmount, setPaymentAmount] = useState<string>('0.00')
  const [loading, setLoading] = useState(false)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState<number>(0)
  const [_paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>([])
  const [filteredVouchers, setFilteredVouchers] = useState<PaymentVoucher[]>([])
  const [voucherSearchTerm, setVoucherSearchTerm] = useState<string>('')
  const [voucherPage, setVoucherPage] = useState(1)
  const [voucherPageLength, setVoucherPageLength] = useState(10)
  const [voucherTotal, setVoucherTotal] = useState(0)
  const [voucherLoading, setVoucherLoading] = useState(false)
  const [voucherError, setVoucherError] = useState<string | null>(null)
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('All')
  const pageSizeOptions = [10, 20, 30, 50]
  const [paymentModes, setPaymentModes] = useState<string[]>([
    'Cash',
    'Card',
    'Bank Transfer',
    'Cheque'
  ])
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [_vatPercentage, setVatPercentage] = useState(10)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isVoucherViewModalOpen, setIsVoucherViewModalOpen] = useState(false)
  const [voucherViewData, setVoucherViewData] = useState<any>(null)
  const [pendingPaymentEntryData, setPendingPaymentEntryData] = useState<any>(null)
  const isLoadingFromVoucherRef = useRef(false)

  // Helper function to abbreviate invoice numbers (last 5 digits)
  const abbreviateInvoiceNumber = (invoiceNo: string): string => {
    if (invoiceNo.length <= 5) return invoiceNo
    return invoiceNo.slice(-5)
  }

  // Load POS profile data
  const loadPOSProfile = async () => {
    try {
      console.log('📋 Loading POS profile...')
      
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
      })

      if (response?.data?.data) {
        const profileData = response.data.data

        // Extract payment modes from payments array
        if (profileData.payments && Array.isArray(profileData.payments)) {
          const modes = profileData.payments.map((payment: any) => payment.mode_of_payment) as string[]
          // Remove duplicates and filter out any undefined/null values
          const uniqueModes = [...new Set(modes.filter((mode) => mode && mode.trim() !== ''))]
          console.log('💳 Payment modes from profile:', modes)
          console.log('💳 Unique payment modes:', uniqueModes)
          console.log('💳 Number of payment methods found:', profileData.payments.length)
          setPaymentModes(uniqueModes)
        } else {
          console.log('📋 No payments array found or not an array')
        }

        // Extract currency symbol
        if (profileData.custom_currency_symbol) {
          console.log('💰 Currency symbol from profile:', profileData.custom_currency_symbol)
          setCurrencySymbol(profileData.custom_currency_symbol)
        }

        // Extract VAT percentage from custom_tax_rate
        if (profileData.custom_tax_rate !== null && profileData.custom_tax_rate !== undefined) {
          const vatValue = Number(profileData.custom_tax_rate)
          if (!isNaN(vatValue) && vatValue >= 0) {
            console.log('📊 VAT percentage from profile:', vatValue)
            setVatPercentage(vatValue)
          }
        }

        console.log('✅ Successfully loaded POS profile data')
      }
    } catch (error) {
      console.error('📋 Error loading POS profile:', error)
    }
  }

  // Load POS profile on component mount
  useEffect(() => {
    loadPOSProfile()
  }, [])

  // Reset payment amount when modal opens (only if not loading from voucher)
  useEffect(() => {
    if (isPaymentModalOpen && !isLoadingFromVoucherRef.current) {
      setPaymentAmount('0.00')
    }
  }, [isPaymentModalOpen])

  // Clear pending data when modal closes
  useEffect(() => {
    if (!isPaymentModalOpen) {
      setPendingPaymentEntryData(null)
      isLoadingFromVoucherRef.current = false
    }
  }, [isPaymentModalOpen])

  // Debounced search effect - resets pagination and triggers API call when search changes
  const prevVoucherSearchRef = useRef<string>('')
  const isVoucherInitialMount = useRef<boolean>(true)

  // Load payment vouchers on component mount and when filters change
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!cancelled) {
        await loadPaymentVouchers(voucherPage, voucherSearchTerm, paymentTypeFilter)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [voucherPage, voucherPageLength, paymentTypeFilter, voucherSearchTerm])

  useEffect(() => {
    // On initial mount, call API immediately without debounce
    if (isVoucherInitialMount.current) {
      isVoucherInitialMount.current = false
      prevVoucherSearchRef.current = voucherSearchTerm
      setVoucherPage(1)
      return
    }

    // Only debounce if search term actually changed
    if (prevVoucherSearchRef.current === voucherSearchTerm) return
    
    const handler = setTimeout(() => {
      setPaymentVouchers([]) // Clear previous results
      setVoucherPage(1) // Reset to first page
      prevVoucherSearchRef.current = voucherSearchTerm
    }, 300) // Debounce for 300ms

    return () => {
      clearTimeout(handler)
    }
  }, [voucherSearchTerm]) // Trigger when search term changes

  // Reset page when page length changes
  useEffect(() => {
    setVoucherPage(1)
  }, [voucherPageLength])

  // Reset page when payment type filter changes
  useEffect(() => {
    setVoucherPage(1)
  }, [paymentTypeFilter])

  // Use paymentVouchers directly - server handles all filtering via search_term and payment_type parameters
  // No client-side filtering needed since API already filters results

  // Debounced server-side customer search (same as main POS customer modal)
  useEffect(() => {
    if (!isCustomerModalOpen) return
    console.log('[PaymentTab CustomerModal] trigger load (debounced)', { searchTerm, isCustomerModalOpen })
    setCustomers([])
    setFilteredCustomers([])
    setCustomerPage(1)
    setCustomerHasMore(false)
    const handle = setTimeout(() => {
      loadCustomers(searchTerm, 1, false)
    }, 300)
    return () => clearTimeout(handle)
  }, [searchTerm, isCustomerModalOpen])

  // Reset search and selection when modal opens
  useEffect(() => {
    if (isCustomerModalOpen) {
      setSearchTerm('')
      setSelectedCustomerIndex(0)
    }
  }, [isCustomerModalOpen])

  // Prevent item table navigation when customer modal is open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isCustomerModalOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        // Only prevent if the event is not coming from within the customer modal
        const target = e.target as HTMLElement
        const isWithinModal = target.closest('[data-customer-modal]')

        if (!isWithinModal) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    }

    if (isCustomerModalOpen) {
      document.addEventListener('keydown', handleGlobalKeyDown, true)
    }

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true)
    }
  }, [isCustomerModalOpen])

  // Auto-scroll to selected customer in the list
  useEffect(() => {
    if (isCustomerModalOpen && filteredCustomers.length > 0) {
      const selectedElement = document.querySelector(
        `[data-customer-index="${selectedCustomerIndex}"]`
      )
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    }
  }, [selectedCustomerIndex, isCustomerModalOpen, filteredCustomers.length])

  // Load customers from API with fixed page size (same as main POS customer modal)
  const loadCustomers = async (term: string, pageToLoad = 1, append = false) => {
    // Manage loading flags
    if (append) setIsFetchingMoreCustomers(true)
    else setIsLoadingCustomers(true)

    const requestId = ++latestCustomerReq.current
    try {
      // Fixed-size page: always request 1-15 (no cumulative growth)
      const limit_start = 1
      const limit_page_length = customerPerPage
      console.log('[PaymentTab CustomerModal] Fetching page', pageToLoad, {
        search_term: term,
        limit_start,
        limit_page_length,
        append
      })
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.customer.customer_list',
        params: {
          search_term: term || '',  // Send empty string when no search term
          limit_start,
          limit_page_length
        }
      })

      console.log('[PaymentTab CustomerModal] customer_list raw response:', response)

      // Ignore if a newer request has been issued
      if (requestId !== latestCustomerReq.current) return

      const customers = Array.isArray(response?.data?.data) ? response.data.data : []
      console.log(
        '[PaymentTab CustomerModal] Received',
        customers.length,
        'rows for page',
        pageToLoad
      )

      const mapped = customers.map((customer: any) => ({
        id: customer.name,
        customer_name: customer.customer_name || customer.name,
        name: customer.name,
        tax_id: customer.tax_id || null,
        mobile_no: customer.mobile_no || null,
        phone: customer.mobile_no || customer.phone || null,
        gst: customer.tax_id || null
      }))

      // Fixed page size; disable further loads
      setCustomerHasMore(false)
      setCustomerPage(pageToLoad)
      // Replace list with current page
      setCustomers(mapped)
      setFilteredCustomers(mapped)
    } catch (error) {
      if (requestId !== latestCustomerReq.current) return
      console.error('Error loading customers:', error)
      toast.error('Failed to load customers')
      setCustomers([])
      setFilteredCustomers([])
      setCustomerHasMore(false)
    } finally {
      if (append) setIsFetchingMoreCustomers(false)
      else setIsLoadingCustomers(false)
    }
  }

  // Load payment vouchers from API with pagination and filters
  const loadPaymentVouchers = async (page: number, searchTerm: string = '', paymentType: string = 'All') => {
    try {
      setVoucherLoading(true)
      setVoucherError(null)
      
      console.log('📄 Loading payment vouchers...', {
        page,
        searchTerm,
        paymentType,
        pageLength: voucherPageLength,
        timestamp: new Date().toISOString()
      })

      const params: any = {
        limit_start: page,
        limit_page_length: voucherPageLength,
        search_term: searchTerm || ''
      }

      // Add payment_type only if not "All"
      if (paymentType !== 'All') {
        params.payment_type = paymentType
      }

      console.log('📄 Payment vouchers API request params:', params)

      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.order.list_payment_vouchers',
        params
      })

      console.log('📄 Payment vouchers API response:', response)
      console.log('📄 Payment vouchers response data:', response?.data)

      if (response?.data?.data) {
        const vouchers = response.data.data.map((voucher: any) => ({
          name: voucher.name || '',
          party: voucher.party || '',
          party_name: voucher.party_name || voucher.party || '',
          posting_date: voucher.posting_date || '',
          paid_amount: voucher.paid_amount || 0,
          status: voucher.status || '',
          mode_of_payment: voucher.mode_of_payment || '',
          payment_type: voucher.payment_type || ''
        }))

        console.log('📄 Processed vouchers:', vouchers)
        console.log('📄 Number of vouchers found:', vouchers.length)

        setPaymentVouchers(vouchers)
        setFilteredVouchers(vouchers)
        // Store total (API: res.data.total or data.length fallback)
        setVoucherTotal(typeof response?.data?.total === 'number' ? response.data.total : vouchers.length)
        console.log('✅ Successfully loaded payment vouchers:', vouchers)
      } else {
        console.log('📄 No voucher data found in response')
        setPaymentVouchers([])
        setFilteredVouchers([])
        setVoucherTotal(0)
      }
    } catch (error) {
      console.error('📄 Error loading payment vouchers:', error)
      console.error('📄 Error response:', (error as any)?.response)
      console.error('📄 Error data:', (error as any)?.response?.data)

      setVoucherError(error instanceof Error ? error.message : 'Failed to load payment vouchers')
      setPaymentVouchers([])
      setFilteredVouchers([])
      setVoucherTotal(0)
    } finally {
      setVoucherLoading(false)
    }
  }

  // Load payment voucher details for viewing (read-only)
  const loadPaymentVoucherDetails = async (voucherName: string) => {
    setLoading(true)
    try {
      console.log('📋 Loading payment voucher details for viewing:', voucherName)

      const response = await window.electronAPI?.proxy?.request({
        url: `/api/resource/Payment Entry/${voucherName}`
      })

      console.log('📋 Payment voucher API response:', response)

      if (response?.data?.data) {
        const paymentData = response.data.data
        setVoucherViewData(paymentData)
        setIsVoucherViewModalOpen(true)
      } else {
        toast.error('Failed to load payment voucher details')
      }
    } catch (error) {
      console.error('📋 Error loading payment voucher details:', error)
      toast.error('Failed to load payment voucher details')
    } finally {
      setLoading(false)
    }
  }

  // Load due invoices when customer is selected
  const loadDueInvoices = async (customerId: string) => {
    setLoading(true)
    try {
      console.log('📋 Loading due invoices for customer:', customerId)

      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.order.due_invoice_list',
        params: { customer_id: customerId }
      })

      console.log('📋 Due invoices API response:', response)
      console.log('📋 Due invoices response data:', response?.data)
      console.log('📋 Due invoices response status:', response?.status)
      console.log('📋 Raw invoice data:', response?.data?.data)

      if (response?.data?.data) {
        const invoices = response.data.data.map((invoice: any) => ({
          invoice_no: invoice.invoice_no || '',
          customer: invoice.customer || '',
          date: invoice.date || '',
          total_amount: invoice.total_amount || 0,
          due_amount: invoice.due_amount || 0,
          due_date: invoice.due_date || '',
          allocated_amount: 0,
          is_selected: false
        }))

        console.log('📋 Processed invoices:', invoices)
        console.log('📋 Number of invoices found:', invoices.length)
        console.log('📋 Invoice details:')
        invoices.forEach((invoice, index) => {
          console.log(`📋 Invoice ${index + 1}:`, {
            invoice_no: invoice.invoice_no,
            invoice_no_last5: invoice.invoice_no ? invoice.invoice_no.slice(-5) : 'N/A',
            due_amount: invoice.due_amount
          })
        })

        // If we have pending payment entry data, match references with invoices
        console.log('📋 Checking for pending payment entry data...')
        console.log('📋 pendingPaymentEntryData exists:', !!pendingPaymentEntryData)
        console.log('📋 pendingPaymentEntryData.references:', pendingPaymentEntryData?.references)
        console.log('📋 pendingPaymentEntryData.references is array:', Array.isArray(pendingPaymentEntryData?.references))
        
        if (pendingPaymentEntryData?.references && Array.isArray(pendingPaymentEntryData.references)) {
          console.log('📋 ===== MATCHING REFERENCES WITH INVOICES =====')
          console.log('📋 References to match:', pendingPaymentEntryData.references.length)
          console.log('📋 Invoices to match:', invoices.length)
          
          const matchedInvoices = invoices.map((invoice) => {
            console.log(`📋 Checking invoice: ${invoice.invoice_no} (last5: ${invoice.invoice_no ? invoice.invoice_no.slice(-5) : 'N/A'})`)
            
            // Find matching reference by comparing last 5 digits
            // Extract last 5 digits from reference_name (e.g., "ACC-SINV-2025-00040" -> "00040")
            // and compare with invoice_no (which might be "00040" or full name)
            const matchingRef = pendingPaymentEntryData.references.find((ref: any) => {
              if (!ref.reference_name) {
                console.log('📋 Reference has no reference_name')
                return false
              }
              
              // Get last 5 digits from reference_name
              const refLast5 = ref.reference_name.slice(-5)
              
              // Compare with invoice_no (could be full name or just last 5 digits)
              const invoiceNo = invoice.invoice_no || ''
              const invoiceLast5 = invoiceNo.length >= 5 ? invoiceNo.slice(-5) : invoiceNo
              
              console.log(`📋 Comparing: ref="${ref.reference_name}" (last5="${refLast5}") vs invoice="${invoiceNo}" (last5="${invoiceLast5}")`)
              
              // Try multiple matching strategies
              const exactMatch = ref.reference_name === invoiceNo
              const last5Match = refLast5 === invoiceLast5
              const refLast5WithInvoice = refLast5 === invoiceNo
              
              const matches = exactMatch || last5Match || refLast5WithInvoice
              
              if (matches) {
                console.log(`✅ MATCH FOUND! ref="${ref.reference_name}" matches invoice="${invoiceNo}"`)
                console.log(`   - Exact match: ${exactMatch}`)
                console.log(`   - Last5 match: ${last5Match}`)
                console.log(`   - RefLast5 with invoice: ${refLast5WithInvoice}`)
                console.log(`   - Allocated amount: ${ref.allocated_amount}`)
              }
              
              return matches
            })

            if (matchingRef) {
              console.log('✅ FINAL MATCH - Setting invoice as selected:', {
                invoice_no: invoice.invoice_no,
                allocated_amount: matchingRef.allocated_amount,
                reference_name: matchingRef.reference_name
              })
              return {
                ...invoice,
                is_selected: true,
                allocated_amount: matchingRef.allocated_amount || 0
              }
            } else {
              console.log(`❌ No match found for invoice: ${invoice.invoice_no}`)
            }
            return invoice
          })
          
          console.log('📋 ===== MATCHING COMPLETE =====')
          console.log('📋 Matched invoices result:', matchedInvoices)
          console.log('📋 Selected invoices:', matchedInvoices.filter(inv => inv.is_selected))
          
          setDueInvoices(matchedInvoices)
          // Clear pending data after applying
          setPendingPaymentEntryData(null)
          isLoadingFromVoucherRef.current = false
          console.log('✅ Applied matched invoices to state')
        } else {
          console.log('📋 No pending payment entry data or references not found, using invoices as-is')
        setDueInvoices(invoices)
        }
        console.log('✅ Successfully loaded due invoices:', invoices)
      } else {
        console.log('📋 No invoice data found in response')
        setDueInvoices([])
      }
    } catch (error) {
      console.error('📋 Error loading due invoices:', error)
      console.error('📋 Error response:', (error as any)?.response)
      console.error('📋 Error data:', (error as any)?.response?.data)

      if ((error as any)?.response?.data?.message) {
        toast.error((error as any).response.data.message)
      } else {
        toast.error('Failed to load due invoices')
      }

      setDueInvoices([])
    } finally {
      setLoading(false)
    }
  }

  // Handle customer selection
  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsCustomerModalOpen(false)
    setPaymentAmount('0.00') // Reset payment amount when customer changes
    loadDueInvoices(customer.id)
  }

  // Handle keyboard navigation in customer modal
  const handleCustomerModalKeyDown = (e: React.KeyboardEvent) => {
    if (!isCustomerModalOpen) return

    // Prevent event from bubbling up to parent components
    e.stopPropagation()

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        e.stopPropagation()
        setSelectedCustomerIndex((prev) => (prev < filteredCustomers.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        e.stopPropagation()
        setSelectedCustomerIndex((prev) => (prev > 0 ? prev - 1 : filteredCustomers.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        e.stopPropagation()
        if (filteredCustomers[selectedCustomerIndex]) {
          handleCustomerSelect(filteredCustomers[selectedCustomerIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        setIsCustomerModalOpen(false)
        break
    }
  }

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Calculate total allocated amount
  const totalAllocatedAmount = useMemo(() => {
    return dueInvoices
      .filter((invoice) => invoice.is_selected)
      .reduce((sum, invoice) => sum + (invoice.allocated_amount || 0), 0)
  }, [dueInvoices])

  // Calculate unallocated amount
  const unallocatedAmount = useMemo(() => {
    const amount = parseFloat(paymentAmount) || 0
    return amount - totalAllocatedAmount
  }, [paymentAmount, totalAllocatedAmount])

  // Handle invoice selection toggle
  const handleInvoiceToggle = (index: number) => {
    setDueInvoices((prev) =>
      prev.map((invoice, i) =>
        i === index
          ? {
              ...invoice,
              is_selected: !invoice.is_selected,
              allocated_amount: !invoice.is_selected ? invoice.due_amount : 0 // Auto-fill with due amount when selected
            }
          : invoice
      )
    )
  }

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    setDueInvoices((prev) =>
      prev.map((invoice) => ({
        ...invoice,
        is_selected: checked,
        allocated_amount: checked ? invoice.due_amount : 0 // Auto-fill with due amount when selected
      }))
    )
  }

  // Check if all invoices are selected
  const isAllSelected = dueInvoices.length > 0 && dueInvoices.every((invoice) => invoice.is_selected)

  // Handle allocated amount change
  const handleAllocatedAmountChange = (index: number, value: string) => {
    const amount = parseFloat(value) || 0
    setDueInvoices((prev) =>
      prev.map((invoice, i) => (i === index ? { ...invoice, allocated_amount: amount } : invoice))
    )
  }

  // Handle make payment
  const handleMakePayment = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer')
      return
    }

    const selectedInvoices = dueInvoices.filter((invoice) => invoice.is_selected)
    if (selectedInvoices.length === 0) {
      toast.error('Please select at least one invoice')
      return
    }

    const amountValue = parseFloat(paymentAmount) || 0
    if (amountValue <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    try {
      setLoading(true)

      // Prepare payment data
      const paymentData = {
        payment_type: paymentType,
        party_type: partyType,
        party: selectedCustomer.id,
        posting_date: paymentDate,
        paid_amount: amountValue,
        mode_of_payment: modeOfPayment,
        references: selectedInvoices.map((invoice) => ({
          reference_doctype: 'Sales Invoice',
          reference_name: invoice.invoice_no,
          allocated_amount: invoice.allocated_amount
        }))
      }

      // Enhanced console logging for API call
      console.log('💳 ===== MAKE PAYMENT API CALL START =====')
      console.log('💳 API Endpoint: /api/method/centro_pos_apis.api.order.create_payment_entry')
      console.log('💳 API Method: POST')
      console.log('💳 ===== REQUEST BODY PARAMETERS =====')
      console.log('💳 Payment Data (Full Object):', JSON.stringify(paymentData, null, 2))
      console.log('💳 Payment Type:', paymentData.payment_type)
      console.log('💳 Party Type:', paymentData.party_type)
      console.log('💳 Party (Customer ID):', paymentData.party)
      console.log('💳 Posting Date:', paymentData.posting_date)
      console.log('💳 Paid Amount:', paymentData.paid_amount)
      console.log('💳 Mode of Payment:', paymentData.mode_of_payment)
      console.log('💳 References Count:', paymentData.references.length)
      console.log('💳 References Details:')
      paymentData.references.forEach((ref, index) => {
        console.log(`   Reference ${index + 1}:`, {
          reference_doctype: ref.reference_doctype,
          reference_name: ref.reference_name,
          allocated_amount: ref.allocated_amount
        })
      })
      console.log('💳 ===== END REQUEST BODY PARAMETERS =====')

      // Call payment API
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.order.create_payment_entry',
        method: 'POST',
        data: paymentData
      })

      console.log('💳 ===== MAKE PAYMENT API RESPONSE =====')
      console.log('💳 Full Response Object:', response)
      console.log('💳 Response Status:', response?.status)
      console.log('💳 Response Success:', response?.success)
      console.log('💳 Response Data:', JSON.stringify(response?.data, null, 2))
      console.log('💳 Response Headers:', response?.headers)
      console.log('💳 ===== END API RESPONSE =====')

      if (response?.success) {
        console.log('✅ ===== PAYMENT SUCCESS =====')
        if (response?.data?.message) {
          console.log('✅ Payment success message:', response.data.message)
          toast.success(response.data.message)
        } else {
          console.log('✅ Payment processed successfully (no message in response)')
          toast.success('Payment processed successfully')
        }
        console.log('✅ ===== END PAYMENT SUCCESS =====')
      } else {
        console.log('❌ ===== PAYMENT FAILED =====')
        console.log('❌ API call failed - response.success is false')
        console.log('❌ Response:', response)
        console.log('❌ ===== END PAYMENT FAILED =====')
        // Handle server error messages
        handleServerErrorMessages(response?.data?._server_messages, '')
        return
      }

      // Reset form
      setSelectedCustomer(null)
      setDueInvoices([])
      setPaymentAmount('0.00')
      console.log('💳 ===== MAKE PAYMENT API CALL END =====')
    } catch (error) {
      console.error('❌ ===== PAYMENT ERROR =====')
      console.error('❌ Error processing payment:', error)
      console.error('❌ Error response:', (error as any)?.response)
      console.error('❌ Error data:', (error as any)?.response?.data)
      console.error('❌ Error message:', (error as any)?.message)
      console.error('❌ Error stack:', (error as any)?.stack)
      console.error('❌ ===== END PAYMENT ERROR =====')

      // Check if this is a server message error that was already handled
      const errorMessage = (error as any)?.message || 'Please try again.'

      // If the error message contains validation errors or server messages,
      // it means the error was already handled by handleServerErrorMessages
      if (
        errorMessage.includes('Multiple validation errors') ||
        errorMessage.includes('Failed to process payment') ||
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
        if ((error as any)?.response?.data?.message) {
          toast.error((error as any).response.data.message)
        } else {
          toast.error('Failed to process payment')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 p-4 space-y-4 relative">
      {/* Top open button removed; use button near vouchers */}

      {/* Payment modal centered */}
      {isPaymentModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setIsPaymentModalOpen(false) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white w-[800px] max-w-[90vw] h-[90vh] flex flex-col rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 bg-white border-b border-gray-300 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">Make Payment</h2>
            </div>
            <div className="flex-1 flex flex-col min-h-0 p-6">
            {/* Header Section - All Select Boxes */}
            <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <Label htmlFor="party-type" className="text-sm font-medium text-gray-700">Party Type</Label>
                <Select value={partyType} onValueChange={setPartyType}>
                  <SelectTrigger className="w-full h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select party type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 shadow-lg z-[140]">
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payment-type" className="text-sm font-medium text-gray-700">Payment Type</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger className="w-full h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 shadow-lg z-[140]">
                    <SelectItem value="Receive">Receive</SelectItem>
                    <SelectItem value="Pay">Pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="mode-of-payment" className="text-sm font-medium text-gray-700">Mode of Payment</Label>
                <Select value={modeOfPayment} onValueChange={setModeOfPayment}>
                  <SelectTrigger className="w-full h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 shadow-lg z-[140]">
                    {paymentModes.map((mode) => (<SelectItem key={mode} value={mode}>{mode}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Party Name, Date and Amount */}
            <div className="grid grid-cols-3 gap-4 mb-4 flex-shrink-0">
              <div>
                <Label htmlFor="party-name" className="text-sm font-medium text-gray-700">Party Name</Label>
                <Input value={selectedCustomer?.customer_name || ''} placeholder="Select customer" readOnly onClick={() => setIsCustomerModalOpen(true)} className="w-full h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 cursor-pointer hover:bg-gray-50" />
              </div>
              <div>
                <Label htmlFor="payment-date" className="text-sm font-medium text-gray-700">Date</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
              </div>
              <div>
                <Label htmlFor="total-amount" className="text-sm font-medium text-gray-700">Amount</Label>
                <Input 
                  type="number"
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500" 
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Due invoices table and actions - Scrollable */}
            {dueInvoices.length > 0 && (
              <Card className="border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0">
                <CardHeader className="bg-gray-50 border-b border-gray-200 flex-shrink-0">
                  <CardTitle className="text-lg font-semibold text-gray-800">Allocate Pending Due</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-y-auto min-h-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-8 px-2">
                          <Checkbox 
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                            className="border-gray-300 focus:ring-blue-500"
                          />
                        </TableHead>
                        <TableHead className="w-16 px-2 text-sm font-medium text-gray-700">Invoice</TableHead>
                        <TableHead className="w-20 px-2 text-right text-sm font-medium text-gray-700">Total</TableHead>
                        <TableHead className="w-20 px-2 text-right text-sm font-medium text-gray-700">Due</TableHead>
                        <TableHead className="w-20 px-2 text-right text-sm font-medium text-gray-700">Allocate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dueInvoices.map((invoice, index) => (
                        <TableRow key={invoice.invoice_no} className="hover:bg-gray-50">
                          <TableCell className="w-8 px-2">
                            <Checkbox checked={invoice.is_selected} onCheckedChange={() => handleInvoiceToggle(index)} className="border-gray-300 focus:ring-blue-500" />
                          </TableCell>
                          <TableCell className="w-16 px-2 font-medium text-sm text-gray-900">{abbreviateInvoiceNumber(invoice.invoice_no)}</TableCell>
                          <TableCell className="w-20 px-2 text-right text-sm text-gray-700">{invoice.total_amount.toFixed(2)}</TableCell>
                          <TableCell className="w-20 px-2 text-right text-sm text-gray-700">{invoice.due_amount.toFixed(2)}</TableCell>
                          <TableCell className="w-20 px-2 text-right">
                            <div className="flex justify-end">
                              <Input type="number" value={invoice.allocated_amount || 0} onChange={(e) => handleAllocatedAmountChange(index, e.target.value)} disabled={!invoice.is_selected} className="w-16 h-8 text-right text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100" min="0" max={invoice.due_amount} step="0.01" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            </div>
            <div className="flex items-center justify-between gap-3 p-6 bg-gray-50 border-t border-gray-200 flex-shrink-0">
              <div className="text-sm font-bold">
                {paymentAmount && parseFloat(paymentAmount) > 0 && (
                  <span className={unallocatedAmount < 0 ? 'text-red-600' : 'text-black'}>
                    Unallocated = {unallocatedAmount.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-6 py-2 border-gray-300 hover:bg-gray-100"
              >
                Close
              </Button>
              <Button 
                onClick={handleMakePayment} 
                  disabled={loading || !selectedCustomer || parseFloat(paymentAmount) <= 0 || unallocatedAmount < 0} 
                className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Processing...' : 'Make Payment'}
              </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Inline form removed; use Open Make Payment to launch modal. */}

      {/* Payment Vouchers full section */}
      <div className="p-3 bg-white">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-800">Payment Vouchers</h3>
            <button
              onClick={() => {
                console.log('🔄 Refreshing payment vouchers...')
                setVoucherPage(1)
                loadPaymentVouchers(1, voucherSearchTerm, paymentTypeFilter)
              }}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="Refresh payment vouchers"
            >
              <RefreshCcw className="h-4 w-4 text-gray-600" />
            </button>
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsPaymentModalOpen(true)}>Make Payment</Button>
        </div>

        {/* Payment Type Filter and Search Bar */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-shrink-0">
            <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
              <SelectTrigger className="w-32 h-9 text-xs border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Payment Type" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 shadow-lg z-[140]">
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Receive">Receive</SelectItem>
                <SelectItem value="Pay">Pay</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search payment vouchers..."
              value={voucherSearchTerm}
              onChange={(e) => setVoucherSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Payment Vouchers Content */}
        <div>
          {voucherLoading && (
            <div className="text-xs text-gray-500 text-center py-4">Loading payment vouchers...</div>
          )}
          {voucherError && (
            <div className="text-xs text-red-600 text-center py-4">{voucherError}</div>
          )}
          {!voucherLoading && !voucherError && filteredVouchers.length > 0 ? (
            <div className="space-y-2">
              {filteredVouchers.map((voucher, _index) => (
                <div
                  key={voucher.name}
                  onClick={() => loadPaymentVoucherDetails(voucher.name)}
                  className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold text-primary text-sm">{voucher.name}</div>
                    <div className="text-gray-600 text-xs">
                      {new Date(voucher.posting_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600 font-medium">{voucher.party_name || voucher.party}</span>
                    <span className="font-bold text-green-600 text-sm">
                      {currencySymbol} {voucher.paid_amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          voucher.status === 'Submitted'
                            ? 'bg-green-100 text-green-700'
                            : voucher.status === 'Draft'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {voucher.status}
                      </span>
                      {voucher.payment_type && (
                        <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                          {voucher.payment_type}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs">{voucher.mode_of_payment}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">
                {voucherSearchTerm || paymentTypeFilter !== 'All'
                  ? 'No vouchers found matching your search.'
                  : 'No payment vouchers available.'}
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!voucherLoading && !voucherError && filteredVouchers.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-3">
              <button
                className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                onClick={() => setVoucherPage((p) => Math.max(1, p - 1))}
                disabled={voucherPage <= 1}
              >
                Prev
              </button>
              <div className="text-xs text-gray-600">Page {voucherPage}</div>
              <button
                className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                onClick={() => setVoucherPage((p) => p + 1)}
                disabled={filteredVouchers.length < voucherPageLength}
              >
                Next
              </button>
            </div>
            <div className="flex items-center justify-between mb-2 mt-2">
              <span className="text-xs text-gray-500">{voucherTotal} results found</span>
              <select
                value={voucherPageLength}
                onChange={e => setVoucherPageLength(Number(e.target.value))}
                className="text-xs border rounded px-2 py-1"
              >
                {pageSizeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt} / page</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Customer Selection Modal (portal above payment modal) */}
      {isCustomerModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center"
          onKeyDown={handleCustomerModalKeyDown}
          onClick={(e) => { if (e.target === e.currentTarget) setIsCustomerModalOpen(false) }}
          tabIndex={0}
          data-customer-modal
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white border border-gray-200 rounded-lg w-[500px] max-h-[80vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-700" />
                <h3 className="text-lg font-semibold">Select Customer</h3>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Search Bar with New button */}
            <div className="relative p-4 border-b border-gray-200">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10 pr-24"
                autoFocus
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled
                  title="Create customer (not available in payment flow)"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
            </div>

            {/* Customer List */}
            <div
              className="flex-1 overflow-y-auto p-2"
              onScroll={(e) => {
                const el = e.currentTarget as HTMLDivElement
                const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120
                // Fixed page size, no infinite scroll - pagination disabled
                // if (nearBottom && customerHasMore && !isFetchingMoreCustomers) {
                //   loadCustomers(searchTerm, customerPage + 1, true)
                // }
              }}
            >
              {isLoadingCustomers ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading customers...</span>
                </div>
              ) : filteredCustomers.length > 0 ? (
                <div className="space-y-1">
                  {filteredCustomers.map((customer, index) => (
                    <div
                      key={customer.id}
                      data-customer-index={index}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        index === selectedCustomerIndex
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm leading-tight">{customer.customer_name}</h4>
                          <p
                            className={`text-xs mt-1 ${
                              index === selectedCustomerIndex
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground'
                            }`}
                          >
                            <span>Tax ID: {customer.gst || customer.tax_id || 'Not Available'}</span>
                            <span className="mx-1">•</span>
                            <span>Mobile: {customer.phone || customer.mobile_no || 'Not Available'}</span>
                          </p>
                        </div>
                        <Badge variant={index === selectedCustomerIndex ? 'secondary' : 'outline'}>
                          Customer
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">No customers found</div>
              )}
              {isFetchingMoreCustomers && (
                <div className="text-center text-xs text-gray-500 py-2">Loading more...</div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <Button variant="outline" onClick={() => setIsCustomerModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Payment Voucher View Modal (Read-only) */}
      {isVoucherViewModalOpen && voucherViewData && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setIsVoucherViewModalOpen(false) }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white w-[800px] max-w-[90vw] h-[90vh] flex flex-col rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-800">Payment Voucher</h2>
            </div>
            <div className="flex-1 flex flex-col min-h-0 p-6">
            {/* Header Section - All Select Boxes */}
            <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <Label htmlFor="party-type" className="text-sm font-medium text-gray-700">Party Type</Label>
                <Input value={voucherViewData.party_type || 'Customer'} readOnly className="w-full h-10 bg-gray-100 border-gray-300 text-gray-700" />
              </div>
              <div>
                <Label htmlFor="payment-type" className="text-sm font-medium text-gray-700">Payment Type</Label>
                <Input value={voucherViewData.payment_type || 'Receive'} readOnly className="w-full h-10 bg-gray-100 border-gray-300 text-gray-700" />
              </div>
              <div>
                <Label htmlFor="mode-of-payment" className="text-sm font-medium text-gray-700">Mode of Payment</Label>
                <Input value={voucherViewData.mode_of_payment || 'Cash'} readOnly className="w-full h-10 bg-gray-100 border-gray-300 text-gray-700" />
              </div>
            </div>

            {/* Party Name, Date and Amount */}
            <div className="grid grid-cols-3 gap-4 mb-4 flex-shrink-0">
              <div>
                <Label htmlFor="party-name" className="text-sm font-medium text-gray-700">Party Name</Label>
                <Input value={voucherViewData.party_name || ''} readOnly className="w-full h-10 bg-gray-100 border-gray-300 text-gray-700" />
              </div>
              <div>
                <Label htmlFor="payment-date" className="text-sm font-medium text-gray-700">Date</Label>
                <Input value={voucherViewData.posting_date || ''} readOnly className="w-full h-10 bg-gray-100 border-gray-300 text-gray-700" />
              </div>
              <div>
                <Label htmlFor="total-amount" className="text-sm font-medium text-gray-700">Amount</Label>
                <Input value={voucherViewData.paid_amount ? voucherViewData.paid_amount.toFixed(2) : '0.00'} readOnly className="w-full h-10 bg-gray-100 border-gray-300 text-gray-700 font-semibold" />
              </div>
            </div>

            {/* Allocated Invoices table - Scrollable */}
            {voucherViewData.references && Array.isArray(voucherViewData.references) && voucherViewData.references.length > 0 && (
              <Card className="border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0">
                <CardHeader className="bg-gray-50 border-b border-gray-200 flex-shrink-0">
                  <CardTitle className="text-lg font-semibold text-gray-800">Allocated Invoices</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-y-auto min-h-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-8 px-2">
                          <Checkbox disabled className="border-gray-300" />
                        </TableHead>
                        <TableHead className="w-16 px-2 text-sm font-medium text-gray-700">Invoice</TableHead>
                        <TableHead className="w-20 px-2 text-right text-sm font-medium text-gray-700">Total</TableHead>
                        <TableHead className="w-20 px-2 text-right text-sm font-medium text-gray-700">Due</TableHead>
                        <TableHead className="w-20 px-2 text-right text-sm font-medium text-gray-700">Allocated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {voucherViewData.references.map((ref: any, index: number) => {
                        const invoiceNo = ref.reference_name || ''
                        const invoiceLast5 = invoiceNo.length >= 5 ? invoiceNo.slice(-5) : invoiceNo
                        const hasOutstanding = (ref.outstanding_amount || 0) > 0
                        
                        return (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell className="w-8 px-2">
                              <Checkbox 
                                checked={hasOutstanding} 
                                disabled={!hasOutstanding}
                                className="border-gray-300"
                              />
                            </TableCell>
                            <TableCell className="w-16 px-2 font-medium text-sm text-gray-900">{invoiceLast5}</TableCell>
                            <TableCell className="w-20 px-2 text-right text-sm text-gray-700">{(ref.total_amount || 0).toFixed(2)}</TableCell>
                            <TableCell className="w-20 px-2 text-right text-sm text-gray-700">{(ref.outstanding_amount || 0).toFixed(2)}</TableCell>
                            <TableCell className="w-20 px-2 text-right text-sm text-gray-700">{(ref.allocated_amount || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            </div>
            <div className="flex justify-end gap-3 p-6 bg-gray-50 border-t border-gray-200 flex-shrink-0">
              <Button 
                variant="outline" 
                onClick={() => setIsVoucherViewModalOpen(false)}
                className="px-6 py-2 border-gray-300 hover:bg-gray-100"
              >
                Close
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default PaymentTab

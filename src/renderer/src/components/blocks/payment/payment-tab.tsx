import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
import { toast } from 'sonner'
import { handleServerErrorMessages } from '@renderer/lib/error-handler'

interface Customer {
  id: string
  customer_name: string
  name: string
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
  posting_date: string
  paid_amount: number
  status: string
  mode_of_payment: string
}

const PaymentTab: React.FC = () => {
  const [paymentType, setPaymentType] = useState<string>('Receive')
  const [partyType, setPartyType] = useState<string>('Customer')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [customerPage, setCustomerPage] = useState(1)
  const [customerHasMore, setCustomerHasMore] = useState(true)
  const [isFetchingMoreCustomers, setIsFetchingMoreCustomers] = useState(false)
  const latestCustomerReq = React.useRef(0)
  const [dueInvoices, setDueInvoices] = useState<DueInvoice[]>([])
  const [modeOfPayment, setModeOfPayment] = useState<string>('Cash')
  const [paymentDate, setPaymentDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [loading, setLoading] = useState(false)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState<number>(0)
  const [paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>([])
  const [filteredVouchers, setFilteredVouchers] = useState<PaymentVoucher[]>([])
  const [voucherSearchTerm, setVoucherSearchTerm] = useState<string>('')
  const [paymentModes, setPaymentModes] = useState<string[]>([
    'Cash',
    'Card',
    'Bank Transfer',
    'Cheque'
  ])
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [vatPercentage, setVatPercentage] = useState(10)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // Helper function to abbreviate invoice numbers (last 5 digits)
  const abbreviateInvoiceNumber = (invoiceNo: string): string => {
    if (invoiceNo.length <= 5) return invoiceNo
    return invoiceNo.slice(-5)
  }

  // Load POS profile data
  const loadPOSProfile = async () => {
    try {
      console.log('📋 Loading POS profile...')
      
      const response = await window.electronAPI.proxy.request({
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

        // Extract VAT percentage from taxes_and_charges
        if (profileData.taxes_and_charges) {
          const vatMatch = profileData.taxes_and_charges.match(/(\d+)%/)
          if (vatMatch) {
            const vatValue = parseInt(vatMatch[1])
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

  // Load payment vouchers on component mount
  useEffect(() => {
    loadPOSProfile()
    loadPaymentVouchers()
  }, [])

  // Filter payment vouchers based on search term
  useEffect(() => {
    if (voucherSearchTerm.trim() === '') {
      setFilteredVouchers(paymentVouchers)
    } else {
      const filtered = paymentVouchers.filter(
        (voucher) =>
          voucher.name.toLowerCase().includes(voucherSearchTerm.toLowerCase()) ||
          voucher.party.toLowerCase().includes(voucherSearchTerm.toLowerCase()) ||
          voucher.status.toLowerCase().includes(voucherSearchTerm.toLowerCase()) ||
          voucher.mode_of_payment.toLowerCase().includes(voucherSearchTerm.toLowerCase())
      )
      setFilteredVouchers(filtered)
    }
  }, [voucherSearchTerm, paymentVouchers])

  // Debounced server-side customer search
  useEffect(() => {
    if (!isCustomerModalOpen) return
    const handle = setTimeout(() => {
      setCustomerPage(1)
      setCustomerHasMore(true)
      loadCustomers(searchTerm, 1)
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

  // Load customers from API with cumulative pagination
  const loadCustomers = async (term: string, page: number) => {
    try {
      const reqId = ++latestCustomerReq.current
      const limit_start = 1
      const limit_page_length = page * 10
      if (page > 1) setIsFetchingMoreCustomers(true)
      console.log('👥 Fetch customers', { term, limit_start, limit_page_length })
      const response = await window.electronAPI.proxy.request({
        url: '/api/method/centro_pos_apis.api.customer.customer_list',
        params: { search_term: term, limit_start, limit_page_length }
      })
      if (reqId !== latestCustomerReq.current) return
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      const mapped = rows.map((customer: any) => ({ id: customer.name, customer_name: customer.customer_name, name: customer.name }))
      setCustomers(mapped)
      setFilteredCustomers(mapped)
      setCustomerHasMore(mapped.length === limit_page_length)
      setCustomerPage(page)
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Failed to load customers')
      setCustomers([])
      setFilteredCustomers([])
      setCustomerHasMore(false)
    } finally {
      setIsFetchingMoreCustomers(false)
    }
  }

  // Load payment vouchers from API
  const loadPaymentVouchers = async () => {
    try {
      console.log('📄 Loading payment vouchers...')
      const response = await window.electronAPI.proxy.request({
        url: '/api/method/centro_pos_apis.api.order.list_payment_vouchers'
      })

      console.log('📄 Payment vouchers API response:', response)
      console.log('📄 Payment vouchers response data:', response?.data)
      console.log('📄 Payment vouchers response status:', response?.status)
      console.log('📄 Raw voucher data:', response?.data?.data)

      if (response?.data?.data) {
        const vouchers = response.data.data.map((voucher: any) => ({
          name: voucher.name || '',
          party: voucher.party || '',
          posting_date: voucher.posting_date || '',
          paid_amount: voucher.paid_amount || 0,
          status: voucher.status || '',
          mode_of_payment: voucher.mode_of_payment || ''
        }))

        console.log('📄 Processed vouchers:', vouchers)
        console.log('📄 Number of vouchers found:', vouchers.length)

        setPaymentVouchers(vouchers)
        setFilteredVouchers(vouchers)
        console.log('✅ Successfully loaded payment vouchers:', vouchers)
      } else {
        console.log('📄 No voucher data found in response')
        setPaymentVouchers([])
        setFilteredVouchers([])
      }
    } catch (error) {
      console.error('📄 Error loading payment vouchers:', error)
      console.error('📄 Error response:', error?.response)
      console.error('📄 Error data:', error?.response?.data)

      if (error?.response?.data?.message) {
        toast.error(error.response.data.message)
      } else {
        toast.error('Failed to load payment vouchers')
      }

      setPaymentVouchers([])
      setFilteredVouchers([])
    }
  }

  // Load due invoices when customer is selected
  const loadDueInvoices = async (customerId: string) => {
    setLoading(true)
    try {
      console.log('📋 Loading due invoices for customer:', customerId)

      const response = await window.electronAPI.proxy.request({
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

        setDueInvoices(invoices)
        console.log('✅ Successfully loaded due invoices:', invoices)
      } else {
        console.log('📋 No invoice data found in response')
        setDueInvoices([])
      }
    } catch (error) {
      console.error('📋 Error loading due invoices:', error)
      console.error('📋 Error response:', error?.response)
      console.error('📋 Error data:', error?.response?.data)

      if (error?.response?.data?.message) {
        toast.error(error.response.data.message)
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

  // Handle invoice selection toggle
  const handleInvoiceToggle = (index: number) => {
    setDueInvoices((prev) =>
      prev.map((invoice, i) =>
        i === index
          ? {
              ...invoice,
              is_selected: !invoice.is_selected,
              allocated_amount: !invoice.is_selected ? invoice.due_amount : 0
            }
          : invoice
      )
    )
  }

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

    if (totalAllocatedAmount <= 0) {
      toast.error('Please enter valid allocated amounts')
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
        paid_amount: totalAllocatedAmount,
        mode_of_payment: modeOfPayment,
        references: selectedInvoices.map((invoice) => ({
          reference_doctype: 'Sales Invoice',
          reference_name: invoice.invoice_no,
          allocated_amount: invoice.allocated_amount
        }))
      }

      console.log('💳 Making payment with data:', paymentData)

      // Call payment API
      const response = await window.electronAPI.proxy.request({
        url: '/api/method/centro_pos_apis.api.order.create_payment_entry',
        method: 'POST',
        data: paymentData
      })

      console.log('💳 Payment API response:', response)
      console.log('💳 Payment response data:', response?.data)
      console.log('💳 Payment response status:', response?.status)

      if (response?.success) {
        if (response?.data?.message) {
          console.log('💳 Payment success message:', response.data.message)
          toast.success(response.data.message)
        } else {
          toast.success('Payment processed successfully')
        }
      } else {
        // Handle server error messages
        handleServerErrorMessages(response?.data?._server_messages, 'Failed to process payment')
        return
      }

      // Reset form
      setSelectedCustomer(null)
      setDueInvoices([])
    } catch (error) {
      console.error('💳 Error processing payment:', error)
      console.error('💳 Error response:', error?.response)
      console.error('💳 Error data:', error?.response?.data)

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
        if (error?.response?.data?.message) {
          toast.error(error.response.data.message)
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
          <div className="relative bg-white w-[720px] max-w-[90vw] max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-4">
            {/* Party Type and Party Name */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="party-type" className="text-sm font-medium text-gray-700">Party Type</Label>
                <Select value={partyType} onValueChange={setPartyType}>
                  <SelectTrigger className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select party type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 shadow-lg z-[140]">
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="party-name" className="text-sm font-medium text-gray-700">Party Name</Label>
                <Input value={selectedCustomer?.customer_name || ''} placeholder="Select customer" readOnly onClick={() => setIsCustomerModalOpen(true)} className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 cursor-pointer hover:bg-gray-50" />
              </div>
            </div>

            {/* Payment Type and Mode of Payment */}
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <Label htmlFor="payment-type" className="text-sm font-medium text-gray-700">Payment Type</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
                  <SelectTrigger className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select payment mode" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200 shadow-lg z-[140]">
                    {paymentModes.map((mode) => (<SelectItem key={mode} value={mode}>{mode}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date and Amount */}
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <Label htmlFor="payment-date" className="text-sm font-medium text-gray-700">Date</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="h-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500" />
              </div>
              <div>
                <Label htmlFor="total-amount" className="text-sm font-medium text-gray-700">Amount</Label>
                <Input value={totalAllocatedAmount.toFixed(2)} readOnly className="h-10 bg-gray-100 border-gray-300 text-gray-700 font-semibold" />
              </div>
            </div>

            {/* Due invoices table and actions as before */}
            {dueInvoices.length > 0 && (
              <Card className="border border-gray-200 shadow-sm mt-4">
                <CardHeader className="bg-gray-50 border-b border-gray-200"><CardTitle className="text-lg font-semibold text-gray-800">Allocate Pending Due</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-8 px-2"></TableHead>
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

            <div className="flex justify-end pt-4">
              <Button onClick={handleMakePayment} disabled={loading || !selectedCustomer || totalAllocatedAmount <= 0} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">{loading ? 'Processing...' : 'Make Payment'}</Button>
              <Button variant="outline" className="ml-2" onClick={() => setIsPaymentModalOpen(false)}>Close</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Inline form removed; use Open Make Payment to launch modal. */}

      {/* Payment Vouchers full section */}
      <div className="p-3 bg-white">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-gray-800">Payment Vouchers</h3>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsPaymentModalOpen(true)}>Make Payment</Button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
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

        {/* Payment Vouchers Content */}
        <div>
          {filteredVouchers.length > 0 ? (
            <div className="space-y-2">
              {filteredVouchers.map((voucher, index) => (
                <div
                  key={voucher.name}
                  className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200"
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
                    <span className="text-gray-600 font-medium">Party: {voucher.party}</span>
                    <span className="font-bold text-green-600 text-sm">
                      {currencySymbol} {voucher.paid_amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
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
                    <span className="text-gray-500 text-xs">{voucher.mode_of_payment}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">
                {voucherSearchTerm
                  ? 'No vouchers found matching your search.'
                  : 'No payment vouchers available.'}
              </div>
            </div>
          )}
        </div>
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
          <div className="relative bg-gray-50 border border-gray-200 rounded-lg p-4 w-[420px] max-h-[70vh] flex flex-col shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Select Customer</h3>
            <div className="mb-4">
              <Input type="text" placeholder="Search customers..." value={searchTerm} onChange={handleSearchChange} className="w-full" autoFocus />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1" onScroll={(e) => {
              const el = e.currentTarget as HTMLDivElement
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80 && customerHasMore && !isFetchingMoreCustomers) {
                loadCustomers(searchTerm, customerPage + 1)
              }
            }}>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer, index) => (
                  <div key={customer.id} data-customer-index={index} className={`p-2 cursor-pointer rounded transition-colors ${index === selectedCustomerIndex ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'}`} onClick={() => handleCustomerSelect(customer)}>
                    <div className="font-medium">{customer.customer_name}</div>
                    <div className="text-sm text-gray-500">{customer.name}</div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">No customers found</div>
              )}
              {isFetchingMoreCustomers && <div className="text-center text-xs text-gray-500 py-2">Loading...</div>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default PaymentTab

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Plus, Search, User } from 'lucide-react'
import { createPortal } from 'react-dom'

import { useCreateCustomer, useCustomers } from '@renderer/hooks/useCustomer'

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

  // Create form state (kept)
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    gst: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  })

  // Data hooks (kept)
  const { data: apiCustomers, isLoading, error } = useCustomers()
  const createCustomerMutation = useCreateCustomer()

  // Build customer list (kept)
  const customersFromAPI = apiCustomers || []
  const transformedCustomers = useMemo(
    () =>
      customersFromAPI.map((customer: any) => ({
        name: customer.name,
        gst: customer.gst || 'Not Available'
      })),
    [customersFromAPI]
  )
  const allCustomers = useMemo(
    () => [walkingCustomer, ...transformedCustomers],
    [transformedCustomers]
  )

  // Filter (kept)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return allCustomers
    return allCustomers.filter((c) => c.name && c.name.toLowerCase().includes(term))
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
      onSelect(filtered[selectedIndex])
      resetAndClose()
    }
  }

  const handleCreateCustomer = async () => {
    try {
      if (!newCustomer.name.trim()) {
        alert('Customer name is required')
        return
      }

      const createdCustomer = await createCustomerMutation.mutateAsync(newCustomer)

      alert(`Customer "${newCustomer.name}" created successfully!`)

      // Reset create form (kept)
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        gst: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
      })

      // Auto-select newly created (kept)
      const newCustomerForSelection = {
        name: createdCustomer?.name || newCustomer.name,
        gst: 'Not Available'
      }

      onSelect(newCustomerForSelection)
      resetAndClose()
    } catch (err: any) {
      console.error('Error creating customer:', err)
      alert('Failed to create customer. Please try again.')
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
      <DialogContent className="max-w-2xl max-h-[90vh] bg-white">
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
                className="pl-10 pr-24"
                autoFocus
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView('create')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7"
              >
                <Plus className="h-3 w-3 mr-1" />
                New
              </Button>
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
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  No customers found
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
            <div className="flex items-center justify-between mb-2">
              <Button variant="outline" size="sm" onClick={() => setView('search')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
            <Separator className="mb-4" />

            {/* Create Form (same fields, new layout) */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer Name *</label>
                  <Input
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        name: e.target.value
                      }))
                    }
                    placeholder="Enter customer name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
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
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer((p) => ({
                          ...p,
                          phone: e.target.value
                        }))
                      }
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">GST Number</label>
                  <Input
                    value={newCustomer.gst}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        gst: e.target.value
                      }))
                    }
                    placeholder="GST number (optional)"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Address</label>
                  <textarea
                    value={newCustomer.address}
                    onChange={(e) =>
                      setNewCustomer((p) => ({
                        ...p,
                        address: e.target.value
                      }))
                    }
                    className="w-full p-3 border rounded-md"
                    rows={3}
                    placeholder="Enter address"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <Input
                      value={newCustomer.city}
                      onChange={(e) =>
                        setNewCustomer((p) => ({
                          ...p,
                          city: e.target.value
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">State</label>
                    <Input
                      value={newCustomer.state}
                      onChange={(e) =>
                        setNewCustomer((p) => ({
                          ...p,
                          state: e.target.value
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Pincode</label>
                    <Input
                      value={newCustomer.pincode}
                      onChange={(e) =>
                        setNewCustomer((p) => ({
                          ...p,
                          pincode: e.target.value
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setView('search')}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateCustomer}
                disabled={!newCustomer.name.trim() || createCustomerMutation.isPending}
              >
                {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
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
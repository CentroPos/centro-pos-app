import React, { useEffect, useState } from 'react'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { Plus, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

interface AlternateItem {
    item_id: string
    item_name: string
    description: string
    default_uom: string
    uom_details: {
        uom: string
        rate: number
        balance_qty: number
    }[]
}

interface AlternateProductsProps {
    itemCode?: string
    onAddItem: (item: any) => void
    onReplaceItem: (item: any) => void
}

const AlternateProducts: React.FC<AlternateProductsProps> = ({ itemCode, onAddItem, onReplaceItem }) => {
    const [items, setItems] = useState<AlternateItem[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedAltItem, setSelectedAltItem] = useState<AlternateItem | null>(null)
    const [isWizardOpen, setIsWizardOpen] = useState(false)
    const [wizardAction, setWizardAction] = useState<'add' | 'replace'>('add')
    const { activeTabId } = usePOSTabStore()

    useEffect(() => {
        if (!itemCode) {
            setItems([])
            return
        }

        const fetchAlternates = async () => {
            setLoading(true)
            try {
                const response = await window.electronAPI?.proxy.request({
                    url: '/api/method/centro_pos_apis.api.product.get_alternative_items',
                    method: 'GET',
                    params: { item_code: itemCode }
                })

                if (Array.isArray(response?.data?.data)) {
                    setItems(response.data.data)
                } else {
                    setItems([])
                }
            } catch (err) {
                console.error('Failed to fetch alternate items', err)
                setItems([])
            } finally {
                setLoading(false)
            }
        }

        fetchAlternates()
    }, [itemCode])

    const handleItemClick = (item: AlternateItem) => {
        setSelectedAltItem(item)
        setWizardAction('add') // Default to add
        setIsWizardOpen(true)
    }

    const handleWizardConfirm = () => {
        if (!selectedAltItem || !activeTabId) return

        // Find details for default UOM or fallback to first
        const uomDetail = selectedAltItem.uom_details.find(u => u.uom === selectedAltItem.default_uom) || selectedAltItem.uom_details[0]

        const newItem = {
            item_code: selectedAltItem.item_id,
            item_name: selectedAltItem.item_name,
            item_description: selectedAltItem.description,
            quantity: 1, // Default, override in Replace logic if needed
            uom: uomDetail?.uom || 'Nos',
            standard_rate: uomDetail?.rate || 0,
            discount_percentage: 0
        }

        if (wizardAction === 'add') {
            onAddItem(newItem)
        } else {
            onReplaceItem(newItem)
        }

        setIsWizardOpen(false)
    }

    // Keyboard navigation for Wizard
    useEffect(() => {
        if (!isWizardOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                setWizardAction('replace')
            } else if (e.key === 'ArrowLeft') {
                setWizardAction('add')
            } else if (e.key === 'Enter') {
                e.preventDefault()
                handleWizardConfirm()
            } else if (e.key === 'Escape') {
                setIsWizardOpen(false)
            }
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [isWizardOpen, wizardAction, selectedAltItem]) // Dependencies important for handleWizardConfirm closure if not memoized, but here relying on state

    // Hide if no item selected
    if (!itemCode) return null

    return (
        <>
            <div className="p-4 border-b border-gray-200/60 bg-white/90">
                <h4 className="font-bold text-gray-800 mb-3">Alternate Products</h4>

                {loading ? (
                    <div className="text-xs text-gray-500">Loading alternates...</div>
                ) : items.length === 0 ? (
                    <div className="text-xs text-gray-500 italic">No alternate products found.</div>
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => {
                            const uomDetail = item.uom_details.find(u => u.uom === item.default_uom) || item.uom_details[0]
                            const stock = uomDetail?.balance_qty || 0
                            const price = uomDetail?.rate || 0

                            return (
                                <div
                                    key={item.item_id}
                                    className="p-2 rounded-lg text-xs bg-gradient-to-r from-gray-50 to-slate-50 flex justify-between items-center group hover:border-blue-200 border border-transparent transition-all cursor-pointer"
                                    onClick={() => handleItemClick(item)}
                                >
                                    <div className="flex-1 min-w-0 mr-2">
                                        <div className="font-semibold text-gray-700 truncate" title={item.item_name}>{item.item_name}</div>
                                        <div className="text-[10px] text-gray-500 flex gap-2">
                                            <span>{item.item_id}</span>
                                            <span>|</span>
                                            <span className={stock > 0 ? "text-green-600 font-medium" : "text-red-600"}>
                                                {stock} {uomDetail?.uom}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-gray-800">{price.toFixed(2)}</div>
                                        <div className="text-[10px] text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                                            <Plus size={10} /> Select
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Wizard Dialog */}
            <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Select Action</DialogTitle>
                        <DialogDescription>
                            Choose how you want to use the alternate product.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div
                            className={cn(
                                "border-2 rounded-xl p-4 cursor-pointer hover:bg-gray-50 transition-all flex flex-col items-center justify-center gap-2 text-center",
                                wizardAction === 'add' ? "border-blue-500 bg-blue-50/50" : "border-gray-200"
                            )}
                            onClick={() => setWizardAction('add')}
                        >
                            <div className={cn("p-2 rounded-full", wizardAction === 'add' ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500")}>
                                <Plus size={24} />
                            </div>
                            <div className="font-semibold">Add New</div>
                            <div className="text-xs text-gray-500">Add as a separate line item</div>
                        </div>

                        <div
                            className={cn(
                                "border-2 rounded-xl p-4 cursor-pointer hover:bg-gray-50 transition-all flex flex-col items-center justify-center gap-2 text-center",
                                wizardAction === 'replace' ? "border-orange-500 bg-orange-50/50" : "border-gray-200"
                            )}
                            onClick={() => setWizardAction('replace')}
                        >
                            <div className={cn("p-2 rounded-full", wizardAction === 'replace' ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500")}>
                                <RefreshCw size={24} />
                            </div>
                            <div className="font-semibold">Replace</div>
                            <div className="text-xs text-gray-500">Replace selected item (keeps Qty)</div>
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-center items-center">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsWizardOpen(false)}>Cancel</Button>
                            <Button onClick={handleWizardConfirm}>Confirm</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default AlternateProducts

import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceItem, PickSlip, WarehouseOperation, OrderQueueItem } from '@renderer/types/picking';
import { InvoiceHeader } from '@renderer/components/picking/InvoiceHeader';
// import { InvoiceHeader } from '../picking/InvoiceHeader';
import { CategoryTabs } from '@renderer/components/picking/CategoryTabs';
import { ItemsTable } from '@renderer/components/picking/ItemsTable';
import { RightSidebar } from '@renderer/components/picking/RightSidebar';
import { OpenInvoiceModal } from '@renderer/components/picking/OpenInvoiceModal';
import { AssignPickSlipModal } from '@renderer/components/picking/AssignPickSlipModal';
import { OrderScheduleModal } from '@renderer/components/picking/OrderScheduleModal';
import { Button } from '@renderer/components/ui/button';
import { FileText, Plus } from 'lucide-react';
import { mockInvoices, mockPickers, mockWarehouses } from '@renderer/data/mockPickingData';

interface InvoiceTab {
    invoice: Invoice;
    items: InvoiceItem[];
    selectedItems: Set<string>;
    pickSlips: PickSlip[];
    operations: WarehouseOperation[];
    activeFilter: 'all' | 'unassigned' | 'assigned';
    activeCategory: string;
}

const MAX_TABS = 5;

const DynamicPickupInterface: React.FC = () => {
    const [invoices] = useState<Invoice[]>(mockInvoices);
    const [invoiceTabs, setInvoiceTabs] = useState<InvoiceTab[]>([]);
    const [activeTabIndex, setActiveTabIndex] = useState<number | null>(null);
    const [isOpenInvoiceModalOpen, setIsOpenInvoiceModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [pendingInvoice, setPendingInvoice] = useState<Invoice | null>(null);
    const [rightSidebarTab, setRightSidebarTab] = useState<'details' | 'sales' | 'queue'>('details');
    const [orderQueue, setOrderQueue] = useState<OrderQueueItem[]>([]);
    const [pickSlips, setPickSlips] = useState<PickSlip[]>([]);
    const [warehouseOperations] = useState<WarehouseOperation[]>([]);

    const activeTab = activeTabIndex !== null ? invoiceTabs[activeTabIndex] : null;

    // Switch to Queue tab when queue has items
    useEffect(() => {
        if (orderQueue.length > 0) {
            setRightSidebarTab('queue');
        }
    }, [orderQueue.length]);

    const handleSelectInvoiceFromModal = (invoice: Invoice) => {
        // Check if invoice is already open
        const existingTab = invoiceTabs.find((tab) => tab.invoice.id === invoice.id);
        if (existingTab) {
            const index = invoiceTabs.findIndex((tab) => tab.invoice.id === invoice.id);
            setActiveTabIndex(index);
            setIsOpenInvoiceModalOpen(false);
            return;
        }

        // Show schedule modal first
        setPendingInvoice(invoice);
        setIsOpenInvoiceModalOpen(false);
        setIsScheduleModalOpen(true);
    };

    const handleScheduleConfirm = (
        scheduleType: 'instant' | 'scheduled',
        scheduledDate?: Date,
        scheduledTime?: string,
        note?: string
    ) => {
        if (!pendingInvoice) return;

        // Create queue item
        const queueItem: OrderQueueItem = {
            id: `queue-${Date.now()}`,
            invoice: pendingInvoice,
            scheduleType,
            scheduledDate,
            scheduledTime,
            note,
            createdAt: new Date(),
            priority: scheduleType === 'instant'
                ? orderQueue.filter((q) => q.scheduleType === 'instant').length + 1
                : orderQueue.filter((q) => q.scheduleType === 'scheduled').length + 1000,
        };

        setOrderQueue([...orderQueue, queueItem]);

        // Open the invoice for picking
        handleSelectInvoice(pendingInvoice);
        setPendingInvoice(null);
        setIsScheduleModalOpen(false);
    };

    const handleSelectInvoice = (invoice: Invoice) => {
        // Check if invoice is already open
        const existingTab = invoiceTabs.find((tab) => tab.invoice.id === invoice.id);
        if (existingTab) {
            const index = invoiceTabs.findIndex((tab) => tab.invoice.id === invoice.id);
            setActiveTabIndex(index);
            return;
        }

        if (invoiceTabs.length >= MAX_TABS) {
            alert(`Maximum ${MAX_TABS} tabs allowed`);
            return;
        }

        const newTab: InvoiceTab = {
            invoice,
            items: [...invoice.items],
            selectedItems: new Set<string>(),
            pickSlips: [],
            operations: [],
            activeFilter: 'unassigned',
            activeCategory: 'All',
        };

        setInvoiceTabs([...invoiceTabs, newTab]);
        setActiveTabIndex(invoiceTabs.length);
    };

    const handleCloseTab = (index: number) => {
        const newTabs = invoiceTabs.filter((_, i) => i !== index);
        setInvoiceTabs(newTabs);
        if (activeTabIndex === index) {
            setActiveTabIndex(newTabs.length > 0 ? Math.min(index, newTabs.length - 1) : null);
        } else if (activeTabIndex !== null && activeTabIndex > index) {
            setActiveTabIndex(activeTabIndex - 1);
        }
    };

    const updateActiveTab = (updates: Partial<InvoiceTab>) => {
        if (activeTabIndex === null) return;
        const newTabs = [...invoiceTabs];
        newTabs[activeTabIndex] = { ...newTabs[activeTabIndex], ...updates };
        setInvoiceTabs(newTabs);
    };

    const handleToggleItem = (itemId: string) => {
        if (activeTabIndex === null || !activeTab) return;
        const newSelectedItems = new Set(activeTab.selectedItems);
        if (newSelectedItems.has(itemId)) {
            newSelectedItems.delete(itemId);
        } else {
            newSelectedItems.add(itemId);
        }
        updateActiveTab({ selectedItems: newSelectedItems });
    };

    const handleToggleAll = () => {
        if (activeTabIndex === null || !activeTab) return;
        const filteredItems = getFilteredItems();
        const allSelected = filteredItems.every((item) => activeTab.selectedItems.has(item.id));
        const newSelectedItems = new Set<string>();
        if (!allSelected) {
            filteredItems.forEach((item) => {
                if (!item.isAssigned) {
                    newSelectedItems.add(item.id);
                }
            });
        }
        updateActiveTab({ selectedItems: newSelectedItems });
    };

    const handleOpenAssignModal = () => {
        if (activeTab && activeTab.selectedItems.size > 0) {
            setIsAssignModalOpen(true);
        }
    };

    const handleCreatePickSlip = (warehouseId: string, pickerId: string) => {
        if (activeTabIndex === null || !activeTab) return;

        const selectedItems = activeTab.items.filter((item) => activeTab.selectedItems.has(item.id));
        const warehouse = mockWarehouses.find((w) => w.id === warehouseId);
        const picker = mockPickers.find((p) => p.id === pickerId);

        if (!warehouse || !picker) return;

        const newPickSlip: PickSlip = {
            id: `slip-${Date.now()}`,
            slipNo: `PS-${pickSlips.length + 1}`,
            warehouseId,
            warehouseName: warehouse.name,
            pickerId,
            pickerName: picker.name,
            items: selectedItems,
            status: 'not-started',
        };

        const updatedItems = activeTab.items.map((item) =>
            activeTab.selectedItems.has(item.id)
                ? { ...item, isAssigned: true, pickSlipId: newPickSlip.id }
                : item
        );

        const newPickSlips = [...pickSlips, newPickSlip];
        setPickSlips(newPickSlips);

        updateActiveTab({
            items: updatedItems,
            selectedItems: new Set<string>(),
            pickSlips: [...activeTab.pickSlips, newPickSlip],
        });
    };

    const handleFinish = () => {
        if (activeTabIndex === null || !activeTab) return;
        const allAssigned = activeTab.items.every((item) => item.isAssigned);
        if (allAssigned) {
            alert('All items assigned! Order can be finished.');
        } else {
            alert('Please assign all items before finishing.');
        }
    };

    const getFilteredItems = (): InvoiceItem[] => {
        if (!activeTab) return [];
        let items = activeTab.items;

        // Filter by assignment status
        if (activeTab.activeFilter === 'unassigned') {
            items = items.filter((item) => !item.isAssigned);
        } else if (activeTab.activeFilter === 'assigned') {
            items = items.filter((item) => item.isAssigned);
        }

        // Filter by category
        if (activeTab.activeCategory !== 'All') {
            items = items.filter((item) => item.category === activeTab.activeCategory);
        }

        return items;
    };

    const filteredItems = useMemo(() => getFilteredItems(), [activeTab?.activeFilter, activeTab?.activeCategory, activeTab?.items]);

    const categories = useMemo(() => {
        if (!activeTab) return [];
        return [...new Set(activeTab.items.map((item) => item.category))];
    }, [activeTab?.items]);

    const allCount = activeTab?.items.length || 0;
    const unassignedCount = activeTab?.items.filter((item) => !item.isAssigned).length || 0;
    const assignedCount = activeTab?.items.filter((item) => item.isAssigned).length || 0;
    const hasSelection = (activeTab?.selectedItems.size || 0) > 0;
    const canFinish = assignedCount === allCount && allCount > 0;

    const selectedItemsForModal = activeTab
        ? activeTab.items.filter((item) => activeTab.selectedItems.has(item.id))
        : [];

    return (
        <div className="h-full w-full flex bg-gray-50 overflow-hidden relative">
            {/* Left Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 mr-96">
                {/* Top Header Line: Open INV button and Invoice tabs */}
                <div className="border-b border-border bg-card px-3 py-1 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setIsOpenInvoiceModalOpen(true)}
                            className="bg-green-600 hover:bg-green-700 text-white h-7 px-3 text-xs"
                        >
                            <Plus className="w-3 h-3 mr-1" />
                            Open INV
                        </Button>
                        {invoiceTabs.length > 0 && (
                            <div className="flex gap-1.5">
                                {invoiceTabs.map((tab, index) => (
                                    <button
                                        key={tab.invoice.id}
                                        onClick={() => setActiveTabIndex(index)}
                                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${activeTabIndex === index
                                            ? 'bg-gray-200 text-gray-900'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-150'
                                            }`}
                                    >
                                        {tab.invoice.invoiceNo}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCloseTab(index);
                                            }}
                                            className="ml-0.5 hover:text-red-600 text-gray-500 text-xs"
                                        >
                                            ×
                                        </button>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    {activeTab ? (
                        <>
                            <InvoiceHeader
                                invoice={activeTab.invoice}
                                allCount={allCount}
                                unassignedCount={unassignedCount}
                                assignedCount={assignedCount}
                                activeFilter={activeTab.activeFilter}
                                onFilterChange={(filter) => updateActiveTab({ activeFilter: filter })}
                                onAssign={handleOpenAssignModal}
                                onFinish={handleFinish}
                                hasSelection={hasSelection}
                                canFinish={canFinish}
                            />

                            <CategoryTabs
                                categories={categories}
                                activeCategory={activeTab.activeCategory}
                                onCategoryChange={(category) => updateActiveTab({ activeCategory: category })}
                            />

                            <div className="flex-1 overflow-auto min-h-0">
                                <ItemsTable
                                    items={filteredItems}
                                    selectedItems={activeTab.selectedItems}
                                    onToggleItem={handleToggleItem}
                                    onToggleAll={handleToggleAll}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-lg bg-green-50 flex items-center justify-center shadow-sm">
                                    <FileText className="w-10 h-10 text-green-600" />
                                </div>
                                <p className="text-lg font-semibold text-foreground mb-2">No Invoice Selected</p>
                                <p className="text-sm text-muted-foreground mb-6">
                                    Open an invoice to start the picking process
                                </p>
                                <Button onClick={() => setIsOpenInvoiceModalOpen(true)} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Open Invoice
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar - positioned absolute within content area */}
            <div className="absolute top-0 right-0 h-full">
                <RightSidebar
                    activeTab={rightSidebarTab}
                    onTabChange={setRightSidebarTab}
                    operations={warehouseOperations}
                    pickSlips={activeTab?.pickSlips || []}
                    onManageOperations={() => { }}
                    orderQueue={orderQueue}
                    onSelectQueueOrder={(item) => handleSelectInvoice(item.invoice)}
                    onRemoveQueueOrder={(id) => setOrderQueue(orderQueue.filter((q) => q.id !== id))}
                    invoices={invoices}
                    onSelectInvoice={handleSelectInvoiceFromModal}
                />
            </div>

            <OpenInvoiceModal
                isOpen={isOpenInvoiceModalOpen}
                onClose={() => setIsOpenInvoiceModalOpen(false)}
                invoices={invoices}
                onSelectInvoice={handleSelectInvoiceFromModal}
            />

            <OrderScheduleModal
                isOpen={isScheduleModalOpen}
                onClose={() => {
                    setIsScheduleModalOpen(false);
                    setPendingInvoice(null);
                }}
                invoice={pendingInvoice}
                onConfirm={handleScheduleConfirm}
            />

            <AssignPickSlipModal
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                selectedItems={selectedItemsForModal}
                warehouses={mockWarehouses}
                pickers={mockPickers}
                onCreatePickSlip={handleCreatePickSlip}
            />
        </div>
    );
};

export default DynamicPickupInterface;

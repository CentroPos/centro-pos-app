import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceItem, PickSlip, ScheduleDetails, WarehouseDetails, WarehouseOperation } from '@renderer/types/picking';
import { InvoiceHeader } from '@renderer/components/picking/InvoiceHeader';
import { CategoryTabs } from '@renderer/components/picking/CategoryTabs';
import { ItemsTable } from '@renderer/components/picking/ItemsTable';
import { RightSidebar } from '@renderer/components/picking/RightSidebar';
import { OpenInvoiceModal } from '@renderer/components/picking/OpenInvoiceModal';
import { AssignPickSlipModal } from '@renderer/components/picking/AssignPickSlipModal';
import { OrderScheduleModal } from '@renderer/components/picking/OrderScheduleModal';
import { AssignWarehousesModal } from '@renderer/components/picking/AssignWarehousesModal';
import { Button } from '@renderer/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { usePickingStore } from '@renderer/store/usePickingStore';

interface LocalTabState {
    selectedItems: Set<string>;
    activeFilter: 'all' | 'unassigned' | 'assigned';
    activeCategory: string;
    searchQuery: string;
}

const DynamicPickupInterface: React.FC = () => {
    // Global State
    const {
        tabs,
        activeTabId,
        warehouses,

        openInvoiceTab,
        closeInvoiceTab,
        setActiveTab,
        fetchGeneralInfo,
    } = usePickingStore();



    // Local UI State
    const [isOpenInvoiceModalOpen, setIsOpenInvoiceModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
    const [pendingInvoice, setPendingInvoice] = useState<Invoice | null>(null);
    const [rightSidebarTab, setRightSidebarTab] = useState<'details' | 'sales' | 'queue' | 'picker-log'>('sales');
    const [editingPickSlip, setEditingPickSlip] = useState<PickSlip | null>(null);

    // Manage per-tab UI state (selection, filters) locally
    const [tabStates, setTabStates] = useState<Record<string, LocalTabState>>({});


    // Helper to get current tab state or default
    const getTabState = (invoiceId: string): LocalTabState => {
        return tabStates[invoiceId] || {
            selectedItems: new Set(),
            activeFilter: 'all',
            activeCategory: 'All Items',
            searchQuery: ''
        };
    };

    const updateLocalTabState = (invoiceId: string, updates: Partial<LocalTabState>) => {
        setTabStates(prev => ({
            ...prev,
            [invoiceId]: { ...getTabState(invoiceId), ...updates }
        }));
    };

    // Derived State
    const activeTabIndex = useMemo(() => tabs.findIndex(t => t.invoice.id === activeTabId), [tabs, activeTabId]);
    const activeTab = activeTabIndex !== -1 ? tabs[activeTabIndex] : null;

    // Initial fetch
    useEffect(() => {
        fetchGeneralInfo();
    }, []);

    // Switch to Queue tab when queue has items (only if it wasn't empty before - optimization to avoid annoying jumps could be added, but keeping logic same as before)
    // Removed queue effect as queue is being removed from store
    // useEffect(() => { ... }, [orderQueue.length]);

    const fetchInvoiceDetails = async (invoice: Invoice) => {
        try {
            const res = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.picking.get_dynamic_pick_details',
                params: {
                    invoice_no: invoice.invoiceNo
                }
            });

            const data = res?.data?.data;
            if (!data) return;

            const invoiceData = data.invoices || {};
            const rawItems = invoiceData.items || [];

            // Map Items
            const mappedItems: InvoiceItem[] = rawItems.map((item: any, index: number) => ({
                id: item.serial_no ? String(item.serial_no) : `${item.item_code}-${index}`,
                slNo: item.serial_no || index + 1,
                itemName: item.item_name,
                itemCode: item.item_code,
                itemPartNo: item.item_part_no,
                category: item.item_category || 'General',
                uom: item.uom,
                quantity: item.quantity,
                packingNo: item.picking_no || '-',
                isAssigned: !!item.picking_no, // Basic check, might be updated by pick slips logic
                status: item.picking_no ? 'assigned' : 'pending',
                pickSlipId: item.picking_no,
                onHand: 0,
                inProcessQty: 0,
                assignedTo: '' // Will be filled from pick slips
            })).filter(item => {
                // Filter out specific unwanted test data as requested
                if (item.itemName.includes('Samsung') && item.itemCode === 'item-00002') return false;
                // Filter out items without valid quantity if needed, but sticking to specific request for now
                return true;
            });

            // Map Pick Slips
            const pickSlips: PickSlip[] = (data.pickings || []).map((p: any) => ({
                id: p.picking_no,
                slipNo: p.picking_no,
                invoiceId: invoice.id,
                warehouseId: '', // Not provided directly in pick object, usually inferred or from data.warehouse?
                warehouseName: p.warehouse,
                pickerId: '', // p.assigned_to is name? or ID? Assuming name for now or we match with pickers list
                pickerName: p.assigned_to,
                items: (p.items || []).map((pi: any) => ({
                    ...mappedItems.find(mi => mi.itemCode === pi.item_code) || {},
                    quantity: pi.quantity
                } as InvoiceItem)),
                status: p.status, // "Draft", etc.
                startTime: p.start_date_time ? new Date(p.start_date_time) : undefined,
                endTime: p.end_date_time ? new Date(p.end_date_time) : undefined,
                print_url: p.picking_slip_url,
                assignedBy: p.assigned_by,
                assignedOn: p.assigned_on ? new Date(p.assigned_on) : undefined
            }));

            // Map Schedule
            const schedule: ScheduleDetails | undefined = data.schedule ? {
                type: data.schedule.type,
                dateTime: data.schedule.date_time ? new Date(data.schedule.date_time) : undefined,
                note: data.schedule.note,
                scheduledBy: data.schedule.scheduled_by,
                scheduledOn: data.schedule.scheduled_on ? new Date(data.schedule.scheduled_on) : undefined,
                modifiedBy: data.schedule.modified_by,
                modifiedOn: data.schedule.modified_on ? new Date(data.schedule.modified_on) : undefined
            } : undefined;

            // Map Warehouse Details
            const warehouseDetails: WarehouseDetails | undefined = data.warehouse ? {
                deliveryWarehouse: data.warehouse.delivery_warehouse,
                assignedBy: data.warehouse.assigned_by,
                assignedOn: data.warehouse.assigned_on ? new Date(data.warehouse.assigned_on) : new Date(),
                modifiedBy: data.warehouse.modified_by,
                modifiedOn: data.warehouse.modified_on ? new Date(data.warehouse.modified_on) : new Date(),
                operations: (data.warehouse.operations || []).map((op: any) => ({
                    warehouseId: '', // Not in response? Using name as ID
                    warehouseName: op.warehouse,
                    type: op.customer_pickup ? 'pickup' : 'transfer', // inferred
                    status: op.status,
                    pickSlips: op.pick_slips || [],
                    isCustomerPickup: op.customer_pickup
                }))
            } : undefined;

            // Updated items assignment status from pick slips
            // (If an item is in a pick slip, it's assigned)
            pickSlips.forEach(slip => {
                slip.items.forEach(pi => {
                    const item = mappedItems.find(i => i.itemCode === pi.itemCode);
                    if (item) {
                        item.isAssigned = true;
                        item.status = 'assigned';
                        item.assignedTo = slip.pickerName;
                        item.pickSlipId = slip.id;
                    }
                });
            });

            const operations = warehouseDetails?.operations || [];

            openInvoiceTab({
                ...invoice,
                customerName: invoiceData.customer_name || invoice.customerName,
                totalAmount: invoiceData.total_amount || invoice.totalAmount
            }, {
                items: mappedItems,
                pickSlips,
                operations,
                schedule,
                warehouseDetails
            });

        } catch (e) {
            console.error("Failed to fetch invoice details", e);
            toast.error("Failed to load invoice details");
        }
    };

    const handleSelectInvoiceFromModal = async (invoice: Invoice) => {
        // Check if invoice is already open
        const existingTab = tabs.find((tab) => tab.invoice.id === invoice.id);
        if (existingTab) {
            setActiveTab(invoice.id);
            setIsOpenInvoiceModalOpen(false);
            setRightSidebarTab('details');
            return;
        }

        if (!invoice.scheduleId) {
            setPendingInvoice(invoice);
            setIsScheduleModalOpen(true);
            setIsOpenInvoiceModalOpen(false);
            setRightSidebarTab('details'); // Optimistic switch
        } else {
            await fetchInvoiceDetails(invoice);
            setIsOpenInvoiceModalOpen(false);
            setRightSidebarTab('details');
        }
    };

    const handleScheduleClick = () => {
        if (!activeTab) return;
        setPendingInvoice(activeTab.invoice);
        setIsScheduleModalOpen(true);
    };

    const handleScheduleConfirm = async (
        scheduleType: 'instant' | 'scheduled',
        scheduledDate?: Date,
        scheduledTime?: string,
        note?: string
    ) => {
        if (!pendingInvoice) return;

        let dateTimeStr = "";
        if (scheduleType === 'scheduled' && scheduledDate && scheduledTime) {
            // Convert 12h time to 24h
            const [time, modifier] = scheduledTime.split(' ');
            let [hours, minutes] = time.split(':');

            if (hours === '12') {
                hours = '00';
            }
            if (modifier === 'PM') {
                hours = (parseInt(hours, 10) + 12).toString();
            }

            const year = scheduledDate.getFullYear();
            const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
            const day = String(scheduledDate.getDate()).padStart(2, '0');

            dateTimeStr = `${year}-${month}-${day} ${hours.padStart(2, '0')}:${minutes}:00`;
        }

        try {
            await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.picking.assign_schedule',
                method: 'POST',
                data: {
                    invoice_no: pendingInvoice.invoiceNo,
                    type: scheduleType,
                    date_time: dateTimeStr,
                    note: note
                }
            });

            toast.success(scheduleType === 'instant' ? 'Order Processed Successfully' : 'Order Scheduled Successfully');

            setPendingInvoice(null);
            setIsScheduleModalOpen(false);

            // Add to queue via store (removed as per request)
            // addToQueue(...) -> API already handled it? 
            // The user said "addToQueue => there is a specific api for list queues... so through add to queue using api no need to queue here"
            // We already called the API above (assign_schedule). So we just refresh via fetchInvoiceDetails?
            // Actually, fetchInvoiceDetails loads the invoice. If it's in queue, maybe we should refresh the queue list?
            // But we don't have a queue list API call exposed here yet (it was in store). 
            // For now, we assume the side effect is handled.

            // Fetch details and open tab
            await fetchInvoiceDetails(pendingInvoice);

        } catch (e) {
            console.error("Failed to schedule order", e);
            toast.error("Failed to schedule order");
        }
    };



    const handleCloseTab = (invoiceId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        closeInvoiceTab(invoiceId);
    };

    const handleToggleItem = (itemId: string) => {
        if (!activeTab) return;
        const currentState = getTabState(activeTab.invoice.id);
        const newSelectedItems = new Set(currentState.selectedItems);

        if (newSelectedItems.has(itemId)) {
            newSelectedItems.delete(itemId);
        } else {
            newSelectedItems.add(itemId);
        }
        updateLocalTabState(activeTab.invoice.id, { selectedItems: newSelectedItems });
    };

    const handleToggleAll = () => {
        if (!activeTab) return;
        const currentState = getTabState(activeTab.invoice.id);
        const filteredItems = getFilteredItems();

        // Only consider unassigned items for selection
        const unassignedFilteredItems = filteredItems.filter(item => item.status !== 'assigned');

        const allSelected = unassignedFilteredItems.length > 0 && unassignedFilteredItems.every((item) => currentState.selectedItems.has(item.id));
        const newSelectedItems = new Set<string>(currentState.selectedItems);

        if (allSelected) {
            // Unselect visible unassigned items
            unassignedFilteredItems.forEach(item => newSelectedItems.delete(item.id));
        } else {
            // Select all visible unassigned items
            unassignedFilteredItems.forEach((item) => newSelectedItems.add(item.id));
        }
        updateLocalTabState(activeTab.invoice.id, { selectedItems: newSelectedItems });
    };

    const handleOpenAssignModal = () => {
        if (activeTab) {
            const state = getTabState(activeTab.invoice.id);
            if (state.selectedItems.size > 0) {
                setIsAssignModalOpen(true);
            }
        }
    };

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (!activeTab || isRefreshing) return;
        setIsRefreshing(true);
        try {
            await fetchInvoiceDetails(activeTab.invoice);
            toast.success("Details refreshed successfully");
        } catch (error) {
            toast.error("Failed to refresh items");
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleFinish = () => {
        if (!activeTab) return;
        const allAssigned = activeTab.items.every((item) => item.status === 'assigned');

        if (allAssigned) {
            setIsFinishModalOpen(true);
        } else {
            alert('Please assign all items before finishing.');
        }
    };



    const handlePickSlipClick = (slip: PickSlip) => {
        setEditingPickSlip(slip);
        setIsAssignModalOpen(true);
    };

    const handleAssignWarehouses = (deliveryWarehouseId: string, operations: WarehouseOperation[]) => {
        // Logic to save/assign warehouses
        // Since no API was provided, we'll log and show a success message
        console.log("Assigning Warehouses:", { deliveryWarehouseId, operations });
        // In a real scenario, we would call an API here to finalize the invoice picking state
        toast.success("Warehouses assigned successfully");
        // Maybe close tab or refresh?
        // if (activeTab) closeInvoiceTab(activeTab.invoice.id);
    };



    const getFilteredItems = (): InvoiceItem[] => {
        if (!activeTab) return [];
        let items = activeTab.items;
        const currentState = getTabState(activeTab.invoice.id);

        // Filter by Search Query
        if (currentState.searchQuery) {
            const query = currentState.searchQuery.toLowerCase();
            items = items.filter(item =>
                item.itemName.toLowerCase().includes(query) ||
                item.itemCode.toLowerCase().includes(query)
            );
        }

        // Filter by assignment status
        if (currentState.activeFilter === 'unassigned') {
            items = items.filter((item) => item.status !== 'assigned');
        } else if (currentState.activeFilter === 'assigned') {
            items = items.filter((item) => item.status === 'assigned');
        }

        // Filter by category
        if (currentState.activeCategory !== 'All Items' && currentState.activeCategory !== 'All') {
            items = items.filter((item) => item.category === currentState.activeCategory);
        }

        return items;
    };

    // Memoize filtered items to prevent unnecessary re-renders
    const filteredItems = useMemo(() => getFilteredItems(), [
        activeTab,
        tabStates[activeTabId ?? '']?.activeFilter,
        tabStates[activeTabId ?? '']?.activeCategory,
        tabStates[activeTabId ?? '']?.searchQuery, // Added searchQuery to dependencies
        activeTab?.items
    ]);

    const categories = useMemo(() => {
        if (!activeTab) return [];

        const allItems = activeTab.items;
        const currentState = getTabState(activeTab.invoice.id);

        // Base items for count - should we count filtered items or all items?
        // Typically category counts show total available in that category regardless of other filters (like assignment status),
        // BUT search query usually restricts everything.
        // Let's filter by search query first to give relevant counts.
        let baseItems = allItems;
        if (currentState.searchQuery) {
            const query = currentState.searchQuery.toLowerCase();
            baseItems = baseItems.filter(item =>
                item.itemName.toLowerCase().includes(query) ||
                item.itemCode.toLowerCase().includes(query)
            );
        }

        // Calculate counts
        const counts: Record<string, number> = {};
        baseItems.forEach(item => {
            const cat = item.category || 'General';
            counts[cat] = (counts[cat] || 0) + 1;
        });

        const distinctCategories = ['All Items', ...new Set(allItems.map((item) => item.category || 'General'))];

        return distinctCategories.map(cat => ({
            label: cat,
            count: cat === 'All Items' ? baseItems.length : (counts[cat] || 0)
        }));
    }, [activeTab?.items, tabStates[activeTabId ?? '']?.searchQuery]);

    const currentState = activeTab ? getTabState(activeTab.invoice.id) : null;
    const allCount = activeTab?.items.length || 0;
    const unassignedCount = activeTab?.items.filter((item) => item.status !== 'assigned').length || 0;
    const assignedCount = activeTab?.items.filter((item) => item.status === 'assigned').length || 0;
    const hasSelection = (currentState?.selectedItems.size || 0) > 0;
    const canFinish = assignedCount === allCount && allCount > 0;

    console.log('SHD =>', usePickingStore());

    return (
        <div className="h-full w-full flex bg-gray-50 overflow-hidden relative">
            {/* Left Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 mr-[450px]">
                {/* Top Header Line: Open INV button and Invoice tabs */}
                <div className="border-b border-border bg-card px-3 py-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setIsOpenInvoiceModalOpen(true)}
                            className="px-2 py-1.5 bg-gradient-to-r from-primary to-slate-700 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 text-[10px]"
                        >
                            <Plus className="w-3 h-3" />
                            Open INV
                        </Button>
                        {tabs.length > 0 && (
                            <div className="flex gap-2">
                                {tabs.map((tab) => (
                                    <div
                                        key={tab.invoice.id}
                                        onClick={() => setActiveTab(tab.invoice.id)}
                                        className={`flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 text-xs border ${activeTabId === tab.invoice.id
                                            ? 'bg-white text-gray-900 font-bold shadow-sm shadow-gray-300 border-primary'
                                            : 'bg-white/60 text-gray-800 hover:bg-white/80 border-transparent'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            {activeTabId === tab.invoice.id && (
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-300" />
                                            )}
                                            {tab.invoice.invoiceNo}
                                        </span>
                                        <button
                                            onClick={(e) => handleCloseTab(tab.invoice.id, e)}
                                            className="ml-2 text-gray-400 hover:text-red-500 text-base leading-none"
                                            title="Close tab"
                                        >
                                            ×
                                        </button>
                                    </div>
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
                                schedule={activeTab.schedule}
                                allCount={allCount}
                                unassignedCount={unassignedCount}
                                assignedCount={assignedCount}
                                activeFilter={currentState?.activeFilter || 'all'}
                                onFilterChange={(filter) => updateLocalTabState(activeTab.invoice.id, { activeFilter: filter })}
                                onAssign={handleOpenAssignModal}
                                onFinish={handleFinish}
                                hasSelection={hasSelection}
                                canFinish={canFinish}
                                onScheduleClick={handleScheduleClick}
                            />

                            <CategoryTabs
                                categories={categories}
                                activeCategory={currentState?.activeCategory || 'All Items'}
                                onCategoryChange={(category) => updateLocalTabState(activeTab.invoice.id, { activeCategory: category })}
                                searchQuery={currentState?.searchQuery || ''}
                                onSearchChange={(query) => updateLocalTabState(activeTab.invoice.id, { searchQuery: query })}
                                onRefresh={handleRefresh}
                                isRefreshing={isRefreshing}
                            />

                            <div className="flex-1 overflow-auto min-h-0">
                                <ItemsTable
                                    items={filteredItems}
                                    selectedItems={currentState?.selectedItems || new Set()}
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
                    operations={activeTab?.warehouseDetails?.operations || []}
                    pickSlips={activeTab?.pickSlips || []}
                    onManageOperations={() => setIsFinishModalOpen(true)}
                    orderQueue={[]} // Removed orderQueue from store
                    onSelectQueueOrder={(item) => openInvoiceTab(item.invoice)}
                    onRemoveQueueOrder={(_id) => { }} // Removed removeFromQueue
                    onSelectInvoice={handleSelectInvoiceFromModal}
                    onPickSlipClick={handlePickSlipClick}
                />
            </div>

            <OpenInvoiceModal
                isOpen={isOpenInvoiceModalOpen}
                onClose={() => setIsOpenInvoiceModalOpen(false)}
                onSelectInvoice={handleSelectInvoiceFromModal}
            />

            <OrderScheduleModal
                isOpen={isScheduleModalOpen}
                onClose={() => {
                    setIsScheduleModalOpen(false);
                    setPendingInvoice(null);
                }}
                invoice={pendingInvoice}
                schedule={pendingInvoice?.id === activeTab?.invoice.id ? activeTab?.schedule : undefined}
                onConfirm={handleScheduleConfirm}
            />

            <AssignPickSlipModal
                isOpen={isAssignModalOpen}
                onClose={() => {
                    setIsAssignModalOpen(false);
                    setEditingPickSlip(null);
                }}
                selectedItems={isAssignModalOpen && editingPickSlip
                    ? editingPickSlip.items
                    : activeTab
                        ? Array.from(currentState?.selectedItems || [])
                            .map((id) => activeTab.items.find((item) => item.id === id))
                            .filter((item): item is InvoiceItem => !!item)
                        : []
                }
                warehouses={warehouses}
                invoiceNo={activeTab?.invoice.invoiceNo || ''}
                existingPickSlip={editingPickSlip}
                onSuccess={() => {
                    if (activeTab) fetchInvoiceDetails(activeTab.invoice);
                    if (!editingPickSlip && activeTab) {
                        // Clear selection if it was a new assignment
                        updateLocalTabState(activeTab.invoice.id, { selectedItems: new Set() });
                    }
                }}
            />

            <AssignWarehousesModal
                isOpen={isFinishModalOpen}
                onClose={() => setIsFinishModalOpen(false)}
                onAssign={handleAssignWarehouses}
                warehouses={warehouses}
                currentOperations={activeTab?.warehouseDetails?.operations || []}
                invoiceNo={activeTab?.invoice.invoiceNo || ''}
            />
        </div>
    );
};

export default DynamicPickupInterface;

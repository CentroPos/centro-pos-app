export interface InvoiceItem {
  id: string;
  slNo: number;
  itemName: string;
  itemCode: string;
  category: string;
  uom: string;
  quantity: number;
  packingNo: string;
  isAssigned: boolean;
  pickSlipId?: string;
  onHand: number;
  inProcessQty: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  items: InvoiceItem[];
}

export interface Picker {
  id: string;
  name: string;
}

export interface Warehouse {
  id: string;
  name: string;
  type: 'main' | 'depot' | 'delivery';
}

export interface PickSlip {
  id: string;
  slipNo: string;
  warehouseId: string;
  warehouseName: string;
  pickerId: string;
  pickerName: string;
  items: InvoiceItem[];
  status: 'not-started' | 'in-progress' | 'picked';
  startTime?: Date;
  pickedTime?: Date;
  durationMinutes?: number;
}

export interface WarehouseOperation {
  warehouseId: string;
  warehouseName: string;
  type: 'pickup' | 'transfer';
  status: 'draft' | 'confirmed';
  pickSlips: string[];
  isCustomerPickup: boolean;
}

export interface OrderQueueItem {
  id: string;
  invoice: Invoice;
  scheduleType: 'instant' | 'scheduled';
  scheduledDate?: Date;
  scheduledTime?: string;
  note?: string;
  createdAt: Date;
  priority: number;
}


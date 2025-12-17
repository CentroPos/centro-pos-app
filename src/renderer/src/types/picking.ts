export interface InvoiceItem {
  id: string;
  slNo: number;
  itemName: string;
  itemCode: string;
  itemPartNo?: string;
  category: string;
  uom: string;
  quantity: number;
  packingNo: string;
  pickingNo?: string;
  isAssigned: boolean;
  status?: 'pending' | 'assigned' | 'picked';
  pickSlipId?: string;
  onHand: number;
  inProcessQty: number;
  assignedTo?: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  items: InvoiceItem[];
  invoiceDate?: string;
  status?: string;
  returnStatus?: string;
  scheduleId?: string;
}

export interface Picker {
  id: string; // mapped from name or picker_no
  name: string;
  picker_no?: string;
}

export interface Warehouse {
  id: string; // mapped from name
  name: string;
  type: string | null;
  is_delivery_warehouse: boolean;
  is_sales_warehouse: boolean;
  pickers: Picker[];
}

export interface GeneralInfoResponse {
  data: {
    warehouses: {
      name: string;
      type: string | null;
      is_delivery_warehouse: boolean;
      is_sales_warehouse: boolean;
      pickers: {
        name: string;
        picker_no: string;
      }[];
    }[];
  };
}

export interface PickSlip {
  id: string;
  slipNo: string;
  invoiceId: string;
  warehouseId: string;
  warehouseName: string;
  pickerId: string;
  pickerName: string;
  items: InvoiceItem[];
  status: 'not-started' | 'in-progress' | 'picked' | 'Draft' | 'Completed';
  createdAt?: Date;
  startTime?: Date;
  endTime?: Date;
  pickedTime?: Date;
  durationMinutes?: number;
  print_url?: string;
  assignedBy?: string;
  assignedOn?: Date;
}

export interface ScheduleDetails {
  type: 'instant' | 'scheduled';
  dateTime?: Date;
  note?: string;
  scheduledBy?: string;
  scheduledOn?: Date;
  modifiedBy?: string;
  modifiedOn?: Date;
}

export interface WarehouseDetails {
  deliveryWarehouse: string;
  assignedBy: string;
  assignedOn: Date;
  modifiedBy: string;
  modifiedOn: Date;
  operations: WarehouseOperation[];
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

export interface QueueOrder {
  type: 'instant' | 'scheduled';
  invoice_no: string;
  sales_order_id: string;
  customer_name: string;
  total_amount: number;
  item_count: number;
  order_status: string; // 'Overdue' | 'Paid' | 'Unpaid'
  reverse_status: string; // 'No' | 'Partial Reversed' | 'Fully Reversed'
  invoice_creation: string;
  note: string;
  status: string; // 'not-delivered' | 'partial-delivered' | 'delivered'
  date_time: string;
  scheduled_by: string;
  scheduled_on: string;
  modified_by: string;
  modified_on: string;
}


import { Invoice, Picker, Warehouse } from '@renderer/types/picking';

export const mockInvoices: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNo: 'INV001203',
    customerName: 'ABC Customer XY',
    totalAmount: 125300.00,
    currency: 'SAR',
    items: [
      { id: '1', slNo: 1, itemName: 'Coca Cola 330ml', itemCode: '126553', category: 'Drinks', uom: 'CTN', quantity: 20, packingNo: 'PCK-1001', isAssigned: false, onHand: 150, inProcessQty: 30 },
      { id: '2', slNo: 2, itemName: 'Pepsi 500ml', itemCode: '126554', category: 'Drinks', uom: 'CTN', quantity: 15, packingNo: 'PCK-1002', isAssigned: false, onHand: 200, inProcessQty: 45 },
      { id: '3', slNo: 3, itemName: 'Sprite 330ml', itemCode: '126555', category: 'Drinks', uom: 'CTN', quantity: 10, packingNo: 'PCK-1003', isAssigned: false, onHand: 80, inProcessQty: 10 },
    ]
  },
  {
    id: 'inv-2',
    invoiceNo: 'INV001204',
    customerName: 'XYZ Trading Co',
    totalAmount: 89500.00,
    currency: 'SAR',
    items: [
      { id: '21', slNo: 1, itemName: 'White Rice 10kg', itemCode: '126590', category: 'Rice', uom: 'BAG', quantity: 100, packingNo: 'PCK-2001', isAssigned: false, onHand: 450, inProcessQty: 80 },
      { id: '22', slNo: 2, itemName: 'Iced Tea Lemon', itemCode: '126591', category: 'Tea', uom: 'BTL', quantity: 50, packingNo: 'PCK-2002', isAssigned: false, onHand: 180, inProcessQty: 25 },
    ]
  },
  {
    id: 'inv-3',
    invoiceNo: 'INV001205',
    customerName: 'Gulf Foods LLC',
    totalAmount: 156200.00,
    currency: 'SAR',
    items: [
      { id: '31', slNo: 1, itemName: 'Premium Coffee Beans', itemCode: '126600', category: 'Coffee', uom: 'BAG', quantity: 40, packingNo: 'PCK-3001', isAssigned: false, onHand: 120, inProcessQty: 20 },
      { id: '32', slNo: 2, itemName: 'Instant Coffee 200g', itemCode: '126601', category: 'Coffee', uom: 'JAR', quantity: 80, packingNo: 'PCK-3002', isAssigned: false, onHand: 300, inProcessQty: 50 },
      { id: '33', slNo: 3, itemName: 'Espresso Pods', itemCode: '126602', category: 'Coffee', uom: 'BOX', quantity: 120, packingNo: 'PCK-3003', isAssigned: false, onHand: 400, inProcessQty: 80 },
      { id: '34', slNo: 4, itemName: 'Sparkling Water 500ml', itemCode: '126603', category: 'Drinks', uom: 'BTL', quantity: 200, packingNo: 'PCK-3004', isAssigned: false, onHand: 800, inProcessQty: 150 },
    ]
  },
];

export const mockPickers: Picker[] = [
  { id: 'p1', name: 'Yusuf' },
  { id: 'p2', name: 'Abin' },
  { id: 'p3', name: 'Khader' },
  { id: 'p4', name: 'Chottu' },
];

export const mockWarehouses: Warehouse[] = [
  { id: 'wh1', name: 'Main WH', type: 'main' },
  { id: 'wh2', name: 'Depot 1', type: 'depot' },
  { id: 'wh3', name: 'Depot 2', type: 'depot' },
  { id: 'wh4', name: 'Delivery WH', type: 'delivery' },
];


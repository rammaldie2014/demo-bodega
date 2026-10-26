export type PaymentMethod = 'cash' | 'yape' | 'plin';
export interface Product {
  id: string;
  barcode?: string;
  name: string;
  categoryId?: string;
  purchasePriceCents: number;
  salePriceCents: number;
  stock: number;
  minimumStock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  unitName?: string;
  icon?: string;
  favorite?: boolean;
  quickOrder?: number;
  presentations?: ProductPresentation[];
}
export interface ProductPresentation {
  id: string;
  productId: string;
  name: string;
  unitsPerPresentation: number;
  salePriceCents?: number;
  barcode?: string;
  active: boolean;
}
export interface Promotion {
  id: string;
  productId: string;
  presentationId: string;
  groupQuantity: number;
  groupPriceCents: number;
  active: boolean;
}
export interface StockReceipt {
  productId: string;
  presentationId?: string;
  quantity: number;
  totalCostCents: number;
}
export interface Category {
  id: string;
  name: string;
  symbol: string;
  color: string;
}
export interface SaleLine {
  id: string;
  saleId: string;
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  presentationId?: string;
  presentationName?: string;
  unitsPerPresentation?: number;
  baseQuantity?: number;
  discountCents?: number;
  totalCents?: number;
  promotionId?: string;
  promotionGroupQuantity?: number;
  promotionGroupPriceCents?: number;
}
export interface Sale {
  id: string;
  number: string;
  sessionId: string;
  createdAt: string;
  totalCents: number;
  method: PaymentMethod;
  receivedCents: number;
  changeCents: number;
  simulated: boolean;
}
export interface InventoryMovement {
  id: string;
  productId: string;
  type: 'initial' | 'sale' | 'adjustment' | 'receipt' | 'waste';
  quantity: number;
  previousStock: number;
  nextStock: number;
  reason: string;
  createdAt: string;
  saleId?: string;
  presentationName?: string;
  presentationQuantity?: number;
  unitsPerPresentation?: number;
  totalCostCents?: number;
}
export interface CashSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingCents: number;
  countedCents?: number;
  expectedCents?: number;
  differenceCents?: number;
  status: 'open' | 'closed';
}
export interface Settings {
  id: 'demo';
  seeded: boolean;
  scanWithEnter: boolean;
  saleSequence: number;
  hu2Seeded?: boolean;
}
export interface Snapshot {
  products: Product[];
  categories: Category[];
  sales: Sale[];
  lines: SaleLine[];
  movements: InventoryMovement[];
  sessions: CashSession[];
  settings: Settings;
  promotions: Promotion[];
}
export interface CartItem {
  productId: string;
  quantity: number;
  presentationId?: string;
}
export interface Checkout {
  items: CartItem[];
  method: PaymentMethod;
  receivedCents: number;
  simulationConfirmed: boolean;
}
export type ProductInput = Pick<
  Product,
  | 'barcode'
  | 'name'
  | 'categoryId'
  | 'purchasePriceCents'
  | 'salePriceCents'
  | 'stock'
  | 'minimumStock'
  | 'active'
  | 'unitName'
  | 'icon'
  | 'favorite'
  | 'quickOrder'
  | 'presentations'
>;
export const paymentNames: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  yape: 'Yape · simulado',
  plin: 'Plin · simulado',
};

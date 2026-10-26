import {
  CashSession,
  Checkout,
  Product,
  ProductInput,
  Sale,
  Settings,
  Snapshot,
  Promotion,
  StockReceipt,
} from './models';
export abstract class BodegaRepository {
  abstract initialize(): Promise<void>;
  abstract snapshot(): Promise<Snapshot>;
  abstract watch(next: (snapshot: Snapshot) => void, error: (error: unknown) => void): () => void;
  abstract saveProduct(input: ProductInput, id?: string): Promise<Product>;
  abstract adjustStock(id: string, nextStock: number, reason: string): Promise<void>;
  abstract openCash(openingCents: number): Promise<CashSession>;
  abstract closeCash(id: string, countedCents: number): Promise<CashSession>;
  abstract checkout(input: Checkout): Promise<Sale>;
  abstract saveSettings(input: Pick<Settings, 'scanWithEnter'>): Promise<void>;
  abstract restoreDemo(): Promise<void>;
  abstract savePromotion(input: Omit<Promotion, 'id'>, id?: string): Promise<Promotion>;
  abstract receiveStock(input: StockReceipt): Promise<void>;
  abstract recordWaste(productId: string, quantity: number, reason: string): Promise<void>;
}

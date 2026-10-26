import Dexie, { Table } from 'dexie';
import {
  CashSession,
  Category,
  InventoryMovement,
  Product,
  Sale,
  SaleLine,
  Settings,
  Promotion,
} from '../domain/models';
export class BodegaDatabase extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  sales!: Table<Sale, string>;
  lines!: Table<SaleLine, string>;
  movements!: Table<InventoryMovement, string>;
  sessions!: Table<CashSession, string>;
  settings!: Table<Settings, string>;
  promotions!: Table<Promotion, string>;
  constructor(name = 'mi-bodega-pos') {
    super(name);
    this.version(1).stores({
      products: 'id,&barcode,name,categoryId',
      categories: 'id',
      sales: 'id,&number,sessionId,createdAt,method',
      lines: 'id,saleId,productId',
      movements: 'id,productId,createdAt,saleId',
      sessions: 'id,status',
      settings: 'id',
    });
    this.version(2)
      .stores({
        products: 'id,&barcode,name,categoryId,updatedAt',
        movements: 'id,productId,createdAt,saleId,type',
      })
      .upgrade((tx) =>
        tx
          .table('products')
          .toCollection()
          .modify((product) => {
            product.updatedAt ??= product.createdAt;
          }),
      );
    this.version(3)
      .stores({ promotions: 'id,productId,presentationId,[productId+presentationId]' })
      .upgrade((tx) =>
        tx
          .table('products')
          .toCollection()
          .modify((product) => {
            product.unitName ??= 'Unidad';
            product.favorite ??= false;
            product.presentations ??= [];
          }),
      );
  }
}

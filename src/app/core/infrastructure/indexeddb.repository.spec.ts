import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { BodegaDatabase } from './database';
import { IndexedDbRepository } from './indexeddb.repository';
import { Product, ProductInput } from '../domain/models';
describe('IndexedDB, integración de negocio y transacciones', () => {
  let db: BodegaDatabase;
  let repo: IndexedDbRepository;
  let product: Product;
  const input: ProductInput = {
    name: 'Producto de prueba',
    barcode: 'TEST-001',
    categoryId: 'bebidas',
    purchasePriceCents: 100,
    salePriceCents: 250,
    stock: 10,
    minimumStock: 2,
    active: true,
  };
  beforeEach(async () => {
    db = new BodegaDatabase('test-' + crypto.randomUUID());
    repo = new IndexedDbRepository(db);
    await repo.initialize();
    product = (await repo.snapshot()).products.find((p) => p.barcode === 'DEMO-001')!;
  });
  afterEach(async () => {
    await db.delete();
  });
  const payment = (id: string) => ({
    items: [{ productId: id, quantity: 2 }],
    method: 'cash' as const,
    receivedCents: 5000,
    simulationConfirmed: false,
  });
  it('crea producto válido y registra stock inicial', async () => {
    const p = await repo.saveProduct(input);
    expect(p.id).toMatch(/^[\da-f-]{36}$/);
    expect((await db.movements.where('productId').equals(p.id).first())?.nextStock).toBe(10);
  });
  it('rechaza precios negativos sin persistir', async () => {
    await expect(repo.saveProduct({ ...input, purchasePriceCents: -1 })).rejects.toThrow();
    expect(await db.products.where('barcode').equals('TEST-001').count()).toBe(0);
  });
  it('rechaza código duplicado incluso entre inactivos', async () => {
    await repo.saveProduct({ ...product, active: false }, product.id);
    await expect(repo.saveProduct({ ...input, barcode: product.barcode })).rejects.toThrow(
      'ya está',
    );
  });
  it('permite varios productos sin código', async () => {
    await repo.saveProduct({ ...input, barcode: undefined });
    await repo.saveProduct({ ...input, name: 'Otro', barcode: undefined });
    expect(await db.products.count()).toBe(44);
  });
  it('actualiza y desactiva conservando identidad', async () => {
    await repo.saveProduct({ ...product, name: 'Gaseosa editada', active: false }, product.id);
    expect(await db.products.get(product.id)).toMatchObject({
      name: 'Gaseosa editada',
      active: false,
    });
  });
  it('exige ajustes trazables para cambios de stock', async () => {
    await expect(repo.saveProduct({ ...product, stock: 1 }, product.id)).rejects.toThrow('ajuste');
    await repo.adjustStock(product.id, 3, 'Merma de prueba');
    expect((await db.products.get(product.id))?.stock).toBe(3);
    expect(await db.movements.where('type').equals('adjustment').count()).toBe(1);
  });
  it('rechaza ajuste negativo o sin motivo', async () => {
    await expect(repo.adjustStock(product.id, -1, 'Merma')).rejects.toThrow();
    await expect(repo.adjustStock(product.id, 3, '')).rejects.toThrow();
  });
  it('abre caja y rechaza doble apertura', async () => {
    await repo.openCash(10000);
    await expect(repo.openCash(0)).rejects.toThrow('Ya existe');
    expect(await db.sessions.count()).toBe(1);
  });
  it('serializa apertura simultánea entre conexiones', async () => {
    const other = new IndexedDbRepository(new BodegaDatabase(db.name));
    try {
      const results = await Promise.allSettled([repo.openCash(0), other.openCash(0)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await db.sessions.where('status').equals('open').count()).toBe(1);
    } finally {
      other.db.close();
    }
  });
  it('impide vender sin caja abierta', async () => {
    await expect(repo.checkout(payment(product.id))).rejects.toThrow('Abre la caja');
    expect(await db.sales.count()).toBe(0);
  });
  it('registra venta, detalle, stock y movimiento', async () => {
    await repo.openCash(10000);
    const sale = await repo.checkout(payment(product.id));
    expect(sale.totalCents).toBe(700);
    expect(sale.changeCents).toBe(4300);
    expect(sale.number).toBe('V-000001');
    expect((await db.products.get(product.id))?.stock).toBe(38);
    expect(await db.lines.where('saleId').equals(sale.id).count()).toBe(1);
    expect((await db.movements.where('saleId').equals(sale.id).first())?.quantity).toBe(-2);
  });
  it('rechaza efectivo insuficiente y no descuenta', async () => {
    await repo.openCash(0);
    await expect(repo.checkout({ ...payment(product.id), receivedCents: 1 })).rejects.toThrow(
      'insuficiente',
    );
    expect((await db.products.get(product.id))?.stock).toBe(40);
  });
  it('vuelve a validar stock dentro de la transacción', async () => {
    await repo.openCash(0);
    await repo.adjustStock(product.id, 1, 'Prueba de concurrencia');
    const other = new IndexedDbRepository(new BodegaDatabase(db.name));
    const pay = { ...payment(product.id), items: [{ productId: product.id, quantity: 1 }] };
    try {
      const results = await Promise.allSettled([repo.checkout(pay), other.checkout(pay)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await db.products.get(product.id))?.stock).toBe(0);
      expect(await db.sales.count()).toBe(1);
    } finally {
      other.db.close();
    }
  });
  it('revierte TODA la venta si falla el registro de movimiento', async () => {
    await repo.openCash(0);
    const fail = (_key: unknown, m: { type: string }) => {
      if (m.type === 'sale') throw new Error('Fallo de almacenamiento inducido');
    };
    db.movements.hook('creating', fail);
    await expect(repo.checkout(payment(product.id))).rejects.toThrow('inducido');
    db.movements.hook('creating').unsubscribe(fail);
    expect(await db.sales.count()).toBe(0);
    expect(await db.lines.count()).toBe(0);
    expect((await db.products.get(product.id))?.stock).toBe(40);
    expect((await db.settings.get('demo'))?.saleSequence).toBe(0);
  });
  it('conserva nombre y precio históricos', async () => {
    await repo.openCash(0);
    const sale = await repo.checkout(payment(product.id));
    const updated = (await db.products.get(product.id))!;
    await repo.saveProduct({ ...updated, name: 'Otro nombre', salePriceCents: 9999 }, product.id);
    expect(await db.lines.where('saleId').equals(sale.id).first()).toMatchObject({
      name: product.name,
      unitPriceCents: 350,
    });
  });
  it.each(['yape', 'plin'] as const)(
    'registra %s exclusivamente como simulación',
    async (method) => {
      await repo.openCash(10000);
      await expect(repo.checkout({ ...payment(product.id), method })).rejects.toThrow('simulación');
      const sale = await repo.checkout({
        ...payment(product.id),
        method,
        simulationConfirmed: true,
      });
      expect(sale.simulated).toBe(true);
      const cash = (await db.sessions.toArray())[0];
      const closed = await repo.closeCash(cash.id, 10000);
      expect(closed.expectedCents).toBe(10000);
    },
  );
  it('cierra caja, calcula diferencia e impide modificarla', async () => {
    const cash = await repo.openCash(10000);
    await repo.checkout(payment(product.id));
    const closed = await repo.closeCash(cash.id, 10600);
    expect(closed.expectedCents).toBe(10700);
    expect(closed.differenceCents).toBe(-100);
    await expect(repo.closeCash(cash.id, 0)).rejects.toThrow('cerrada');
    await expect(repo.checkout(payment(product.id))).rejects.toThrow('Abre');
  });
  it('rechaza carrito vacío, repetido o producto inactivo', async () => {
    await repo.openCash(0);
    await expect(repo.checkout({ ...payment(product.id), items: [] })).rejects.toThrow();
    await expect(
      repo.checkout({
        ...payment(product.id),
        items: [
          { productId: product.id, quantity: 1 },
          { productId: product.id, quantity: 1 },
        ],
      }),
    ).rejects.toThrow('duplicados');
    await repo.saveProduct({ ...product, active: false }, product.id);
    await expect(repo.checkout(payment(product.id))).rejects.toThrow('disponible');
  });
  it('recupera productos y ventas tras cerrar y reabrir IndexedDB', async () => {
    await repo.openCash(0);
    await repo.checkout(payment(product.id));
    db.close();
    db = new BodegaDatabase(db.name);
    repo = new IndexedDbRepository(db);
    await repo.initialize();
    expect((await repo.snapshot()).sales).toHaveLength(1);
    expect((await db.products.get(product.id))?.stock).toBe(38);
  });
  it('no duplica semillas al inicializar dos veces', async () => {
    await repo.initialize();
    expect(await db.products.count()).toBe(42);
    expect(await db.categories.count()).toBe(7);
    expect(await db.movements.count()).toBe(42);
  });
  it('restaura datos y preferencias de forma atómica', async () => {
    await repo.openCash(0);
    await repo.checkout(payment(product.id));
    await repo.saveSettings({ scanWithEnter: false });
    await repo.restoreDemo();
    const state = await repo.snapshot();
    expect(state.products).toHaveLength(42);
    expect(state.sales).toHaveLength(0);
    expect(state.sessions).toHaveLength(0);
    expect(state.settings.scanWithEnter).toBe(true);
  });
  it('migra una base real v1 a v3 conservando datos', async () => {
    const name = 'migration-' + crypto.randomUUID();
    const old = new Dexie(name);
    old.version(1).stores({
      products: 'id,&barcode,name,categoryId',
      categories: 'id',
      sales: 'id,&number,sessionId,createdAt,method',
      lines: 'id,saleId,productId',
      movements: 'id,productId,createdAt,saleId',
      sessions: 'id,status',
      settings: 'id',
    });
    await old.table('products').add({ ...product, updatedAt: undefined });
    old.close();
    const migrated = new BodegaDatabase(name);
    try {
      await migrated.open();
      expect(migrated.verno).toBe(3);
      expect((await migrated.products.get(product.id))?.updatedAt).toBe(product.createdAt);
      expect(migrated.products.schema.indexes.some((i) => i.name === 'updatedAt')).toBe(true);
    } finally {
      await migrated.delete();
    }
  });
});

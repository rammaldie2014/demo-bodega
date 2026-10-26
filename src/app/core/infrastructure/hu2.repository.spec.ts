import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { BodegaDatabase } from './database';
import { IndexedDbRepository } from './indexeddb.repository';
import { Product, Promotion } from '../domain/models';

describe('HU-002: persistencia compatible y flujos de demostración', () => {
  let db: BodegaDatabase;
  let repo: IndexedDbRepository;
  let candy: Product;
  let offer: Omit<Promotion, 'id'>;
  beforeEach(async () => {
    db = new BodegaDatabase('hu2-' + crypto.randomUUID());
    repo = new IndexedDbRepository(db);
    await repo.initialize();
    candy = (await db.products.toArray()).find((p) => p.name === 'Caramelo surtido')!;
    offer = {
      productId: candy.id,
      presentationId: 'base',
      groupQuantity: 3,
      groupPriceCents: 50,
      active: true,
    };
  });
  afterEach(async () => {
    await db.delete();
  });
  it('registra producto sin código con unidad y bolsa', async () => {
    const p = await repo.saveProduct({
      ...candy,
      id: undefined,
      name: 'Caramelo nuevo',
      stock: 0,
      presentations: [
        {
          id: crypto.randomUUID(),
          productId: '',
          name: 'Bolsa x50',
          unitsPerPresentation: 50,
          active: true,
        },
      ],
    } as Product);
    expect(p.barcode).toBeUndefined();
    expect(p.presentations?.[0].productId).toBe(p.id);
  });
  it('flujo: 3 bolsas, 7 caramelos promocionados, 3 dañados → stock 290', async () => {
    const bag = candy.presentations![0];
    await repo.receiveStock({
      productId: candy.id,
      presentationId: bag.id,
      quantity: 3,
      totalCostCents: 3600,
    });
    expect(await db.products.get(candy.id)).toMatchObject({ stock: 300, purchasePriceCents: 12 });
    await repo.savePromotion(offer);
    await repo.openCash(10000);
    const sale = await repo.checkout({
      items: [{ productId: candy.id, quantity: 7 }],
      method: 'yape',
      receivedCents: 0,
      simulationConfirmed: true,
    });
    expect(sale.totalCents).toBe(120);
    expect((await db.products.get(candy.id))?.stock).toBe(293);
    const line = await db.lines.where('saleId').equals(sale.id).first();
    expect(line).toMatchObject({
      subtotalCents: 140,
      discountCents: 20,
      totalCents: 120,
      baseQuantity: 7,
      presentationName: 'Unidad',
    });
    await repo.recordWaste(candy.id, 3, 'Producto dañado');
    expect((await db.products.get(candy.id))?.stock).toBe(290);
    expect(await db.movements.where('productId').equals(candy.id).count()).toBe(4);
  });
  it('vende un pack y unidades sueltas sin sobrescribir el descuento de stock', async () => {
    const cola = (await db.products.toArray()).find((p) => p.barcode === 'DEMO-001')!;
    await repo.openCash(0);
    const sale = await repo.checkout({
      items: [
        { productId: cola.id, quantity: 1, presentationId: cola.presentations![0].id },
        { productId: cola.id, quantity: 2 },
      ],
      method: 'cash',
      receivedCents: 5000,
      simulationConfirmed: false,
    });
    expect(sale.totalCents).toBe(2300);
    expect((await db.products.get(cola.id))?.stock).toBe(32);
    const movements = await db.movements.where('saleId').equals(sale.id).toArray();
    expect(movements.map((m) => m.quantity).sort()).toEqual([-2, -6]);
  });
  it('impide sobreventa entre presentaciones dentro de la transacción', async () => {
    const cola = (await db.products.toArray()).find((p) => p.barcode === 'DEMO-001')!;
    await repo.adjustStock(cola.id, 6, 'Prueba de pack');
    await repo.openCash(0);
    await expect(
      repo.checkout({
        items: [
          { productId: cola.id, quantity: 1, presentationId: cola.presentations![0].id },
          { productId: cola.id, quantity: 1 },
        ],
        method: 'cash',
        receivedCents: 5000,
        simulationConfirmed: false,
      }),
    ).rejects.toThrow('stock');
    expect(await db.sales.count()).toBe(0);
    expect((await db.products.get(cola.id))?.stock).toBe(6);
  });
  it('permite solo una promoción activa por presentación', async () => {
    const p = await repo.savePromotion(offer);
    await expect(repo.savePromotion(offer)).rejects.toThrow('Ya existe');
    await repo.savePromotion({ ...offer, active: false }, p.id);
    await repo.savePromotion(offer);
    expect(await db.promotions.count()).toBe(2);
  });
  it('rechaza precios negativos, grupos pequeños, fracciones y recargos', async () => {
    for (const patch of [
      { groupPriceCents: -1 },
      { groupQuantity: 1 },
      { groupQuantity: 2.5 },
      { groupPriceCents: 61 },
    ])
      await expect(repo.savePromotion({ ...offer, ...patch })).rejects.toThrow();
  });
  it('recalcula al desactivar promoción y conserva precio/promoción histórica', async () => {
    await repo.receiveStock({
      productId: candy.id,
      presentationId: candy.presentations![0].id,
      quantity: 1,
      totalCostCents: 1200,
    });
    const p = await repo.savePromotion(offer);
    await repo.openCash(0);
    const payment = {
      items: [{ productId: candy.id, quantity: 7 }],
      method: 'cash' as const,
      receivedCents: 1000,
      simulationConfirmed: false,
    };
    const first = await repo.checkout(payment);
    await repo.savePromotion({ ...offer, active: false }, p.id);
    const second = await repo.checkout(payment);
    expect(first.totalCents).toBe(120);
    expect(second.totalCents).toBe(140);
    expect(
      (await db.lines.where('saleId').equals(first.id).first())?.promotionGroupPriceCents,
    ).toBe(50);
  });
  it('conserva presentación histórica aunque cambie después', async () => {
    const cola = (await db.products.toArray()).find((p) => p.barcode === 'DEMO-001')!;
    const pack = cola.presentations![0];
    await repo.openCash(0);
    const sale = await repo.checkout({
      items: [{ productId: cola.id, presentationId: pack.id, quantity: 1 }],
      method: 'cash',
      receivedCents: 2000,
      simulationConfirmed: false,
    });
    const current = (await db.products.get(cola.id))!;
    await repo.saveProduct(
      {
        ...current,
        presentations: [
          { ...pack, name: 'Caja nueva', unitsPerPresentation: 24, salePriceCents: 5000 },
        ],
      },
      cola.id,
    );
    expect(await db.lines.where('saleId').equals(sale.id).first()).toMatchObject({
      presentationName: 'Pack x6',
      unitsPerPresentation: 6,
      baseQuantity: 6,
      unitPriceCents: 1600,
    });
  });
  it('no duplica códigos entre productos y presentaciones, incluso inactivas', async () => {
    const saved = await repo.saveProduct(
      {
        ...candy,
        presentations: [{ ...candy.presentations![0], barcode: 'BOLSA-100', active: false }],
      },
      candy.id,
    );
    await expect(
      repo.saveProduct({ ...saved, name: 'Otro', barcode: 'BOLSA-100', presentations: [] }),
    ).rejects.toThrow('ya está');
    await expect(
      repo.saveProduct(
        { ...saved, presentations: [{ ...saved.presentations![0], barcode: 'DEMO-001' }] },
        candy.id,
      ),
    ).rejects.toThrow('ya está');
  });
  it('rechaza ingreso inválido y mermas fuera de stock', async () => {
    for (const quantity of [-1, 0, 1.2])
      await expect(
        repo.receiveStock({ productId: candy.id, quantity, totalCostCents: 100 }),
      ).rejects.toThrow();
    await expect(repo.recordWaste(candy.id, 1, 'Producto dañado')).rejects.toThrow('stock');
    await expect(repo.recordWaste(candy.id, -1, 'Pérdida')).rejects.toThrow();
    await expect(repo.recordWaste(candy.id, 1, '')).rejects.toThrow('motivo');
  });
  it('revierte ingreso si falla el movimiento y no cambia costo ni stock', async () => {
    const fail = () => {
      throw new Error('fallo ingreso');
    };
    db.movements.hook('creating', fail);
    await expect(
      repo.receiveStock({ productId: candy.id, quantity: 100, totalCostCents: 1500 }),
    ).rejects.toThrow('fallo ingreso');
    db.movements.hook('creating').unsubscribe(fail);
    expect(await db.products.get(candy.id)).toMatchObject({ stock: 0, purchasePriceCents: 12 });
  });
  it('migra v2 sin borrar ventas, detalles, precios ni existencias anteriores', async () => {
    const name = 'legacy-' + crypto.randomUUID();
    const old = new Dexie(name);
    old.version(2).stores({
      products: 'id,&barcode,name,categoryId,updatedAt',
      categories: 'id',
      sales: 'id,&number,sessionId,createdAt,method',
      lines: 'id,saleId,productId',
      movements: 'id,productId,createdAt,saleId,type',
      sessions: 'id,status',
      settings: 'id',
    });
    const legacy = {
      id: 'old-product',
      name: 'Anterior',
      barcode: 'OLD',
      stock: 17,
      purchasePriceCents: 90,
      salePriceCents: 150,
      minimumStock: 2,
      active: true,
      createdAt: '2026-10-24',
      updatedAt: '2026-10-24',
    };
    await old.table('products').put(legacy);
    await old.table('sales').put({ id: 'old-sale', number: 'V-000007', totalCents: 150 });
    await old.table('lines').put({
      id: 'old-line',
      saleId: 'old-sale',
      productId: 'old-product',
      name: 'Nombre histórico',
      quantity: 1,
      unitPriceCents: 150,
      subtotalCents: 150,
    });
    await old
      .table('settings')
      .put({ id: 'demo', seeded: true, scanWithEnter: false, saleSequence: 7 });
    old.close();
    const upgraded = new IndexedDbRepository(new BodegaDatabase(name));
    try {
      await upgraded.initialize();
      await upgraded.initialize();
      const state = await upgraded.snapshot();
      expect(state.products).toHaveLength(7);
      expect(state.products.find((p) => p.id === 'old-product')).toMatchObject({
        ...legacy,
        unitName: 'Unidad',
        presentations: [],
      });
      expect(state.sales).toHaveLength(1);
      expect(state.lines[0]).toMatchObject({ name: 'Nombre histórico', subtotalCents: 150 });
      expect(state.settings).toMatchObject({
        saleSequence: 7,
        scanWithEnter: false,
        hu2Seeded: true,
      });
      expect(upgraded.db.verno).toBe(3);
    } finally {
      await upgraded.db.delete();
    }
  });
});

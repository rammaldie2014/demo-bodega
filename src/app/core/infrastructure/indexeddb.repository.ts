import { BodegaRepository } from '../domain/repository';
import {
  CashSession,
  Checkout,
  InventoryMovement,
  Product,
  ProductInput,
  Sale,
  SaleLine,
  Settings,
  Snapshot,
  Promotion,
  StockReceipt,
} from '../domain/models';
import {
  cartTotal,
  changeFor,
  nonnegativeInteger,
  requireRule,
  validateProduct,
} from '../domain/rules';
import { BodegaDatabase } from './database';
import { categories, seedProducts } from './seed';
import { liveQuery } from 'dexie';
import { hu2Catalog, demoPack } from './seed-hu2';
import { presentationOf, presentationPrice, validateCart } from '../domain/pricing';

export class IndexedDbRepository extends BodegaRepository {
  constructor(readonly db = new BodegaDatabase()) {
    super();
  }
  async initialize(): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      if (!(await this.db.settings.get('demo'))?.seeded) await this.seed();
      if (!(await this.db.settings.get('demo'))?.hu2Seeded) await this.supplementDemo();
    });
  }
  private async supplementDemo(): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.db.products.toArray();
    for (const input of hu2Catalog) {
      if (existing.some((p) => p.name.toLowerCase() === input.name.toLowerCase())) continue;
      const id = crypto.randomUUID();
      const product: Product = {
        ...input,
        id,
        createdAt: now,
        updatedAt: now,
        presentations: input.presentations?.map((p) => ({
          ...p,
          id: crypto.randomUUID(),
          productId: id,
        })),
      };
      await this.db.products.add(product);
      await this.db.movements.add(
        this.movement(product, 0, product.stock, 'initial', 'Catálogo adicional HU-002'),
      );
    }
    for (const product of existing.filter(
      (p) => p.barcode === 'DEMO-001' || p.barcode === 'DEMO-002',
    )) {
      if ((product.presentations ?? []).length) continue;
      await this.db.products.update(product.id, {
        unitName: product.unitName || 'Botella',
        presentations: [demoPack(product)],
      });
    }
    await this.db.settings.update('demo', { hu2Seeded: true });
  }
  private async seed(): Promise<void> {
    const products = seedProducts();
    await this.db.categories.bulkAdd(categories);
    await this.db.products.bulkAdd(products);
    await this.db.movements.bulkAdd(
      products.map((p) => this.movement(p, 0, p.stock, 'initial', 'Carga inicial de demostración')),
    );
    await this.db.settings.put({ id: 'demo', seeded: true, scanWithEnter: true, saleSequence: 0 });
  }
  async snapshot(): Promise<Snapshot> {
    return this.db.transaction('r', this.db.tables, async () => ({
      products: await this.db.products.toArray(),
      categories: await this.db.categories.toArray(),
      sales: await this.db.sales.toArray(),
      lines: await this.db.lines.toArray(),
      movements: await this.db.movements.toArray(),
      sessions: await this.db.sessions.toArray(),
      settings: (await this.db.settings.get('demo'))!,
      promotions: await this.db.promotions.toArray(),
    }));
  }
  watch(next: (snapshot: Snapshot) => void, error: (error: unknown) => void): () => void {
    const subscription = liveQuery(() => this.snapshot()).subscribe({ next, error });
    return () => subscription.unsubscribe();
  }
  async saveProduct(input: ProductInput, id?: string): Promise<Product> {
    const normalized = {
      ...input,
      name: input.name.trim(),
      barcode: input.barcode?.trim() || undefined,
    };
    validateProduct(normalized);
    return this.db.transaction(
      'rw',
      this.db.products,
      this.db.movements,
      this.db.promotions,
      async () => {
        const previous = id ? await this.db.products.get(id) : undefined;
        requireRule(!id || previous, 'Producto inexistente.');
        const codes = [
          normalized.barcode,
          ...(normalized.presentations ?? previous?.presentations ?? []).map((p) =>
            p.barcode?.trim(),
          ),
        ].filter((code): code is string => !!code);
        requireRule(
          new Set(codes).size === codes.length,
          'El código de barras está duplicado entre las presentaciones del producto.',
        );
        const others = (await this.db.products.toArray()).filter((p) => p.id !== id);
        requireRule(
          !others.some((p) =>
            [p.barcode, ...(p.presentations ?? []).map((pack) => pack.barcode)].some(
              (code) => code && codes.includes(code),
            ),
          ),
          'El código de barras ya está registrado, incluso si el producto está inactivo.',
        );
        if (normalized.categoryId)
          requireRule(
            categories.some((c) => c.id === normalized.categoryId),
            'Categoría inválida.',
          );
        requireRule(
          !previous || previous.stock === normalized.stock,
          'Utiliza un ajuste de inventario para modificar el stock.',
        );
        const now = new Date().toISOString();
        const product: Product = {
          ...previous,
          ...normalized,
          id: id ?? crypto.randomUUID(),
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        };
        product.unitName = normalized.unitName?.trim() || previous?.unitName || 'Unidad';
        product.presentations = (normalized.presentations ?? previous?.presentations ?? []).map(
          (p) => ({
            ...p,
            productId: product.id,
            name: p.name.trim(),
            barcode: p.barcode?.trim() || undefined,
          }),
        );
        if (previous)
          requireRule(
            (previous.presentations ?? []).every((p) =>
              product.presentations?.some((next) => next.id === p.id),
            ),
            'Desactiva una presentación en lugar de eliminarla para conservar sus referencias.',
          );
        for (const promotion of await this.db.promotions
          .where('productId')
          .equals(product.id)
          .toArray()) {
          if (promotion.active)
            requireRule(
              promotion.groupPriceCents <=
                presentationPrice(product, presentationOf(product, promotion.presentationId)) *
                  promotion.groupQuantity,
              'Desactiva o ajusta la promoción antes de reducir el precio por debajo del grupo promocional.',
            );
        }
        await this.db.products.put(product);
        if (!previous)
          await this.db.movements.add(
            this.movement(product, 0, product.stock, 'initial', 'Registro de producto'),
          );
        return product;
      },
    );
  }
  async adjustStock(id: string, nextStock: number, reason: string): Promise<void> {
    nonnegativeInteger(nextStock, 'El stock');
    requireRule(reason.trim().length >= 3, 'Escribe un motivo de al menos 3 caracteres.');
    await this.db.transaction('rw', this.db.products, this.db.movements, async () => {
      const product = await this.db.products.get(id);
      requireRule(product, 'Producto inexistente.');
      requireRule(nextStock !== product.stock, 'El nuevo stock debe ser diferente.');
      await this.db.movements.add(
        this.movement(product, product.stock, nextStock, 'adjustment', reason.trim()),
      );
      await this.db.products.update(id, { stock: nextStock, updatedAt: new Date().toISOString() });
    });
  }
  async openCash(openingCents: number): Promise<CashSession> {
    nonnegativeInteger(openingCents, 'El monto inicial');
    return this.db.transaction('rw', this.db.sessions, async () => {
      requireRule(
        (await this.db.sessions.where('status').equals('open').count()) === 0,
        'Ya existe una caja abierta en esta instalación.',
      );
      const session: CashSession = {
        id: crypto.randomUUID(),
        openingCents,
        openedAt: new Date().toISOString(),
        status: 'open',
      };
      await this.db.sessions.add(session);
      return session;
    });
  }
  async closeCash(id: string, countedCents: number): Promise<CashSession> {
    nonnegativeInteger(countedCents, 'El efectivo contado');
    return this.db.transaction('rw', this.db.sessions, this.db.sales, async () => {
      const session = await this.db.sessions.get(id);
      requireRule(session?.status === 'open', 'La caja ya está cerrada o no existe.');
      const sales = await this.db.sales.where('sessionId').equals(id).toArray();
      const expectedCents =
        session.openingCents +
        sales.filter((s) => s.method === 'cash').reduce((sum, s) => sum + s.totalCents, 0);
      const closed: CashSession = {
        ...session,
        status: 'closed',
        closedAt: new Date().toISOString(),
        expectedCents,
        countedCents,
        differenceCents: countedCents - expectedCents,
      };
      await this.db.sessions.put(closed);
      return closed;
    });
  }
  async checkout(input: Checkout): Promise<Sale> {
    requireRule(input.items.length > 0, 'Agrega productos a la venta.');
    requireRule(['cash', 'yape', 'plin'].includes(input.method), 'Método de pago inválido.');
    requireRule(
      new Set(input.items.map((i) => `${i.productId}:${i.presentationId ?? 'base'}`)).size ===
        input.items.length,
      'El carrito contiene productos duplicados.',
    );
    return this.db.transaction(
      'rw',
      [
        this.db.products,
        this.db.sessions,
        this.db.sales,
        this.db.lines,
        this.db.movements,
        this.db.settings,
        this.db.promotions,
      ],
      async () => {
        const session = await this.db.sessions.where('status').equals('open').first();
        requireRule(session, 'Abre la caja antes de registrar una venta.');
        const products = (
          await this.db.products.bulkGet(input.items.map((i) => i.productId))
        ).filter((p): p is Product => !!p);
        const promotions = await this.db.promotions.toArray();
        const priced = validateCart(input.items, products, promotions);
        const totalCents = cartTotal(input.items, products, promotions);
        requireRule(
          input.method === 'cash' || input.simulationConfirmed,
          'Confirma manualmente la simulación de pago.',
        );
        const changeCents =
          input.method === 'cash' ? changeFor(totalCents, input.receivedCents) : 0;
        const settings = (await this.db.settings.get('demo'))!;
        const sequence = settings.saleSequence + 1;
        const sale: Sale = {
          id: crypto.randomUUID(),
          number: `V-${String(sequence).padStart(6, '0')}`,
          sessionId: session.id,
          createdAt: new Date().toISOString(),
          totalCents,
          method: input.method,
          receivedCents: input.method === 'cash' ? input.receivedCents : totalCents,
          changeCents,
          simulated: input.method !== 'cash',
        };
        await this.db.sales.add(sale);
        const remaining = new Map(products.map((p) => [p.id, p.stock]));
        for (const item of priced) {
          const product = item.product;
          const line: SaleLine = {
            id: crypto.randomUUID(),
            saleId: sale.id,
            productId: product.id,
            name: product.name,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
            subtotalCents: item.subtotalCents,
            presentationId: item.presentationId,
            presentationName: item.presentation.name,
            unitsPerPresentation: item.presentation.unitsPerPresentation,
            baseQuantity: item.baseQuantity,
            discountCents: item.discountCents,
            totalCents: item.totalCents,
            promotionId: item.promotion?.id,
            promotionGroupQuantity: item.promotion?.groupQuantity,
            promotionGroupPriceCents: item.promotion?.groupPriceCents,
          };
          await this.db.lines.add(line);
          const before = remaining.get(product.id)!;
          const after = before - item.baseQuantity;
          remaining.set(product.id, after);
          await this.db.products.update(product.id, {
            stock: after,
            updatedAt: sale.createdAt,
          });
          await this.db.movements.add({
            ...this.movement(product, before, after, 'sale', `Venta ${sale.number}`),
            saleId: sale.id,
            presentationName: item.presentation.name,
            presentationQuantity: item.quantity,
            unitsPerPresentation: item.presentation.unitsPerPresentation,
          });
        }
        await this.db.settings.update('demo', { saleSequence: sequence });
        return sale;
      },
    );
  }
  async saveSettings(input: Pick<Settings, 'scanWithEnter'>): Promise<void> {
    requireRule(typeof input.scanWithEnter === 'boolean', 'Configuración inválida.');
    await this.db.settings.update('demo', input);
  }
  async restoreDemo(): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      for (const table of this.db.tables) await table.clear();
      await this.seed();
      await this.supplementDemo();
    });
  }
  async savePromotion(input: Omit<Promotion, 'id'>, id?: string): Promise<Promotion> {
    requireRule(
      Number.isSafeInteger(input.groupQuantity) && input.groupQuantity >= 2,
      'La promoción requiere al menos dos presentaciones.',
    );
    nonnegativeInteger(input.groupPriceCents, 'El precio promocional');
    requireRule(typeof input.active === 'boolean', 'Estado de promoción inválido.');
    return this.db.transaction('rw', this.db.products, this.db.promotions, async () => {
      const product = await this.db.products.get(input.productId);
      requireRule(product, 'Producto inexistente.');
      const presentation = presentationOf(product, input.presentationId);
      requireRule(
        !input.active || (product.active && presentation.active),
        'El producto o la presentación están inactivos.',
      );
      const normal = presentationPrice(product, presentation) * input.groupQuantity;
      nonnegativeInteger(normal, 'El importe del grupo');
      requireRule(
        input.groupPriceCents <= normal,
        'La promoción no puede superar el precio normal del grupo.',
      );
      if (id) requireRule(await this.db.promotions.get(id), 'Promoción inexistente.');
      const others = await this.db.promotions.where('productId').equals(product.id).toArray();
      requireRule(
        !input.active ||
          !others.some((p) => p.id !== id && p.active && p.presentationId === presentation.id),
        'Ya existe una promoción activa para esta presentación.',
      );
      const promotion: Promotion = {
        ...input,
        id: id ?? crypto.randomUUID(),
        presentationId: presentation.id,
      };
      await this.db.promotions.put(promotion);
      return promotion;
    });
  }
  async receiveStock(input: StockReceipt): Promise<void> {
    requireRule(
      Number.isSafeInteger(input.quantity) && input.quantity > 0,
      'La cantidad de ingreso debe ser un entero mayor que cero.',
    );
    nonnegativeInteger(input.totalCostCents, 'El costo total');
    await this.db.transaction('rw', this.db.products, this.db.movements, async () => {
      const product = await this.db.products.get(input.productId);
      requireRule(product, 'Producto inexistente.');
      const presentation = presentationOf(product, input.presentationId);
      requireRule(presentation.active, 'Presentación inactiva.');
      const units = input.quantity * presentation.unitsPerPresentation;
      nonnegativeInteger(units, 'El ingreso en unidades');
      const next = product.stock + units;
      nonnegativeInteger(next, 'El stock resultante');
      await this.db.movements.add({
        ...this.movement(
          product,
          product.stock,
          next,
          'receipt',
          `Ingreso: ${input.quantity} × ${presentation.name}`,
        ),
        presentationName: presentation.name,
        presentationQuantity: input.quantity,
        unitsPerPresentation: presentation.unitsPerPresentation,
        totalCostCents: input.totalCostCents,
      });
      await this.db.products.update(product.id, {
        stock: next,
        purchasePriceCents: Math.round(input.totalCostCents / units),
        updatedAt: new Date().toISOString(),
      });
    });
  }
  async recordWaste(productId: string, quantity: number, reason: string): Promise<void> {
    requireRule(
      Number.isSafeInteger(quantity) && quantity > 0,
      'La merma debe ser un entero mayor que cero.',
    );
    requireRule(
      [
        'Producto vencido',
        'Producto dañado',
        'Pérdida',
        'Diferencia de conteo',
        'Consumo interno',
      ].includes(reason),
      'Selecciona un motivo de merma válido.',
    );
    await this.db.transaction('rw', this.db.products, this.db.movements, async () => {
      const product = await this.db.products.get(productId);
      requireRule(product, 'Producto inexistente.');
      requireRule(quantity <= product.stock, 'La merma supera el stock disponible.');
      await this.db.movements.add(
        this.movement(product, product.stock, product.stock - quantity, 'waste', reason),
      );
      await this.db.products.update(product.id, {
        stock: product.stock - quantity,
        updatedAt: new Date().toISOString(),
      });
    });
  }
  private movement(
    product: Product,
    previousStock: number,
    nextStock: number,
    type: InventoryMovement['type'],
    reason: string,
  ): InventoryMovement {
    return {
      id: crypto.randomUUID(),
      productId: product.id,
      type,
      quantity: nextStock - previousStock,
      previousStock,
      nextStock,
      reason,
      createdAt: new Date().toISOString(),
    };
  }
}

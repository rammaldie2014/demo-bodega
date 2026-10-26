import { Injectable, computed, inject, signal } from '@angular/core';
import { BodegaRepository } from '../domain/repository';
import {
  CartItem,
  Checkout,
  Product,
  ProductInput,
  Snapshot,
  Promotion,
  StockReceipt,
} from '../domain/models';
import { addToCart, cartTotal, nonnegativeInteger } from '../domain/rules';
import { Notifications } from './notifications';
import { lineKey, presentationOf, priceLine, validateCart } from '../domain/pricing';
@Injectable({ providedIn: 'root' })
export class BodegaStore {
  private readonly repo = inject(BodegaRepository);
  readonly notifications = inject(Notifications);
  readonly data = signal<Snapshot | null>(null);
  readonly busy = signal(false);
  readonly failed = signal(false);
  readonly cart = signal<CartItem[]>([]);
  readonly products = computed(() => this.data()?.products ?? []);
  readonly categories = computed(() => this.data()?.categories ?? []);
  readonly promotions = computed(() => this.data()?.promotions ?? []);
  readonly sales = computed(() =>
    [...(this.data()?.sales ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  readonly currentCash = computed(() => this.data()?.sessions.find((s) => s.status === 'open'));
  readonly cartLines = computed(() =>
    this.cart()
      .filter((i) => this.products().some((p) => p.id === i.productId))
      .map((i) =>
        priceLine(
          i,
          this.products().find((p) => p.id === i.productId)!,
          this.promotions(),
        ),
      ),
  );
  readonly total = computed(() => this.cartLines().reduce((sum, i) => sum + i.totalCents, 0));
  readonly subtotal = computed(() =>
    this.cartLines().reduce((sum, line) => sum + line.subtotalCents, 0),
  );
  readonly discount = computed(() => this.subtotal() - this.total());
  async initialize(): Promise<void> {
    try {
      await this.repo.initialize();
      this.data.set(await this.repo.snapshot());
      this.repo.watch(
        (data) => this.data.set(data),
        (error) => this.notifications.handleError(error),
      );
      this.failed.set(false);
    } catch (error) {
      this.failed.set(true);
      this.notifications.handleError(error);
    }
  }
  async execute<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
    if (this.busy()) return undefined;
    this.busy.set(true);
    try {
      const result = await action();
      this.data.set(await this.repo.snapshot());
      if (success) this.notifications.show(success);
      return result;
    } catch (error) {
      this.notifications.handleError(error);
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
  attempt(action: () => void): void {
    try {
      action();
    } catch (error) {
      this.notifications.handleError(error);
    }
  }
  add(product: Product, presentationId?: string): void {
    this.attempt(() => this.cart.set(addToCart(this.cart(), product, 1, presentationId)));
  }
  quantity(product: Product, quantity: number, presentationId?: string): void {
    this.attempt(() => {
      nonnegativeInteger(quantity, 'La cantidad');
      const key = lineKey({ productId: product.id, presentationId });
      const next =
        quantity === 0
          ? this.cart().filter((i) => lineKey(i) !== key)
          : this.cart().map((i) => (lineKey(i) === key ? { ...i, quantity } : i));
      if (quantity > 0) validateCart(next, this.products(), this.promotions());
      this.cart.set(next);
    });
  }
  changePresentation(item: CartItem, presentationId: string): void {
    this.attempt(() => {
      const product = this.products().find((p) => p.id === item.productId)!;
      presentationOf(product, presentationId);
      const rest = this.cart().filter((i) => lineKey(i) !== lineKey(item));
      const next = addToCart(rest, product, item.quantity, presentationId);
      validateCart(next, this.products(), this.promotions());
      this.cart.set(next);
    });
  }
  scan(code: string): boolean {
    const product = this.products().find(
      (p) =>
        p.active &&
        (p.barcode === code.trim() ||
          p.presentations?.some((pack) => pack.active && pack.barcode === code.trim())),
    );
    if (!product) {
      this.notifications.show('No se encontró un producto activo con ese código.', true);
      return false;
    }
    const before = this.cart();
    this.add(
      product,
      product.barcode === code.trim()
        ? undefined
        : product.presentations?.find((p) => p.active && p.barcode === code.trim())?.id,
    );
    return this.cart() !== before;
  }
  saveProduct(input: ProductInput, id?: string) {
    return this.execute(
      () => this.repo.saveProduct(input, id),
      id ? 'Producto actualizado.' : 'Producto registrado.',
    );
  }
  adjustStock(id: string, stock: number, reason: string) {
    return this.execute(async () => {
      await this.repo.adjustStock(id, stock, reason);
      return true;
    }, 'Inventario actualizado.');
  }
  openCash(amount: number) {
    return this.execute(() => this.repo.openCash(amount), 'Caja abierta. ¡Todo listo para vender!');
  }
  closeCash(id: string, counted: number) {
    return this.execute(() => this.repo.closeCash(id, counted), 'Caja cerrada.');
  }
  checkout(input: Omit<Checkout, 'items'>) {
    return this.execute(async () => {
      cartTotal(this.cart(), this.products(), this.promotions());
      const sale = await this.repo.checkout({ ...input, items: this.cart() });
      this.cart.set([]);
      return sale;
    }, 'Venta registrada correctamente.');
  }
  saveScanner(scanWithEnter: boolean) {
    return this.execute(async () => {
      await this.repo.saveSettings({ scanWithEnter });
      return true;
    }, 'Preferencia guardada.');
  }
  restore() {
    return this.execute(async () => {
      await this.repo.restoreDemo();
      this.cart.set([]);
      return true;
    }, 'Datos de demostración restaurados.');
  }
  savePromotion(input: Omit<Promotion, 'id'>, id?: string) {
    return this.execute(() => this.repo.savePromotion(input, id), 'Promoción guardada.');
  }
  receiveStock(input: StockReceipt) {
    return this.execute(async () => {
      await this.repo.receiveStock(input);
      return true;
    }, 'Mercadería ingresada. Stock actualizado.');
  }
  recordWaste(productId: string, quantity: number, reason: string) {
    return this.execute(async () => {
      await this.repo.recordWaste(productId, quantity, reason);
      return true;
    }, 'Merma registrada.');
  }
}

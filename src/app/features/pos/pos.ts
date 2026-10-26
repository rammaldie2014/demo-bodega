import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BodegaStore } from '../../core/application/store';
import { PaymentMethod, Sale, Product } from '../../core/domain/models';
import {
  presentationsOf,
  presentationOf,
  presentationPrice,
  promotionFor,
} from '../../core/domain/pricing';
import { moneyToCents } from '../../core/domain/rules';
import { SolesPipe } from '../../shared/format';
import { ReceiptComponent } from '../../shared/receipt';
import { ProductArtComponent } from '../../shared/product-art';
import { DialogDirective } from '../../shared/dialog';
@Component({
  selector: 'app-pos',
  imports: [
    FormsModule,
    RouterLink,
    SolesPipe,
    ReceiptComponent,
    ProductArtComponent,
    DialogDirective,
  ],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">EL DÍA A DÍA, MÁS FÁCIL</div>
        <h1>Punto de venta<span class="heading-dot">.</span></h1>
        <p>Todo listo para tu próxima venta.</p>
      </div>
      <a routerLink="/cash" class="cash-status" [class.closed]="!store.currentCash()"
        ><i></i
        ><span
          >{{ store.currentCash() ? 'Caja abierta' : 'Caja cerrada'
          }}<small
            >{{
              store.currentCash() ? 'Lista para vender' : 'Abrir para registrar ventas'
            }}
            ↗</small
          ></span
        ></a
      >
    </div>
    <div class="pos-layout">
      <section class="catalog" aria-label="Catálogo de productos">
        <div class="catalog-toolbar">
          <div class="search-box">
            <span>⌕</span
            ><input
              aria-label="Buscar productos"
              placeholder="Buscar producto o código de barras…"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              (keydown.enter)="searchEnter()"
            /><kbd>↵</kbd>
          </div>
          <button
            class="button secondary scanner-toggle"
            aria-label="Escanear"
            (click)="scannerOpen.set(!scannerOpen())"
            [class.selected]="scannerOpen()"
          >
            <span>▥</span> Escanear
          </button>
        </div>
        @if (scannerOpen()) {
          <div class="scanner-panel">
            <label for="scan">Lector HID <small>Códigos de demo: DEMO-001 a DEMO-036</small></label
            ><input
              id="scan"
              placeholder="Escanea aquí…"
              [ngModel]="scanValue"
              (ngModelChange)="scannerInput($event)"
              (keydown.enter)="scan()"
              autocomplete="off"
            /><span class="muted">{{
              store.data()?.settings?.scanWithEnter
                ? 'Finaliza con Enter'
                : 'Detección automática tras 250 ms'
            }}</span>
          </div>
        }
        <section class="quick-sale-panel" aria-labelledby="quick-title">
          <div class="section-caption">
            <div>
              <span class="eyebrow">A UN TOQUE</span>
              <h2 id="quick-title">Venta rápida</h2>
            </div>
            <a routerLink="/products" class="text-button">Configurar favoritos ↗</a>
          </div>
          <div class="quick-sale-grid">
            @for (p of favorites(); track p.id) {
              <button
                class="quick-product"
                [disabled]="p.stock === 0"
                (click)="store.add(p)"
                [attr.aria-label]="'Venta rápida ' + p.name"
              >
                <span class="quick-product-icon">{{ p.icon || '◇' }}</span
                ><strong>{{ p.name }}</strong
                ><span class="quick-price"
                  >{{ p.salePriceCents | soles }}
                  <small>/ {{ p.unitName || 'unidad' }}</small></span
                >
                @if (promotion(p); as offer) {
                  <span class="promo-label"
                    >{{ offer.groupQuantity }} por {{ offer.groupPriceCents | soles }}</span
                  >
                }
                @if (p.stock === 0) {
                  <span class="badge amber">Agotado</span>
                } @else if (cartBaseQuantity(p.id)) {
                  <span class="quick-count">{{ cartBaseQuantity(p.id) }} en carrito</span>
                }
              </button>
            } @empty {
              <p class="quick-empty">
                No hay favoritos con este filtro. Márcalos con ★ en Productos.
              </p>
            }
          </div>
        </section>
        <div class="category-tabs" aria-label="Filtrar categoría">
          <button [class.active]="category() === ''" (click)="category.set('')">
            <span>▦</span>Todos
          </button>
          @for (c of store.categories(); track c.id) {
            <button [class.active]="category() === c.id" (click)="category.set(c.id)">
              <span>{{ c.symbol }}</span
              >{{ c.name }}
            </button>
          }
        </div>
        <div class="section-caption">
          <h2>{{ categoryName() }}</h2>
          <span>{{ filtered().length }} productos</span>
        </div>
        <div class="product-grid">
          @for (p of filtered(); track p.id) {
            <article class="product-card" [class.sold-out]="available(p) === 0">
              <button
                class="product-select"
                [disabled]="available(p) === 0"
                (click)="store.add(p, selected(p))"
                [attr.aria-label]="'Agregar ' + p.name"
              >
                <div class="product-image">
                  @if (p.icon && p.icon !== '◇') {
                    <span class="loose-product-icon">{{ p.icon }}</span>
                  } @else {
                    <app-product-art [category]="p.categoryId" [name]="p.name" />
                  }
                  @if (p.stock === 0) {
                    <span class="stock-label out">Agotado</span>
                  } @else if (p.stock <= p.minimumStock) {
                    <span class="stock-label low">Stock bajo</span>
                  }
                  <span class="product-add">+</span>
                </div>
                <div class="product-content">
                  <span class="product-category">{{ categoryLabel(p.categoryId) }}</span>
                  <h3>{{ p.name }}</h3>
                  <div class="product-bottom">
                    <strong>{{ selectedPrice(p) | soles }}</strong
                    ><span>{{ p.stock }} base</span>
                  </div>
                  @if (promotion(p, selected(p)); as offer) {
                    <span class="promo-label"
                      >{{ offer.groupQuantity }} por {{ offer.groupPriceCents | soles }}</span
                    >
                  }
                </div>
              </button>
              @if ((p.presentations?.length ?? 0) > 0) {
                <select
                  class="product-presentation-select"
                  [attr.aria-label]="'Presentación para ' + p.name"
                  [ngModel]="selected(p)"
                  (ngModelChange)="selectPresentation(p.id, $event)"
                >
                  @for (pack of packs(p); track pack.id) {
                    <option [value]="pack.id" [disabled]="!pack.active">
                      {{ pack.name }} · {{ pack.unitsPerPresentation }} base{{
                        pack.active ? '' : ' (inactiva)'
                      }}
                    </option>
                  }
                </select>
              }
            </article>
          } @empty {
            <div class="empty-state">
              <h3>No encontramos productos</h3>
              <p>Prueba con otro nombre, código o categoría.</p>
              <button class="button secondary" (click)="search.set(''); category.set('')">
                Limpiar búsqueda
              </button>
            </div>
          }
        </div>
        <p class="catalog-note">
          ⓘ Precios referenciales y códigos de demostración. Sin validez comercial.
        </p>
      </section>
      <aside id="sale-cart" class="cart-panel" aria-label="Venta actual">
        <div class="cart-heading">
          <div>
            <span class="eyebrow">NUEVA VENTA</span>
            <h2>
              Tu carrito <span>{{ units() }}</span>
            </h2>
          </div>
          <button
            class="icon-button"
            aria-label="Vaciar carrito"
            [disabled]="!store.cart().length"
            (click)="clearCart()"
          >
            ♲
          </button>
        </div>
        <div class="cart-divider"></div>
        <div class="cart-items">
          @for (line of store.cartLines(); track line.key) {
            <div class="cart-item">
              <div class="cart-thumbnail">
                @if (line.product.icon && line.product.icon !== '◇') {
                  <span class="cart-loose-icon">{{ line.product.icon }}</span>
                } @else {
                  <app-product-art
                    [category]="line.product.categoryId"
                    [name]="line.product.name"
                  />
                }
              </div>
              <div class="cart-item-main">
                <h3>{{ line.product.name }}</h3>
                <small>{{ line.unitPriceCents | soles }} / {{ line.presentation.name }}</small>
                @if ((line.product.presentations?.length ?? 0) > 0) {
                  <select
                    class="cart-presentation-select"
                    [attr.aria-label]="
                      'Cambiar presentación de ' + line.product.name + ' ' + line.presentation.name
                    "
                    [ngModel]="line.presentationId || 'base'"
                    (ngModelChange)="store.changePresentation(line, $event)"
                  >
                    @for (pack of packs(line.product); track pack.id) {
                      <option [value]="pack.id" [disabled]="!pack.active">{{ pack.name }}</option>
                    }
                  </select>
                }
                @if (line.presentation.unitsPerPresentation > 1) {
                  <small
                    >{{ line.baseQuantity }} {{ line.product.unitName || 'unidades base' }}</small
                  >
                }
                <div class="quantity-control">
                  <button
                    (click)="store.quantity(line.product, line.quantity - 1, line.presentationId)"
                    [attr.aria-label]="'Quitar unidad de ' + line.product.name"
                  >
                    −</button
                  ><input
                    type="number"
                    min="0"
                    [max]="maxQuantity(line.product, line.presentationId)"
                    [attr.aria-label]="
                      'Cantidad de ' +
                      line.product.name +
                      (line.presentationId ? ' · ' + line.presentation.name : '')
                    "
                    [ngModel]="line.quantity"
                    (ngModelChange)="store.quantity(line.product, +$event, line.presentationId)"
                  /><button
                    (click)="store.quantity(line.product, line.quantity + 1, line.presentationId)"
                    [attr.aria-label]="'Agregar unidad de ' + line.product.name"
                  >
                    +
                  </button>
                </div>
              </div>
              <div class="cart-item-end">
                <button
                  class="icon-button"
                  [attr.aria-label]="'Eliminar ' + line.product.name"
                  (click)="store.quantity(line.product, 0, line.presentationId)"
                >
                  ×
                </button>
                <div class="line-amount">
                  @if (line.discountCents > 0) {
                    <del>{{ line.subtotalCents | soles }}</del
                    ><small>Ahorro {{ line.discountCents | soles }}</small>
                  }
                  <strong>{{ line.totalCents | soles }}</strong>
                </div>
              </div>
            </div>
          } @empty {
            <div class="empty-cart">
              <div class="empty-cart-icon">▣<span>+</span></div>
              <h3>Empecemos una venta</h3>
              <p>Selecciona un producto o escanea su código para agregarlo aquí.</p>
              <span>Rápido, simple y sin complicaciones.</span>
            </div>
          }
        </div>
        <div class="cart-summary">
          <div class="detail-row">
            <span
              >Subtotal <small>({{ units() }} productos)</small></span
            ><strong>{{ store.subtotal() | soles }}</strong>
          </div>
          <div class="detail-row">
            <span>Ahorro promocional</span><strong>{{ store.discount() | soles }}</strong>
          </div>
          <div class="total-row">
            <span>Total a cobrar</span><strong>{{ store.total() | soles }}</strong>
          </div>
          <button
            class="button primary checkout-button"
            [disabled]="!store.cart().length || !store.currentCash() || store.busy()"
            (click)="openPayment()"
          >
            <span>▧ &nbsp; Cobrar venta</span><span>→</span>
          </button>
          @if (!store.currentCash()) {
            <a class="cart-hint" routerLink="/cash">Abre tu caja para empezar a vender ↗</a>
          } @else {
            <p class="cart-hint">Los productos se descuentan al confirmar.</p>
          }
          <div class="payment-brands">
            <span>EFECTIVO</span><b class="yape">yape</b><b class="plin">plin</b
            ><span class="simulation-label">Demo</span>
          </div>
        </div>
      </aside>
    </div>
    @if (store.cart().length) {
      <button class="mobile-cart-dock" (click)="scrollToCart()" aria-label="Ver carrito de venta">
        <span>▣ &nbsp; Ver carrito · {{ units() }} un.</span>
        <strong>{{ store.total() | soles }} →</strong>
      </button>
    }
    @if (paymentOpen()) {
      <div class="modal-backdrop">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-title"
          appDialog
          (escapeDialog)="!store.busy() && paymentOpen.set(false)"
        >
          <div class="modal-heading">
            <div>
              <span class="eyebrow">FINALIZAR VENTA</span>
              <h2 id="payment-title">Un cobro, todo en orden.</h2>
            </div>
            <button
              class="icon-button"
              (click)="paymentOpen.set(false)"
              aria-label="Cerrar pago"
              [disabled]="store.busy()"
            >
              ×
            </button>
          </div>
          <div class="payment-total">
            <span>Total a cobrar</span><strong>{{ store.total() | soles }}</strong>
          </div>
          <div class="payment-tabs">
            @for (m of methods; track m.id) {
              <button [class.active]="method === m.id" (click)="method = m.id; confirmed = false">
                {{ m.label }}
              </button>
            }
          </div>
          <form (ngSubmit)="pay()">
            @if (method === 'cash') {
              <label class="field"
                >Efectivo recibido (S/)<input
                  name="received"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  [(ngModel)]="received"
                  placeholder="0.00"
              /></label>
              <div class="change-box">
                <span>Vuelto</span><strong>{{ change() | soles }}</strong>
              </div>
              @if (received !== '' && receivedCents() < store.total()) {
                <p class="field-error">El importe recibido es insuficiente.</p>
              }
            } @else {
              <div
                class="simulation-qr"
                aria-label="Imagen decorativa de QR de demostración, no válida para pagos"
              >
                <div class="fake-qr"><span>DEMO</span></div>
                <strong>QR DE DEMOSTRACIÓN</strong><small>No válido para realizar pagos</small>
              </div>
              <p class="notice amber">Esta operación es una simulación. No envíes dinero.</p>
              <label class="checkbox-field"
                ><input type="checkbox" name="confirmed" [(ngModel)]="confirmed" />Confirmar
                manualmente el pago simulado</label
              >
            }
            <button
              class="button primary full-width"
              type="submit"
              [disabled]="
                store.busy() || (method === 'cash' ? receivedCents() < store.total() : !confirmed)
              "
            >
              {{
                store.busy()
                  ? 'Registrando…'
                  : method === 'cash'
                    ? 'Confirmar venta en efectivo'
                    : 'Registrar venta simulada'
              }}
            </button>
          </form>
        </section>
      </div>
    }
    @if (receipt(); as sale) {
      <app-receipt [sale]="sale" (dismiss)="receipt.set(null)" />
    }
  `,
})
export class PosComponent {
  readonly store = inject(BodegaStore);
  readonly search = signal('');
  readonly category = signal('');
  readonly scannerOpen = signal(false);
  readonly paymentOpen = signal(false);
  readonly receipt = signal<Sale | null>(null);
  readonly selections = signal<Record<string, string>>({});
  scanValue = '';
  method: PaymentMethod = 'cash';
  received: string | number = '';
  confirmed = false;
  private scanTimer?: ReturnType<typeof setTimeout>;
  readonly methods: { id: PaymentMethod; label: string }[] = [
    { id: 'cash', label: 'Efectivo' },
    { id: 'yape', label: 'Yape · demo' },
    { id: 'plin', label: 'Plin · demo' },
  ];
  readonly units = computed(() => this.store.cart().reduce((sum, i) => sum + i.quantity, 0));
  readonly filtered = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('es');
    return this.store
      .products()
      .filter(
        (p) =>
          p.active &&
          (!this.category() || p.categoryId === this.category()) &&
          (!q ||
            p.name.toLocaleLowerCase('es').includes(q) ||
            p.barcode?.toLowerCase().includes(q) ||
            p.presentations?.some((pack) => pack.barcode?.toLowerCase().includes(q))),
      );
  });
  readonly favorites = computed(() =>
    this.filtered()
      .filter((p) => p.favorite)
      .sort((a, b) => (a.quickOrder ?? 0) - (b.quickOrder ?? 0) || a.name.localeCompare(b.name)),
  );
  readonly categoryName = computed(() =>
    this.category() ? this.categoryLabel(this.category()) : 'Todos los productos',
  );
  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.scanTimer));
  }
  categoryLabel(id?: string) {
    return this.store.categories().find((c) => c.id === id)?.name ?? 'Sin categoría';
  }
  packs(product: Product) {
    return presentationsOf(product);
  }
  selected(product: Product) {
    return this.selections()[product.id] || 'base';
  }
  selectPresentation(productId: string, id: string) {
    this.selections.update((value) => ({ ...value, [productId]: id }));
  }
  selectedPrice(product: Product) {
    return presentationPrice(product, presentationOf(product, this.selected(product)));
  }
  available(product: Product) {
    const pack = presentationOf(product, this.selected(product));
    return pack.active ? Math.floor(product.stock / pack.unitsPerPresentation) : 0;
  }
  maxQuantity(product: Product, id?: string) {
    return Math.floor(product.stock / presentationOf(product, id).unitsPerPresentation);
  }
  promotion(product: Product, id?: string) {
    return promotionFor(this.store.promotions(), product.id, id);
  }
  cartBaseQuantity(id: string) {
    return this.store.cart().find((i) => i.productId === id && !i.presentationId)?.quantity ?? 0;
  }
  searchEnter() {
    if (this.store.scan(this.search())) this.search.set('');
  }
  scannerInput(value: string) {
    this.scanValue = value;
    clearTimeout(this.scanTimer);
    if (!this.store.data()?.settings.scanWithEnter && value)
      this.scanTimer = setTimeout(() => this.scan(), 250);
  }
  scan() {
    clearTimeout(this.scanTimer);
    if (this.scanValue.trim()) this.store.scan(this.scanValue);
    this.scanValue = '';
  }
  clearCart() {
    if (window.confirm('¿Vaciar los productos de esta venta?')) this.store.cart.set([]);
  }
  scrollToCart() {
    document.getElementById('sale-cart')?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
  openPayment() {
    this.received = '';
    this.method = 'cash';
    this.confirmed = false;
    this.paymentOpen.set(true);
  }
  receivedCents() {
    try {
      return moneyToCents(this.received);
    } catch {
      return -1;
    }
  }
  change() {
    return Math.max(0, this.receivedCents() - this.store.total());
  }
  async pay() {
    const sale = await this.store.checkout({
      method: this.method,
      receivedCents: this.receivedCents(),
      simulationConfirmed: this.confirmed,
    });
    if (sale) {
      this.paymentOpen.set(false);
      this.receipt.set(sale);
    }
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BodegaStore } from '../../core/application/store';
import { moneyToCents } from '../../core/domain/rules';
import { presentationsOf } from '../../core/domain/pricing';
import { SolesPipe, PeruTimePipe } from '../../shared/format';
@Component({
  selector: 'app-stock-receipts',
  imports: [FormsModule, RouterLink, SolesPipe, PeruTimePipe],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">LLEGÓ MERCADERÍA</div>
        <h1>Ingreso de mercadería<span class="heading-dot">.</span></h1>
        <p>Compra por bolsa, caja o pack. Tu inventario cuenta unidades.</p>
      </div>
      <a routerLink="/inventory" class="button secondary">Ver inventario ↗</a>
    </div>
    <div class="two-columns">
      <section class="panel padded">
        <h2>Registrar ingreso</h2>
        <form (ngSubmit)="save()" #f="ngForm">
          <label class="field"
            >Producto de ingreso<select
              name="product"
              required
              [ngModel]="productId()"
              (ngModelChange)="selectProduct($event)"
            >
              <option value="">Selecciona un producto</option>
              @for (p of products(); track p.id) {
                <option [value]="p.id">{{ p.icon || '◇' }} {{ p.name }}</option>
              }
            </select></label
          ><label class="field"
            >Presentación de compra<select
              name="presentation"
              required
              [ngModel]="presentationId()"
              (ngModelChange)="presentationId.set($event)"
            >
              @for (p of presentations(); track p.id) {
                <option [value]="p.id">{{ p.name }} · {{ p.unitsPerPresentation }} base</option>
              }
            </select></label
          >
          <div class="form-grid">
            <label class="field"
              >Cantidad comprada<input
                type="number"
                name="quantity"
                min="1"
                step="1"
                required
                [ngModel]="quantity()"
                (ngModelChange)="quantity.set($event)" /></label
            ><label class="field"
              >Costo total de compra (S/)<input
                type="number"
                name="cost"
                min="0"
                step="0.01"
                required
                [ngModel]="cost()"
                (ngModelChange)="cost.set($event)"
            /></label>
          </div>
          <p class="notice">
            El costo unitario referencial se actualiza con esta compra: costo total ÷ unidades
            ingresadas, redondeado al céntimo.
          </p>
          <button
            type="submit"
            class="button primary full-width"
            [disabled]="f.invalid || !product() || store.busy()"
          >
            Confirmar ingreso
          </button>
        </form>
      </section>
      <section class="panel padded receipt-preview">
        <span class="eyebrow">ASÍ CAMBIA TU INVENTARIO</span>
        @if (product(); as p) {
          <span class="quick-icon">{{ p.icon || '◇' }}</span>
          <h2>{{ p.name }}</h2>
          <div class="conversion-preview">
            <span
              >{{ quantity() || 0 }} ×
              {{ selectedPresentation()?.name || p.unitName || 'Unidad' }}</span
            ><strong>{{ units() }} {{ p.unitName || 'unidades' }}</strong
            ><small>Se suman a tu stock actual</small>
          </div>
          <div class="detail-row">
            <span>Stock actual</span><strong>{{ p.stock }}</strong>
          </div>
          <div class="detail-row">
            <span>Stock después del ingreso</span><strong>{{ p.stock + units() }}</strong>
          </div>
          <div class="detail-row">
            <span>Costo referencial por unidad</span><strong>{{ unitCost() | soles }}</strong>
          </div>
          <div class="detail-row">
            <span>Venta por unidad base</span><strong>{{ p.salePriceCents | soles }}</strong>
          </div>
          <div class="detail-row">
            <span>Ganancia bruta estimada por unidad</span
            ><strong>{{ p.salePriceCents - unitCost() | soles }}</strong>
          </div>
          <div class="detail-row">
            <span>Margen bruto estimado</span><strong>{{ margin() }}%</strong>
          </div>
          <div class="detail-row">
            <span>Ingreso potencial del stock resultante</span
            ><strong>{{ (p.stock + units()) * p.salePriceCents | soles }}</strong>
          </div>
          <p class="notice amber">
            Estimaciones al precio base, sin promociones ni gastos. La ganancia bruta no es utilidad
            neta ni valoración contable.
          </p>
        } @else {
          <div class="empty-state">
            <h3>De bolsas a unidades, sin cuentas a mano</h3>
            <p>Selecciona un producto para ver la conversión.</p>
          </div>
        }
      </section>
    </div>
    <section class="panel section-space">
      <div class="panel-heading"><h2>Últimos ingresos</h2></div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha · Perú</th>
              <th>Producto</th>
              <th>Compra</th>
              <th>Unidades base</th>
              <th>Costo total</th>
            </tr>
          </thead>
          <tbody>
            @for (m of receipts(); track m.id) {
              <tr>
                <td>{{ m.createdAt | peruTime }}</td>
                <td>{{ productName(m.productId) }}</td>
                <td>{{ m.presentationQuantity }} × {{ m.presentationName }}</td>
                <td>+{{ m.quantity }}</td>
                <td>{{ m.totalCostCents | soles }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty-state">Los ingresos confirmados aparecerán aquí.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class StockReceiptsComponent {
  readonly store = inject(BodegaStore);
  readonly productId = signal('');
  readonly presentationId = signal('base');
  readonly quantity = signal(1);
  readonly cost = signal<string | number>('');
  readonly products = computed(() =>
    this.store
      .products()
      .filter((p) => p.active)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly product = computed(() => this.store.products().find((p) => p.id === this.productId()));
  readonly presentations = computed(() =>
    this.product() ? presentationsOf(this.product()!).filter((p) => p.active) : [],
  );
  readonly selectedPresentation = computed(() =>
    this.presentations().find((p) => p.id === this.presentationId()),
  );
  readonly units = computed(
    () => (this.quantity() || 0) * (this.selectedPresentation()?.unitsPerPresentation ?? 0),
  );
  readonly receipts = computed(() =>
    [...(this.store.data()?.movements ?? [])]
      .filter((m) => m.type === 'receipt')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50),
  );
  selectProduct(id: string) {
    this.productId.set(id);
    this.presentationId.set('base');
  }
  unitCost() {
    try {
      return this.units() > 0 ? Math.round(moneyToCents(this.cost()) / this.units()) : 0;
    } catch {
      return 0;
    }
  }
  margin() {
    const price = this.product()?.salePriceCents ?? 0;
    return price ? Math.round(((price - this.unitCost()) / price) * 100) : 0;
  }
  productName(id: string) {
    return this.store.products().find((p) => p.id === id)?.name || 'Producto';
  }
  async save() {
    try {
      await this.store.receiveStock({
        productId: this.productId(),
        presentationId: this.presentationId(),
        quantity: this.quantity(),
        totalCostCents: moneyToCents(this.cost()),
      });
    } catch (e) {
      this.store.notifications.handleError(e);
    }
  }
}

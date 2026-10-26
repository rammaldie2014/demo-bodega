import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BodegaStore } from '../../core/application/store';
import { Promotion } from '../../core/domain/models';
import { moneyToCents } from '../../core/domain/rules';
import { presentationsOf, presentationPrice } from '../../core/domain/pricing';
import { SolesPipe } from '../../shared/format';
@Component({
  selector: 'app-promotions',
  imports: [FormsModule, SolesPipe],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">PEQUEÑOS PRECIOS, GRANDES FAVORITOS</div>
        <h1>Promociones<span class="heading-dot">.</span></h1>
        <p>Grupos completos a precio especial. El resto, al precio normal.</p>
      </div>
      <span class="badge green">Una activa por presentación</span>
    </div>
    <div class="two-columns">
      <section class="panel padded">
        <h2>{{ editing() ? 'Editar promoción' : 'Nueva promoción' }}</h2>
        <form (ngSubmit)="save()" #f="ngForm">
          <label class="field"
            >Producto de promoción<select
              name="product"
              required
              [ngModel]="productId()"
              (ngModelChange)="selectProduct($event)"
            >
              <option value="">Selecciona un producto</option>
              @for (p of store.products(); track p.id) {
                <option [value]="p.id">
                  {{ p.icon || '◇' }} {{ p.name }}{{ p.active ? '' : ' (inactivo)' }}
                </option>
              }
            </select></label
          ><label class="field"
            >Presentación de promoción<select
              name="presentation"
              required
              [ngModel]="presentationId()"
              (ngModelChange)="presentationId.set($event)"
            >
              @for (pack of presentations(); track pack.id) {
                <option [value]="pack.id">
                  {{ pack.name }}{{ pack.active ? '' : ' (inactiva)' }}
                </option>
              }
            </select></label
          >
          <div class="form-grid">
            <label class="field"
              >Cantidad del grupo<input
                type="number"
                name="quantity"
                min="2"
                step="1"
                required
                [ngModel]="quantity()"
                (ngModelChange)="quantity.set($event)" /></label
            ><label class="field"
              >Precio del grupo (S/)<input
                type="number"
                name="price"
                min="0"
                step="0.01"
                required
                [ngModel]="price()"
                (ngModelChange)="price.set($event)"
            /></label>
          </div>
          <label class="checkbox-field"
            ><input name="active" type="checkbox" [(ngModel)]="active" />Promoción activa</label
          >
          <div class="button-row">
            @if (editing()) {
              <button type="button" class="button secondary" (click)="reset()">
                Cancelar edición
              </button>
            }
            <button
              type="submit"
              class="button primary"
              [disabled]="f.invalid || !product() || store.busy()"
            >
              Guardar promoción
            </button>
          </div>
        </form>
      </section>
      <section class="panel padded promo-preview">
        <span class="eyebrow">EL PRECIO SE EXPLICA SOLO</span>
        <h2>{{ product()?.name || 'Tu próxima promoción' }}</h2>
        <div class="conversion-preview">
          <span>{{ quantity() }} × {{ selectedPresentation()?.name || 'presentaciones' }}</span
          ><strong>{{ priceCents() | soles }}</strong
          ><small>Precio normal del grupo: {{ normalGroup() | soles }}</small>
        </div>
        <p class="notice">
          Solo se aplica a esta presentación y producto. Se repite por cada grupo completo; no se
          combina con otras promociones.
        </p>
        <p class="muted">
          Ejemplo: 3 caramelos por S/ 0.50 → 7 caramelos cuestan S/ 1.20 si su precio normal es S/
          0.20.
        </p>
      </section>
    </div>
    <section class="panel section-space">
      <div class="panel-heading"><h2>Promociones registradas</h2></div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Producto · presentación</th>
              <th>Promoción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (p of store.promotions(); track p.id) {
              <tr>
                <td>
                  <strong>{{ productName(p.productId) }}</strong
                  ><small>{{ presentationName(p) }}</small>
                </td>
                <td>
                  {{ p.groupQuantity }} por <strong>{{ p.groupPriceCents | soles }}</strong>
                </td>
                <td>
                  <span class="badge" [class.green]="p.active">{{
                    p.active ? 'Activa' : 'Inactiva'
                  }}</span>
                </td>
                <td>
                  <div class="table-actions">
                    <button class="text-button" (click)="edit(p)">Editar promoción</button
                    ><button class="text-button" [disabled]="store.busy()" (click)="toggle(p)">
                      {{ p.active ? 'Desactivar promoción' : 'Activar promoción' }}
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="empty-state">
                  Crea una promoción y aparecerá automáticamente en el POS.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class PromotionsComponent {
  readonly store = inject(BodegaStore);
  readonly editing = signal<Promotion | null>(null);
  readonly productId = signal('');
  readonly presentationId = signal('base');
  readonly quantity = signal(3);
  readonly price = signal<string | number>('0.50');
  active = true;
  readonly product = computed(() => this.store.products().find((p) => p.id === this.productId()));
  readonly presentations = computed(() => (this.product() ? presentationsOf(this.product()!) : []));
  readonly selectedPresentation = computed(() =>
    this.presentations().find((p) => p.id === this.presentationId()),
  );
  selectProduct(id: string) {
    this.productId.set(id);
    this.presentationId.set('base');
  }
  priceCents() {
    try {
      return moneyToCents(this.price());
    } catch {
      return 0;
    }
  }
  normalGroup() {
    return this.product() && this.selectedPresentation()
      ? presentationPrice(this.product()!, this.selectedPresentation()!) * (this.quantity() || 0)
      : 0;
  }
  productName(id: string) {
    return this.store.products().find((p) => p.id === id)?.name || 'Producto';
  }
  presentationName(p: Promotion) {
    return (
      presentationsOf(this.store.products().find((product) => product.id === p.productId)!).find(
        (pack) => pack.id === p.presentationId,
      )?.name || 'Unidad'
    );
  }
  edit(p: Promotion) {
    this.editing.set(p);
    this.productId.set(p.productId);
    this.presentationId.set(p.presentationId);
    this.quantity.set(p.groupQuantity);
    this.price.set(p.groupPriceCents / 100);
    this.active = p.active;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  reset() {
    this.editing.set(null);
    this.productId.set('');
    this.presentationId.set('base');
    this.quantity.set(3);
    this.price.set('0.50');
    this.active = true;
  }
  async save() {
    try {
      const saved = await this.store.savePromotion(
        {
          productId: this.productId(),
          presentationId: this.presentationId(),
          groupQuantity: this.quantity(),
          groupPriceCents: moneyToCents(this.price()),
          active: this.active,
        },
        this.editing()?.id,
      );
      if (saved) this.reset();
    } catch (e) {
      this.store.notifications.handleError(e);
    }
  }
  async toggle(p: Promotion) {
    await this.store.savePromotion({ ...p, active: !p.active }, p.id);
  }
}

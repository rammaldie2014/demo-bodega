import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BodegaStore } from '../../core/application/store';
import { Product } from '../../core/domain/models';
import { moneyToCents } from '../../core/domain/rules';
import { SolesPipe } from '../../shared/format';
import { DialogDirective } from '../../shared/dialog';
import { productIcons } from '../../core/domain/pricing';
@Component({
  selector: 'app-products',
  imports: [FormsModule, SolesPipe, DialogDirective],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">UN CATÁLOGO EN ORDEN</div>
        <h1>Productos<span class="heading-dot">.</span></h1>
        <p>Los favoritos de tus clientes, siempre a mano.</p>
      </div>
      <button class="button primary" (click)="edit()">+ Nuevo producto</button>
    </div>
    <section class="panel">
      <div class="table-toolbar">
        <div class="search-box">
          <span>⌕</span
          ><input
            aria-label="Buscar en catálogo"
            placeholder="Nombre o código de barras"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />
        </div>
        <select
          aria-label="Categoría"
          [ngModel]="category()"
          (ngModelChange)="category.set($event)"
        >
          <option value="">Todas las categorías</option>
          @for (c of store.categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }</select
        ><select
          aria-label="Estado del producto"
          [ngModel]="status()"
          (ngModelChange)="status.set($event)"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="out">Agotados</option>
        </select>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Código demo / propio</th>
              <th>Compra</th>
              <th>Venta</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr>
                <td>
                  <strong>{{ p.icon || '◇' }} {{ p.name }}</strong
                  ><small
                    >{{ categoryName(p.categoryId) }} · Base: {{ p.unitName || 'Unidad' }}</small
                  >
                  <small>{{ presentationSummary(p) }}</small>
                </td>
                <td class="mono">{{ p.barcode || '—' }}</td>
                <td>{{ p.purchasePriceCents | soles }}<small>Costo referencial / base</small></td>
                <td>
                  <strong>{{ p.salePriceCents | soles }}</strong>
                  <small
                    >Bruta est.: {{ p.salePriceCents - p.purchasePriceCents | soles }} ·
                    {{ margin(p) }}%</small
                  >
                </td>
                <td>
                  <span class="badge" [class.amber]="p.stock <= p.minimumStock"
                    >{{ p.stock }} un.</span
                  >
                </td>
                <td>
                  <span class="badge" [class.green]="p.active">{{
                    p.active ? 'Activo' : 'Inactivo'
                  }}</span>
                </td>
                <td>
                  <div class="table-actions">
                    <button
                      class="favorite-button"
                      [class.is-favorite]="p.favorite"
                      [attr.aria-label]="
                        (p.favorite ? 'Quitar favorito ' : 'Marcar favorito ') + p.name
                      "
                      [disabled]="store.busy()"
                      (click)="favorite(p)"
                    >
                      {{ p.favorite ? '★' : '☆' }}
                    </button>
                    <button class="text-button" (click)="edit(p)">Editar</button
                    ><button class="text-button" [disabled]="store.busy()" (click)="toggle(p)">
                      {{ p.active ? 'Desactivar' : 'Activar' }}
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty-state">No hay productos que coincidan.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="panel-footer">
        {{ filtered().length }} productos · Los códigos DEMO no son códigos comerciales.
      </div>
    </section>
    @if (formOpen()) {
      <div class="modal-backdrop">
        <section
          class="modal wide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-title"
          appDialog
          (escapeDialog)="formOpen.set(false)"
        >
          <div class="modal-heading">
            <h2 id="product-title">{{ editing ? 'Editar producto' : 'Nuevo producto' }}</h2>
            <button
              class="icon-button"
              aria-label="Cerrar formulario"
              (click)="formOpen.set(false)"
            >
              ×
            </button>
          </div>
          <form (ngSubmit)="save()" #productForm="ngForm">
            <div class="form-grid">
              <label class="field span-2"
                >Nombre del producto<input
                  name="name"
                  required
                  maxlength="120"
                  [(ngModel)]="form.name"
                  placeholder="Ej. Gaseosa cola 500 ml" /></label
              ><label class="field"
                >Código de barras (opcional)<input
                  name="barcode"
                  maxlength="48"
                  pattern="[a-zA-Z0-9-]+"
                  [(ngModel)]="form.barcode"
                  placeholder="DEMO-037" /></label
              ><label class="field"
                >Categoría<select name="category" [(ngModel)]="form.categoryId">
                  <option value="">Sin categoría</option>
                  @for (c of store.categories(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select></label
              ><label class="field"
                >Precio de compra (S/)<input
                  name="purchase"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  [(ngModel)]="form.purchase" /></label
              ><label class="field"
                >Precio de venta (S/)<input
                  name="price"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  [(ngModel)]="form.price" /></label
              ><label class="field"
                >{{ editing ? 'Stock actual (ajustar en Inventario)' : 'Stock inicial'
                }}<input
                  name="stock"
                  type="number"
                  required
                  min="0"
                  step="1"
                  [(ngModel)]="form.stock"
                  [disabled]="!!editing" /></label
              ><label class="field"
                >Stock mínimo<input
                  name="minimum"
                  type="number"
                  required
                  min="0"
                  step="1"
                  [(ngModel)]="form.minimumStock"
              /></label>
              <label class="field"
                >Unidad base<input
                  name="unitName"
                  maxlength="32"
                  required
                  [(ngModel)]="form.unitName"
                  placeholder="Unidad, Botella, Huevo…"
              /></label>
              <label class="field"
                >Icono<select name="icon" aria-label="Icono" [(ngModel)]="form.icon">
                  @for (icon of icons; track icon) {
                    <option [value]="icon">{{ icon }}</option>
                  }
                </select></label
              >
            </div>
            <div class="presentation-editor">
              <div class="panel-heading compact">
                <div>
                  <h3>Presentaciones</h3>
                  <p>El stock siempre se guarda en {{ form.unitName || 'unidades base' }}.</p>
                </div>
                <button type="button" class="button secondary" (click)="addPresentation()">
                  + Añadir presentación
                </button>
              </div>
              <div class="base-presentation">
                <span>{{ form.unitName || 'Unidad' }} · 1 unidad base</span
                ><strong>{{ previewPrice() | soles }}</strong>
              </div>
              @for (pack of packs; track pack.id; let i = $index) {
                <div class="presentation-draft">
                  <div class="form-grid">
                    <label class="field"
                      >Nombre de presentación {{ i + 1
                      }}<input
                        [name]="'pack-name-' + i"
                        required
                        maxlength="50"
                        [(ngModel)]="pack.name"
                        placeholder="Ej. Bolsa x100" /></label
                    ><label class="field"
                      >Unidades base por presentación {{ i + 1
                      }}<input
                        [name]="'pack-units-' + i"
                        type="number"
                        min="1"
                        step="1"
                        required
                        [(ngModel)]="pack.units" /></label
                    ><label class="field"
                      >Precio de presentación {{ i + 1 }} (S/, opcional)<input
                        [name]="'pack-price-' + i"
                        type="number"
                        min="0"
                        step="0.01"
                        [(ngModel)]="pack.price"
                        placeholder="Vacío: precio base × unidades" /></label
                    ><label class="field"
                      >Código de presentación {{ i + 1 }} (opcional)<input
                        [name]="'pack-code-' + i"
                        pattern="[a-zA-Z0-9-]+"
                        maxlength="48"
                        [(ngModel)]="pack.barcode"
                    /></label>
                  </div>
                  <div class="presentation-draft-actions">
                    <label class="checkbox-field"
                      ><input
                        [name]="'pack-active-' + i"
                        type="checkbox"
                        [(ngModel)]="pack.active"
                      />Presentación activa</label
                    >
                    @if (!isSavedPack(pack.id)) {
                      <button type="button" class="text-button" (click)="removePack(pack.id)">
                        Descartar
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
            <div class="form-grid">
              <label class="checkbox-field"
                ><input name="favorite" type="checkbox" [(ngModel)]="form.favorite" />Mostrar en
                venta rápida</label
              ><label class="field"
                >Orden en venta rápida<input
                  name="quickOrder"
                  type="number"
                  min="0"
                  step="1"
                  [(ngModel)]="form.quickOrder"
              /></label>
            </div>
            <label class="checkbox-field"
              ><input name="active" type="checkbox" [(ngModel)]="form.active" />Producto activo para
              ventas</label
            >
            <div class="button-row">
              <button type="button" class="button secondary" (click)="formOpen.set(false)">
                Cancelar</button
              ><button
                class="button primary"
                type="submit"
                [disabled]="productForm.invalid || store.busy()"
              >
                {{ store.busy() ? 'Guardando…' : 'Guardar producto' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    }
  `,
})
export class ProductsComponent {
  readonly store = inject(BodegaStore);
  readonly query = signal('');
  readonly category = signal('');
  readonly status = signal('all');
  readonly formOpen = signal(false);
  editing?: Product;
  readonly icons = productIcons;
  packs: {
    id: string;
    name: string;
    units: number;
    price: string | number;
    barcode: string;
    active: boolean;
  }[] = [];
  form = {
    name: '',
    barcode: '',
    categoryId: 'bebidas',
    purchase: 0,
    price: 0,
    stock: 0,
    minimumStock: 5,
    active: true,
    unitName: 'Unidad',
    icon: '◇',
    favorite: false,
    quickOrder: 0,
  };
  readonly filtered = computed(() =>
    this.store
      .products()
      .filter(
        (p) =>
          (!this.category() || p.categoryId === this.category()) &&
          (p.name.toLowerCase().includes(this.query().toLowerCase()) ||
            p.barcode?.toLowerCase().includes(this.query().toLowerCase())) &&
          (this.status() === 'all' ||
            (this.status() === 'active' && p.active) ||
            (this.status() === 'inactive' && !p.active) ||
            (this.status() === 'out' && p.stock === 0)),
      )
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  categoryName(id?: string) {
    return this.store.categories().find((c) => c.id === id)?.name ?? 'Sin categoría';
  }
  edit(p?: Product) {
    this.editing = p;
    this.form = p
      ? {
          name: p.name,
          barcode: p.barcode ?? '',
          categoryId: p.categoryId ?? '',
          purchase: p.purchasePriceCents / 100,
          price: p.salePriceCents / 100,
          stock: p.stock,
          minimumStock: p.minimumStock,
          active: p.active,
          unitName: p.unitName || 'Unidad',
          icon: p.icon || '◇',
          favorite: p.favorite ?? false,
          quickOrder: p.quickOrder ?? 0,
        }
      : {
          name: '',
          barcode: '',
          categoryId: 'bebidas',
          purchase: 0,
          price: 0,
          stock: 0,
          minimumStock: 5,
          active: true,
          unitName: 'Unidad',
          icon: '◇',
          favorite: false,
          quickOrder: 0,
        };
    this.packs = (p?.presentations ?? []).map((pack) => ({
      id: pack.id,
      name: pack.name,
      units: pack.unitsPerPresentation,
      price: pack.salePriceCents === undefined ? '' : pack.salePriceCents / 100,
      barcode: pack.barcode || '',
      active: pack.active,
    }));
    this.formOpen.set(true);
  }
  async save() {
    try {
      const saved = await this.store.saveProduct(
        {
          name: this.form.name,
          barcode: this.form.barcode,
          categoryId: this.form.categoryId || undefined,
          purchasePriceCents: moneyToCents(this.form.purchase),
          salePriceCents: moneyToCents(this.form.price),
          stock: this.form.stock,
          minimumStock: this.form.minimumStock,
          active: this.form.active,
          unitName: this.form.unitName,
          icon: this.form.icon,
          favorite: this.form.favorite,
          quickOrder: this.form.quickOrder,
          presentations: this.packs.map((pack) => ({
            id: pack.id,
            productId: this.editing?.id ?? '',
            name: pack.name,
            unitsPerPresentation: pack.units,
            salePriceCents:
              pack.price === '' || pack.price === null ? undefined : moneyToCents(pack.price),
            barcode: pack.barcode || undefined,
            active: pack.active,
          })),
        },
        this.editing?.id,
      );
      if (saved) this.formOpen.set(false);
    } catch (error) {
      this.store.notifications.handleError(error);
    }
  }
  async toggle(p: Product) {
    if (p.active && !window.confirm('¿Desactivar ' + p.name + '? Se conservará su historial.'))
      return;
    await this.store.saveProduct({ ...p, active: !p.active }, p.id);
  }
  addPresentation() {
    this.packs.push({
      id: crypto.randomUUID(),
      name: '',
      units: 1,
      price: '',
      barcode: '',
      active: true,
    });
  }
  isSavedPack(id: string) {
    return this.editing?.presentations?.some((p) => p.id === id) ?? false;
  }
  removePack(id: string) {
    this.packs = this.packs.filter((p) => p.id !== id);
  }
  previewPrice() {
    try {
      return moneyToCents(this.form.price);
    } catch {
      return 0;
    }
  }
  presentationSummary(p: Product) {
    return (p.presentations ?? [])
      .map(
        (pack) => `${pack.name} (${pack.unitsPerPresentation}${pack.active ? '' : ', inactiva'})`,
      )
      .join(' · ');
  }
  margin(p: Product) {
    return p.salePriceCents
      ? Math.round(((p.salePriceCents - p.purchasePriceCents) / p.salePriceCents) * 100)
      : 0;
  }
  async favorite(p: Product) {
    await this.store.saveProduct({ ...p, favorite: !p.favorite }, p.id);
  }
}

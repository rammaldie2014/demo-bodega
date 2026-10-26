import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BodegaStore } from '../../core/application/store';
import { Product } from '../../core/domain/models';
import { PeruTimePipe, SolesPipe } from '../../shared/format';
import { DialogDirective } from '../../shared/dialog';
import { RouterLink } from '@angular/router';
import { stockEquivalence } from '../../core/domain/pricing';
@Component({
  selector: 'app-inventory',
  imports: [FormsModule, PeruTimePipe, SolesPipe, DialogDirective, RouterLink],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">CADA UNIDAD CUENTA</div>
        <h1>Inventario<span class="heading-dot">.</span></h1>
        <p>Ten claro qué tienes y qué necesitas reponer.</p>
      </div>
      <a class="button primary" routerLink="/stock-receipts">+ Ingresar mercadería</a>
    </div>
    <div class="metric-grid three">
      <div class="metric-card">
        <span>Unidades en inventario</span><strong>{{ units() }}</strong
        ><small>Incluye productos inactivos</small>
      </div>
      <div class="metric-card">
        <span>Productos con stock bajo</span><strong class="text-amber">{{ low() }}</strong
        ><small>Disponibles, por debajo del mínimo</small>
      </div>
      <div class="metric-card">
        <span>Productos agotados</span><strong>{{ out() }}</strong
        ><small>Revisa tu próxima reposición</small>
      </div>
    </div>
    <section class="panel">
      <div class="table-toolbar">
        <div class="search-box">
          <span>⌕</span
          ><input
            aria-label="Buscar inventario"
            placeholder="Buscar nombre o código"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />
        </div>
        <select
          aria-label="Filtrar stock"
          [ngModel]="filter()"
          (ngModelChange)="filter.set($event)"
        >
          <option value="all">Todo el inventario</option>
          <option value="low">Stock bajo</option>
          <option value="out">Agotados</option>
        </select>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Código</th>
              <th>Stock actual</th>
              <th>Mínimo</th>
              <th>Disponibilidad</th>
              <th>Presentaciones / equivalencia</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr>
                <td>
                  <strong>{{ p.name }}</strong>
                  @if (!p.active) {
                    <small>Inactivo</small>
                  }
                </td>
                <td class="mono">{{ p.barcode || '—' }}</td>
                <td>
                  <strong>{{ p.stock }} un.</strong>
                  <small>Base: {{ p.unitName || 'Unidad' }}</small>
                </td>
                <td>{{ p.minimumStock }} un.</td>
                <td>
                  <span
                    class="badge"
                    [class.green]="p.stock > p.minimumStock"
                    [class.amber]="p.stock <= p.minimumStock"
                    >{{
                      p.stock === 0
                        ? 'Agotado'
                        : p.stock <= p.minimumStock
                          ? 'Stock bajo'
                          : 'Disponible'
                    }}</span
                  >
                </td>
                <td>
                  <strong>{{ equivalence(p) }}</strong
                  ><small>
                    @for (pack of p.presentations || []; track pack.id) {
                      <span
                        >{{ pack.name }} = {{ pack.unitsPerPresentation }} base{{
                          pack.active ? '' : ' (inactiva)'
                        }}
                        ·
                      </span>
                    }
                  </small>
                </td>
                <td>
                  <div class="table-actions">
                    <button class="text-button" (click)="adjust(p)">Ajustar stock</button
                    ><button class="text-button" (click)="waste(p)" [disabled]="p.stock === 0">
                      Registrar merma
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty-state">No hay productos con este filtro.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel section-space">
      <div class="panel-heading">
        <div>
          <h2>Historial de movimientos</h2>
          <p>Entradas, ventas y ajustes, siempre trazables.</p>
        </div>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha · Perú</th>
              <th>Producto</th>
              <th>Movimiento</th>
              <th>Antes → Después</th>
              <th>Motivo / referencia</th>
            </tr>
          </thead>
          <tbody>
            @for (m of movements(); track m.id) {
              <tr>
                <td>{{ m.createdAt | peruTime }}</td>
                <td>{{ productName(m.productId) }}</td>
                <td>
                  <span class="badge" [class.green]="m.quantity > 0"
                    >{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }} ·
                    {{
                      m.type === 'sale'
                        ? 'Venta'
                        : m.type === 'initial'
                          ? 'Inicial'
                          : m.type === 'receipt'
                            ? 'Ingreso'
                            : m.type === 'waste'
                              ? 'Merma'
                              : 'Ajuste'
                    }}</span
                  >
                </td>
                <td>{{ m.previousStock }} → {{ m.nextStock }}</td>
                <td>
                  {{ m.reason }}
                  @if (m.totalCostCents !== undefined) {
                    <small>Costo total: {{ m.totalCostCents | soles }}</small>
                  }
                  @if (m.presentationName) {
                    <small
                      >{{ m.presentationQuantity }} × {{ m.presentationName }} ·
                      {{ m.unitsPerPresentation }} base/presentación</small
                    >
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty-state">Aún no hay movimientos.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="panel-footer">Últimos 100 movimientos{{ query() ? ' de la búsqueda' : '' }}.</div>
    </section>
    @if (wasting(); as p) {
      <div class="modal-backdrop">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="waste-title"
          appDialog
          (escapeDialog)="wasting.set(null)"
        >
          <div class="modal-heading">
            <h2 id="waste-title">Registrar merma</h2>
            <button class="icon-button" aria-label="Cerrar merma" (click)="wasting.set(null)">
              ×
            </button>
          </div>
          <p>{{ p.name }} · Stock actual: {{ p.stock }} {{ p.unitName || 'unidades' }}</p>
          <form (ngSubmit)="saveWaste()" #wf="ngForm">
            <label class="field"
              >Cantidad de merma (unidades base)<input
                type="number"
                name="wasteQuantity"
                required
                min="1"
                [max]="p.stock"
                step="1"
                [(ngModel)]="wasteQuantity" /></label
            ><label class="field"
              >Motivo de merma<select name="wasteReason" [(ngModel)]="wasteReason" required>
                @for (reason of wasteReasons; track reason) {
                  <option [value]="reason">{{ reason }}</option>
                }
              </select></label
            >
            <p class="notice amber">
              Stock resultante: {{ p.stock - (wasteQuantity || 0) }}. Se registrará una salida
              trazable.
            </p>
            <button
              class="button primary full-width"
              type="submit"
              [disabled]="wf.invalid || store.busy()"
            >
              Confirmar merma
            </button>
          </form>
        </section>
      </div>
    }
    @if (editing(); as p) {
      <div class="modal-backdrop">
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjust-title"
          appDialog
          (escapeDialog)="editing.set(null)"
        >
          <div class="modal-heading">
            <h2 id="adjust-title">Ajustar inventario</h2>
            <button class="icon-button" aria-label="Cerrar ajuste" (click)="editing.set(null)">
              ×
            </button>
          </div>
          <p>
            {{ p.name }} · Stock actual: <strong>{{ p.stock }} unidades</strong>
          </p>
          <form (ngSubmit)="save()" #f="ngForm">
            <label class="field"
              >Nuevo stock total<input
                name="stock"
                type="number"
                required
                min="0"
                step="1"
                [(ngModel)]="nextStock" /></label
            ><label class="field"
              >Motivo del ajuste<textarea
                name="reason"
                required
                minlength="3"
                maxlength="300"
                [(ngModel)]="reason"
                placeholder="Ej. Ingreso de mercadería"
              ></textarea>
            </label>
            <p class="notice">El ajuste quedará registrado en el historial.</p>
            <button
              class="button primary full-width"
              type="submit"
              [disabled]="f.invalid || store.busy()"
            >
              Confirmar ajuste
            </button>
          </form>
        </section>
      </div>
    }
  `,
})
export class InventoryComponent {
  readonly store = inject(BodegaStore);
  readonly query = signal('');
  readonly filter = signal('all');
  readonly editing = signal<Product | null>(null);
  readonly wasting = signal<Product | null>(null);
  readonly wasteReasons = [
    'Producto vencido',
    'Producto dañado',
    'Pérdida',
    'Diferencia de conteo',
    'Consumo interno',
  ];
  wasteQuantity = 1;
  wasteReason = 'Producto dañado';
  nextStock = 0;
  reason = '';
  readonly units = computed(() => this.store.products().reduce((s, p) => s + p.stock, 0));
  readonly low = computed(
    () => this.store.products().filter((p) => p.stock > 0 && p.stock <= p.minimumStock).length,
  );
  readonly out = computed(() => this.store.products().filter((p) => p.stock === 0).length);
  readonly filtered = computed(() =>
    this.store
      .products()
      .filter(
        (p) =>
          (p.name.toLowerCase().includes(this.query().toLowerCase()) ||
            p.barcode?.toLowerCase().includes(this.query().toLowerCase())) &&
          (this.filter() === 'all' ||
            (this.filter() === 'out' && p.stock === 0) ||
            (this.filter() === 'low' && p.stock > 0 && p.stock <= p.minimumStock)),
      ),
  );
  readonly movements = computed(() =>
    [...(this.store.data()?.movements ?? [])]
      .filter((m) => !this.query() || this.filtered().some((p) => p.id === m.productId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100),
  );
  productName(id: string) {
    return this.store.products().find((p) => p.id === id)?.name ?? 'Producto';
  }
  adjust(p: Product) {
    this.editing.set(p);
    this.nextStock = p.stock;
    this.reason = '';
  }
  async save() {
    const p = this.editing();
    if (p && (await this.store.adjustStock(p.id, this.nextStock, this.reason)))
      this.editing.set(null);
  }
  equivalence(p: Product) {
    return stockEquivalence(p);
  }
  waste(p: Product) {
    this.wasting.set(p);
    this.wasteQuantity = 1;
    this.wasteReason = 'Producto dañado';
  }
  async saveWaste() {
    const p = this.wasting();
    if (p && (await this.store.recordWaste(p.id, this.wasteQuantity, this.wasteReason)))
      this.wasting.set(null);
  }
}

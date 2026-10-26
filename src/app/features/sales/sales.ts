import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BodegaStore } from '../../core/application/store';
import { Sale, paymentNames } from '../../core/domain/models';
import { peruDate } from '../../core/domain/rules';
import { SolesPipe, PeruTimePipe } from '../../shared/format';
import { ReceiptComponent } from '../../shared/receipt';
@Component({
  selector: 'app-sales',
  imports: [FormsModule, SolesPipe, PeruTimePipe, ReceiptComponent],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">CADA VENTA, UNA HISTORIA</div>
        <h1>Historial de ventas<span class="heading-dot">.</span></h1>
        <p>Consulta tus operaciones y sus comprobantes internos.</p>
      </div>
      <span class="badge green">{{ store.sales().length }} ventas registradas</span>
    </div>
    <section class="panel">
      <div class="table-toolbar">
        <div class="search-box">
          <span>⌕</span
          ><input
            aria-label="Buscar número de venta"
            placeholder="Buscar por número, ej. V-000001"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />
        </div>
        <label class="inline-field"
          >Desde<input
            type="date"
            [ngModel]="from()"
            (ngModelChange)="from.set($event)"
            aria-label="Fecha desde" /></label
        ><label class="inline-field"
          >Hasta<input
            type="date"
            [ngModel]="to()"
            (ngModelChange)="to.set($event)"
            aria-label="Fecha hasta" /></label
        ><button class="text-button" (click)="query.set(''); from.set(''); to.set('')">
          Limpiar
        </button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Fecha · Perú</th>
              <th>Productos</th>
              <th>Método de pago</th>
              <th>Total</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            @for (s of filtered(); track s.id) {
              <tr>
                <td class="mono">
                  <strong>{{ s.number }}</strong>
                </td>
                <td>{{ s.createdAt | peruTime }}</td>
                <td>{{ units(s.id) }} un.</td>
                <td>
                  <span class="badge" [class.green]="s.method === 'cash'">{{
                    names[s.method]
                  }}</span>
                </td>
                <td>
                  <strong>{{ s.totalCents | soles }}</strong>
                </td>
                <td>
                  <button class="text-button" (click)="selected.set(s)">Ver comprobante ↗</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="empty-state">
                  <h3>
                    {{
                      store.sales().length
                        ? 'No hay ventas con estos filtros'
                        : 'Tu próxima venta empieza aquí'
                    }}
                  </h3>
                  <p>Las ventas confirmadas se guardan en este dispositivo.</p>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="panel-footer">
        {{ filtered().length }} ventas · Total del filtro: <strong>{{ total() | soles }}</strong>
      </div>
    </section>
    @if (selected(); as s) {
      <app-receipt [sale]="s" (dismiss)="selected.set(null)" />
    }
  `,
})
export class SalesComponent {
  readonly store = inject(BodegaStore);
  readonly query = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly selected = signal<Sale | null>(null);
  readonly names = paymentNames;
  readonly filtered = computed(() =>
    this.store
      .sales()
      .filter(
        (s) =>
          s.number.toLowerCase().includes(this.query().toLowerCase()) &&
          (!this.from() || peruDate(s.createdAt) >= this.from()) &&
          (!this.to() || peruDate(s.createdAt) <= this.to()),
      ),
  );
  readonly total = computed(() => this.filtered().reduce((sum, s) => sum + s.totalCents, 0));
  units(id: string) {
    return (
      this.store
        .data()
        ?.lines.filter((l) => l.saleId === id)
        .reduce((sum, l) => sum + l.quantity, 0) ?? 0
    );
  }
}

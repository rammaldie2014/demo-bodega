import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BodegaStore } from '../../core/application/store';
import { moneyToCents } from '../../core/domain/rules';
import { SolesPipe, PeruTimePipe } from '../../shared/format';
@Component({
  selector: 'app-cash',
  imports: [FormsModule, RouterLink, SolesPipe, PeruTimePipe],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">EMPIEZA Y TERMINA CON CLARIDAD</div>
        <h1>Mi caja<span class="heading-dot">.</span></h1>
        <p>Controla tu efectivo de principio a fin.</p>
      </div>
      <span class="badge" [class.green]="!!store.currentCash()">{{
        store.currentCash() ? 'Caja abierta' : 'Caja cerrada'
      }}</span>
    </div>
    @if (store.currentCash(); as session) {
      <div class="metric-grid">
        <div class="metric-card">
          <span>Monto inicial</span><strong>{{ session.openingCents | soles }}</strong
          ><small>{{ session.openedAt | peruTime }}</small>
        </div>
        <div class="metric-card">
          <span>Ventas en efectivo</span><strong>{{ cashSales() | soles }}</strong
          ><small>Ingresos de esta sesión</small>
        </div>
        <div class="metric-card">
          <span>Yape + Plin simulados</span><strong>{{ digitalSales() | soles }}</strong
          ><small>No representan dinero recibido</small>
        </div>
        <div class="metric-card accent">
          <span>Efectivo esperado</span><strong>{{ expected() | soles }}</strong
          ><small>Monto inicial + ventas en efectivo</small>
        </div>
      </div>
      <div class="two-columns">
        <section class="panel padded">
          <h2>Tu caja está lista</h2>
          <p class="muted">{{ sessionSales().length }} ventas registradas en esta sesión.</p>
          <div class="payment-summary">
            <div>
              <span>Efectivo</span><strong>{{ cashSales() | soles }}</strong>
            </div>
            <div>
              <span>Yape · simulado</span><strong>{{ methodTotal('yape') | soles }}</strong>
            </div>
            <div>
              <span>Plin · simulado</span><strong>{{ methodTotal('plin') | soles }}</strong>
            </div>
          </div>
          <a class="button primary" routerLink="/pos">Ir al punto de venta →</a>
        </section>
        <section class="panel padded">
          <h2>Cerrar caja</h2>
          <p class="muted">Cuenta el efectivo físico, incluido el monto inicial.</p>
          <form (ngSubmit)="close()" #closeForm="ngForm">
            <label class="field"
              >Efectivo contado (S/)<input
                name="counted"
                type="number"
                required
                min="0"
                step="0.01"
                [(ngModel)]="counted"
                placeholder="0.00"
            /></label>
            <div class="detail-row">
              <span>Diferencia</span><strong>{{ difference() | soles }}</strong>
            </div>
            <p class="notice amber">
              El cierre es definitivo. La sesión conservará sus ventas e importes.
            </p>
            <button
              class="button primary full-width"
              type="submit"
              [disabled]="closeForm.invalid || store.busy()"
            >
              Cerrar caja
            </button>
          </form>
        </section>
      </div>
    } @else {
      <section class="panel cash-opening">
        <div class="opening-icon">▧</div>
        <span class="eyebrow">UN NUEVO COMIENZO</span>
        <h2>Abre tu caja y empieza el día</h2>
        <p>Registra el efectivo inicial que tienes para dar vuelto.</p>
        <form (ngSubmit)="open()" #openForm="ngForm">
          <label class="field"
            >Monto inicial (S/)<input
              name="opening"
              type="number"
              required
              min="0"
              step="0.01"
              [(ngModel)]="opening"
              placeholder="100.00" /></label
          ><button
            class="button primary full-width"
            type="submit"
            [disabled]="openForm.invalid || store.busy()"
          >
            Abrir caja →
          </button>
        </form>
        <small>Una sola sesión abierta por instalación local.</small>
      </section>
    }
    <section class="panel section-space">
      <div class="panel-heading"><h2>Sesiones de caja</h2></div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Apertura · Perú</th>
              <th>Cierre · Perú</th>
              <th>Inicial</th>
              <th>Esperado</th>
              <th>Contado</th>
              <th>Diferencia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (s of sessions(); track s.id) {
              <tr>
                <td>{{ s.openedAt | peruTime }}</td>
                <td>{{ s.closedAt | peruTime }}</td>
                <td>{{ s.openingCents | soles }}</td>
                <td>{{ s.expectedCents === undefined ? '—' : (s.expectedCents | soles) }}</td>
                <td>{{ s.countedCents === undefined ? '—' : (s.countedCents | soles) }}</td>
                <td>{{ s.differenceCents === undefined ? '—' : (s.differenceCents | soles) }}</td>
                <td>
                  <span class="badge" [class.green]="s.status === 'open'">{{
                    s.status === 'open' ? 'Abierta' : 'Cerrada'
                  }}</span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty-state">Tu primera sesión aparecerá aquí.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class CashComponent {
  readonly store = inject(BodegaStore);
  opening: string | number = '';
  counted: string | number = '';
  readonly sessions = computed(() =>
    [...(this.store.data()?.sessions ?? [])].sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
  );
  readonly sessionSales = computed(() =>
    this.store.sales().filter((s) => s.sessionId === this.store.currentCash()?.id),
  );
  readonly cashSales = computed(() => this.methodTotal('cash'));
  readonly digitalSales = computed(() => this.methodTotal('yape') + this.methodTotal('plin'));
  readonly expected = computed(
    () => (this.store.currentCash()?.openingCents ?? 0) + this.cashSales(),
  );
  methodTotal(method: string) {
    return this.sessionSales()
      .filter((s) => s.method === method)
      .reduce((sum, s) => sum + s.totalCents, 0);
  }
  difference() {
    try {
      return moneyToCents(this.counted) - this.expected();
    } catch {
      return 0;
    }
  }
  async open() {
    try {
      await this.store.openCash(moneyToCents(this.opening));
      this.opening = '';
    } catch (e) {
      this.store.notifications.handleError(e);
    }
  }
  async close() {
    try {
      const session = this.store.currentCash();
      if (!session) return;
      const amount = moneyToCents(this.counted);
      if (window.confirm('¿Cerrar la caja? La sesión no podrá modificarse.')) {
        await this.store.closeCash(session.id, amount);
        this.counted = '';
      }
    } catch (e) {
      this.store.notifications.handleError(e);
    }
  }
}

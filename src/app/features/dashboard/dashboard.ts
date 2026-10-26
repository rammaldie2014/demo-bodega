import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BodegaStore } from '../../core/application/store';
import { paymentNames } from '../../core/domain/models';
import { peruDate } from '../../core/domain/rules';
import { SolesPipe, PeruTimePipe } from '../../shared/format';
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, SolesPipe, PeruTimePipe],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">TU NEGOCIO DE UN VISTAZO</div>
        <h1>¡Buen día, bodeguero!<span class="heading-dot">✧</span></h1>
        <p>Así va tu bodega hoy. Cada venta suma.</p>
      </div>
      <a class="button primary" routerLink="/pos">+ Nueva venta</a>
    </div>
    <div class="metric-grid">
      <div class="metric-card accent">
        <span>Ventas de hoy</span><strong>{{ total() | soles }}</strong
        ><small>Incluye Yape y Plin simulados</small>
      </div>
      <div class="metric-card">
        <span>Operaciones de hoy</span><strong>{{ todaySales().length }}</strong
        ><small>Ventas confirmadas en este dispositivo</small>
      </div>
      <div class="metric-card">
        <span>Productos registrados</span><strong>{{ store.products().length }}</strong
        ><small>{{ active() }} activos en tu catálogo</small>
      </div>
      <div class="metric-card">
        <span>Productos por reponer</span><strong class="text-amber">{{ low().length }}</strong
        ><small>Stock bajo o agotado, productos activos</small>
      </div>
    </div>
    <div class="two-columns dashboard-columns">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Últimas ventas</h2>
            <p>Las operaciones más recientes de tu bodega.</p>
          </div>
          <a class="text-button" routerLink="/sales">Ver todas ↗</a>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Venta</th>
                <th>Fecha · Perú</th>
                <th>Pago</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              @for (s of store.sales().slice(0, 7); track s.id) {
                <tr>
                  <td class="mono">{{ s.number }}</td>
                  <td>{{ s.createdAt | peruTime }}</td>
                  <td>{{ names[s.method] }}</td>
                  <td>
                    <strong>{{ s.totalCents | soles }}</strong>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="empty-state">
                    <div class="opening-icon">↗</div>
                    <h3>Un buen día empieza con una venta</h3>
                    <p>Abre caja y registra tu primera operación.</p>
                    <a class="text-button" routerLink="/cash">Ir a mi caja →</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel padded">
        <h2>¿Cómo te pagaron hoy?</h2>
        <p class="muted">Resumen por método de pago.</p>
        <div class="payment-summary">
          @for (m of methods; track m) {
            <div>
              <span>{{ names[m] }}</span
              ><strong>{{ methodTotal(m) | soles }}</strong>
            </div>
            <div class="bar-track">
              <span [style.width.%]="total() ? (methodTotal(m) / total()) * 100 : 0"></span>
            </div>
          }
        </div>
        <p class="notice">
          Yape y Plin son demostraciones. Sus importes no representan dinero recibido.
        </p>
      </section>
    </div>
    <section class="panel section-space">
      <div class="panel-heading">
        <div>
          <h2>Un ojo en tu inventario</h2>
          <p>Estos productos necesitan atención.</p>
        </div>
        <a class="text-button" routerLink="/inventory">Ver inventario ↗</a>
      </div>
      <div class="low-stock-list">
        @for (p of low().slice(0, 8); track p.id) {
          <div>
            <span class="low-stock-icon">◇</span
            ><span
              ><strong>{{ p.name }}</strong
              ><small>Mínimo: {{ p.minimumStock }} un.</small></span
            ><span class="badge amber">{{ p.stock === 0 ? 'Agotado' : p.stock + ' un.' }}</span>
          </div>
        } @empty {
          <p class="empty-state">Tu inventario está al día.</p>
        }
      </div>
    </section>
  `,
})
export class DashboardComponent {
  readonly store = inject(BodegaStore);
  readonly names = paymentNames;
  readonly methods = ['cash', 'yape', 'plin'] as const;
  readonly today = signal(peruDate());
  constructor() {
    const timer = setInterval(() => this.today.set(peruDate()), 60000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  readonly todaySales = computed(() =>
    this.store.sales().filter((s) => peruDate(s.createdAt) === this.today()),
  );
  readonly total = computed(() => this.todaySales().reduce((sum, s) => sum + s.totalCents, 0));
  readonly active = computed(() => this.store.products().filter((p) => p.active).length);
  readonly low = computed(() =>
    this.store
      .products()
      .filter((p) => p.active && p.stock <= p.minimumStock)
      .sort((a, b) => a.stock - b.stock),
  );
  methodTotal(method: string) {
    return this.todaySales()
      .filter((s) => s.method === method)
      .reduce((sum, s) => sum + s.totalCents, 0);
  }
}

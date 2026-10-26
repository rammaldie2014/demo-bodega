import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { BodegaStore } from './core/application/store';
import { PeruTimePipe } from './shared/format';
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, PeruTimePipe],
  template: `
    <a class="skip-link" href="#main">Saltar al contenido</a>
    <div class="app-shell">
      <aside class="sidebar" [class.mobile-open]="menu()">
        <a class="brand" routerLink="/pos" (click)="menu.set(false)"
          ><span class="brand-icon">▣</span
          ><span>mi bodega<small>Tu negocio, en orden.</small></span></a
        >
        <div class="store-switch">
          <span class="store-avatar">MB</span
          ><span><strong>Bodega La Esquina</strong><small>Mi espacio de trabajo</small></span
          ><span class="muted">⌄</span>
        </div>
        <p class="nav-caption">PRINCIPAL</p>
        <nav aria-label="Navegación principal">
          @for (link of links; track link.path) {
            <a [routerLink]="link.path" routerLinkActive="active" (click)="menu.set(false)"
              ><span class="nav-icon">{{ link.icon }}</span
              >{{ link.name }}
              @if (link.path === '/pos') {
                <span class="nav-shortcut">POS</span>
              }
            </a>
          }
        </nav>
        <div class="sidebar-bottom">
          <div class="local-card">
            <span class="local-icon">◉</span><strong>Tu bodega va contigo</strong>
            <p>Tus datos se guardan en este dispositivo. También sin internet.</p>
            <span class="badge green">Almacenamiento local</span>
          </div>
          <a
            routerLink="/settings"
            routerLinkActive="active"
            class="settings-link"
            (click)="menu.set(false)"
            ><span>⚙</span> Configuración</a
          >
          <div class="sidebar-footer">
            <span class="profile-avatar">DE</span
            ><span
              ><strong>Cuenta de demostración</strong><small>Instalación local · v1.0</small></span
            >
          </div>
        </div>
      </aside>
      @if (menu()) {
        <button class="mobile-scrim" (click)="menu.set(false)" aria-label="Cerrar menú"></button>
      }
      <div class="workspace">
        <header class="topbar">
          <div class="breadcrumb">
            <button
              class="icon-button mobile-menu"
              (click)="menu.set(!menu())"
              aria-label="Abrir menú"
            >
              ☰</button
            ><span class="desktop-only">Mi espacio de trabajo</span
            ><span class="desktop-only muted">/</span><strong>Bodega La Esquina</strong>
          </div>
          <div class="topbar-right">
            <span class="connection" [class.offline]="!online()"
              ><i></i>{{ online() ? 'Con conexión' : 'Sin conexión' }}</span
            ><span class="demo-pill">DEMO</span><span class="profile-avatar small">DE</span>
          </div>
        </header>
        <main id="main">
          <div class="global-info">
            <span>✧ &nbsp; Una forma más simple de llevar tu negocio.</span
            ><span class="desktop-only">{{ now | peruTime: 'date' }} · Perú</span>
          </div>
          @if (updateReady()) {
            <div class="notice">
              <span>Hay una nueva versión. Termina tu venta antes de actualizar.</span
              ><button
                class="button secondary"
                (click)="reload()"
                [disabled]="store.cart().length > 0 || store.busy()"
              >
                Actualizar
              </button>
            </div>
          }
          @if (store.failed()) {
            <div class="empty-state">
              <h1>No pudimos abrir los datos locales</h1>
              <p>Permite el almacenamiento del sitio y vuelve a intentarlo.</p>
              <button class="button primary" (click)="store.initialize()">Reintentar</button>
            </div>
          } @else if (store.data()) {
            <router-outlet />
          } @else {
            <p class="empty-state" role="status">Preparando tu bodega…</p>
          }
          <footer class="main-footer">
            <span>Mi Bodega <span class="muted">· Versión demostrativa</span></span
            ><span>Hecho para el día a día de tu negocio.</span>
          </footer>
        </main>
      </div>
    </div>
    @if (store.notifications.message(); as notification) {
      <div class="toast" [class.error]="notification.error" role="alert">
        <span>{{ notification.error ? '!' : '✓' }}</span
        >{{ notification.text
        }}<button
          class="icon-button"
          aria-label="Cerrar notificación"
          (click)="store.notifications.message.set(null)"
        >
          ×
        </button>
      </div>
    }
  `,
})
export class AppComponent {
  readonly store = inject(BodegaStore);
  readonly menu = signal(false);
  readonly online = signal(navigator.onLine);
  readonly updateReady = signal(false);
  readonly now = new Date().toISOString();
  readonly links = [
    { path: '/dashboard', name: 'Resumen', icon: '▦' },
    { path: '/pos', name: 'Punto de venta', icon: '▣' },
    { path: '/products', name: 'Productos', icon: '◇' },
    { path: '/inventory', name: 'Inventario', icon: '▤' },
    { path: '/stock-receipts', name: 'Ingreso de mercadería', icon: '↓' },
    { path: '/promotions', name: 'Promociones', icon: '✦' },
    { path: '/sales', name: 'Historial de ventas', icon: '↗' },
    { path: '/cash', name: 'Mi caja', icon: '▧' },
  ];
  constructor() {
    const destroy = inject(DestroyRef);
    const online = () => this.online.set(navigator.onLine);
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    destroy.onDestroy(() => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
    });
    const sw = inject(SwUpdate);
    if (sw.isEnabled) {
      const subscription = sw.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') this.updateReady.set(true);
      });
      destroy.onDestroy(() => subscription.unsubscribe());
    }
  }
  reload() {
    window.location.reload();
  }
}

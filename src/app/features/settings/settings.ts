import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BodegaStore } from '../../core/application/store';
@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  template: `
    <div class="page-heading">
      <div>
        <div class="eyebrow">A TU MANERA</div>
        <h1>Configuración<span class="heading-dot">.</span></h1>
        <p>Prepara tu instalación para el día a día.</p>
      </div>
      <span class="demo-pill">DEMO v1.0</span>
    </div>
    <div class="settings-grid">
      <section class="panel padded">
        <h2>Lector de códigos de barras</h2>
        <p class="muted">Compatible con lectores USB en modo teclado HID.</p>
        <label class="checkbox-field"
          ><input
            type="checkbox"
            [ngModel]="store.data()?.settings?.scanWithEnter"
            (ngModelChange)="store.saveScanner($event)"
          />El lector finaliza el escaneo con Enter</label
        >
        <p class="notice">
          Si desactivas esta opción, el campo de escaneo detectará el código tras 250 ms sin recibir
          caracteres. Usa el botón Escanear en el POS.
        </p>
        <p class="muted">
          Prueba con <code>DEMO-001</code> (gaseosa) y <code>DEMO-007</code> (leche). Los códigos
          DEMO no son códigos comerciales reales.
        </p>
      </section>
      <section class="panel padded">
        <h2>Tus datos, en este dispositivo</h2>
        <p class="muted">
          Productos, ventas e inventario se almacenan en IndexedDB. Se comparten entre las pestañas
          del mismo origen y perfil.
        </p>
        <p class="notice amber">
          Borrar los datos del sitio, usar navegación privada o perder el dispositivo puede eliminar
          tu información. Esta demo no tiene respaldo ni sincronización entre dispositivos.
        </p>
        <button class="button secondary" (click)="requestPersistence()">
          Solicitar conservación del almacenamiento
        </button>
        <p class="muted" role="status">{{ persistenceMessage }}</p>
      </section>
      <section class="panel padded">
        <h2>Instalación y modo offline</h2>
        <p>
          En Chrome, abre el menú y selecciona «Instalar Mi Bodega» cuando esté disponible. Usa la
          compilación de producción sobre localhost o HTTPS.
        </p>
        <p class="muted">
          La primera carga necesita conexión. Espera a que el service worker termine de almacenar
          los recursos antes de desconectarte. El indicador de conexión solo informa el estado del
          navegador.
        </p>
        <p class="notice">
          Las nuevas versiones se anuncian en la parte superior. Finaliza tu carrito antes de
          actualizar.
        </p>
      </section>
      <section class="panel padded danger-zone">
        <h2>Restaurar demostración</h2>
        <p>
          Elimina ventas, sesiones y ajustes de esta instalación y vuelve a cargar el catálogo
          inicial de 42 productos, incluidas las presentaciones de HU-002.
        </p>
        <p class="muted">Esta acción no se puede deshacer y afecta las otras pestañas abiertas.</p>
        <button class="button danger" [disabled]="store.busy()" (click)="restore()">
          Restaurar datos de demo
        </button>
      </section>
    </div>
    <p class="notice">
      Versión demostrativa. No incluye autenticación, pagos reales, comprobantes SUNAT ni seguridad
      multiusuario. Requiere validaciones adicionales antes de un uso comercial.
    </p>
  `,
})
export class SettingsComponent {
  readonly store = inject(BodegaStore);
  persistenceMessage = '';
  async requestPersistence() {
    try {
      this.persistenceMessage = (await navigator.storage?.persist?.())
        ? 'El navegador concedió almacenamiento persistente. Aun así, borrar los datos del sitio elimina la información.'
        : 'El navegador no concedió la solicitud. La conservación depende de su política de almacenamiento.';
    } catch {
      this.persistenceMessage = 'Esta función no está disponible en el navegador.';
    }
  }
  async restore() {
    if (
      window.confirm(
        'Se eliminarán TODAS las ventas, cajas, productos y ajustes locales. ¿Restaurar la demostración?',
      )
    )
      await this.store.restore();
  }
}

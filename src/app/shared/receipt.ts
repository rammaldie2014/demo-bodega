import { Component, input, output, inject } from '@angular/core';
import { Sale, paymentNames } from '../core/domain/models';
import { BodegaStore } from '../core/application/store';
import { SolesPipe, PeruTimePipe } from './format';
import { DialogDirective } from './dialog';
@Component({
  selector: 'app-receipt',
  imports: [SolesPipe, PeruTimePipe, DialogDirective],
  template: ` <div class="modal-backdrop">
    <section
      class="modal receipt"
      role="dialog"
      appDialog
      (escapeDialog)="dismiss.emit()"
      aria-modal="true"
      aria-labelledby="receipt-title"
      tabindex="-1"
    >
      <div class="no-print receipt-top">
        <span class="badge green">Venta registrada</span
        ><button class="icon-button" (click)="dismiss.emit()" aria-label="Cerrar comprobante">
          ×
        </button>
      </div>
      <div class="receipt-brand">▣</div>
      <h2 id="receipt-title">Mi Bodega</h2>
      <p class="muted">Comprobante interno de demostración</p>
      <h3>{{ sale().number }}</h3>
      <p class="muted">{{ sale().createdAt | peruTime }}</p>
      <div class="receipt-lines">
        @for (line of lines(); track line.id) {
          <div>
            <span
              >{{ line.quantity }} × {{ line.name
              }}<small
                >{{ line.presentationName || 'Unidad' }} · {{ line.unitPriceCents | soles }} por
                presentación</small
              >
              @if (line.unitsPerPresentation && line.unitsPerPresentation > 1) {
                <small>{{ line.baseQuantity }} unidades base</small>
              }
              @if (line.discountCents) {
                <small
                  >Ahorro promocional: {{ line.discountCents | soles }} ({{
                    line.promotionGroupQuantity
                  }}
                  por {{ line.promotionGroupPriceCents | soles }})</small
                >
              }</span
            ><strong>{{ line.totalCents ?? line.subtotalCents | soles }}</strong>
          </div>
        }
      </div>
      <div class="total-row">
        <span>Total</span><strong>{{ sale().totalCents | soles }}</strong>
      </div>
      <div class="detail-row">
        <span>Método de pago</span><strong>{{ names[sale().method] }}</strong>
      </div>
      @if (sale().method === 'cash') {
        <div class="detail-row">
          <span>Recibido</span><span>{{ sale().receivedCents | soles }}</span>
        </div>
        <div class="detail-row">
          <span>Vuelto</span><span>{{ sale().changeCents | soles }}</span>
        </div>
      }
      @if (sale().simulated) {
        <p class="notice amber">
          Pago simulado. No se ha verificado ni recibido dinero mediante esta aplicación.
        </p>
      }
      <p class="receipt-disclaimer">
        Sin validez tributaria. No es boleta ni factura SUNAT.<br />¡Gracias por tu visita!
      </p>
      <div class="button-row no-print">
        <button class="button secondary" (click)="print()">Imprimir</button
        ><button class="button primary" (click)="dismiss.emit()">Continuar</button>
      </div>
    </section>
  </div>`,
})
export class ReceiptComponent {
  readonly sale = input.required<Sale>();
  readonly dismiss = output<void>();
  private readonly store = inject(BodegaStore);
  readonly names = paymentNames;
  lines() {
    return this.store.data()?.lines.filter((l) => l.saleId === this.sale().id) ?? [];
  }
  print() {
    window.print();
  }
}

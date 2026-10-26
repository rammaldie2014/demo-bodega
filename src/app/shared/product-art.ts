import { Component, input } from '@angular/core';
@Component({
  selector: 'app-product-art',
  template: `<div class="product-art" [class]="'product-art art-' + category()">
    <div class="package">
      <span class="package-mark">{{ mark() }}</span
      ><span class="package-line"></span><small>{{ caption() }}</small>
    </div>
  </div>`,
})
export class ProductArtComponent {
  readonly category = input<string>();
  readonly name = input('');
  mark() {
    return (
      (
        {
          bebidas: 'gota',
          lacteos: 'leche',
          abarrotes: 'natural',
          snacks: 'crunch',
          limpieza: 'puro',
          higiene: 'cuidado',
          panaderia: 'del día',
        } as Record<string, string>
      )[this.category() ?? ''] ?? 'bodega'
    );
  }
  caption() {
    return this.name().split(' ').slice(0, 2).join(' ');
  }
}

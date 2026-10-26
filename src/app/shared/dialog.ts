import { afterNextRender, DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';

/** Keeps keyboard navigation inside an open modal and restores the invoking control. */
@Directive({ selector: '[appDialog]', host: { tabindex: '-1', '(keydown)': 'onKeydown($event)' } })
export class DialogDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly escapeDialog = output<void>();
  constructor() {
    const previous = document.activeElement;
    afterNextRender(() => {
      const input = this.element.querySelector<HTMLElement>(
        'input:not([disabled]), select, textarea',
      );
      (input ?? this.controls()[0] ?? this.element).focus();
    });
    inject(DestroyRef).onDestroy(() => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    });
  }
  private controls(): HTMLElement[] {
    return [
      ...this.element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      ),
    ].filter((element) => element.getClientRects().length > 0);
  }
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.escapeDialog.emit();
    }
    if (event.key !== 'Tab') return;
    const controls = this.controls();
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) {
      event.preventDefault();
      this.element.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === this.element)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

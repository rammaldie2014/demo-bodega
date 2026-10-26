import { ErrorHandler, Injectable, signal } from '@angular/core';
import { BusinessError } from '../domain/rules';
@Injectable({ providedIn: 'root' })
export class Notifications extends ErrorHandler {
  readonly message = signal<{ text: string; error: boolean } | null>(null);
  private timer?: ReturnType<typeof setTimeout>;
  show(text: string, error = false): void {
    clearTimeout(this.timer);
    this.message.set({ text, error });
    this.timer = setTimeout(() => this.message.set(null), error ? 10000 : 5000);
  }
  override handleError(error: unknown): void {
    console.error(error);
    this.show(
      error instanceof BusinessError
        ? error.message
        : 'No se pudo completar la operación. Verifica el almacenamiento del navegador e inténtalo otra vez.',
      true,
    );
  }
}

import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'soles' })
export class SolesPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return `S/ ${((value ?? 0) / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
@Pipe({ name: 'peruTime' })
export class PeruTimePipe implements PipeTransform {
  transform(value: string | undefined, mode: 'date' | 'time' | 'full' = 'full'): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      ...(mode === 'time'
        ? { hour: '2-digit', minute: '2-digit' }
        : mode === 'date'
          ? { day: '2-digit', month: 'short', year: 'numeric' }
          : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    }).format(new Date(value));
  }
}

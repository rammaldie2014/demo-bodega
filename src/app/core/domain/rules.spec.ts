import { describe, expect, it } from 'vitest';
import { addToCart, cartTotal, changeFor, moneyToCents, peruDate, validateProduct } from './rules';
import { seedProducts } from '../infrastructure/seed';
describe('Reglas de dominio', () => {
  const p = seedProducts()[0];
  it('agrega e incrementa un producto sin duplicar líneas', () => {
    const cart = addToCart(addToCart([], p), p);
    expect(cart).toEqual([{ productId: p.id, quantity: 2 }]);
    expect(cartTotal(cart, [p])).toBe(700);
  });
  it('impide cantidades superiores al stock', () => {
    expect(() => addToCart([], p, p.stock + 1)).toThrow('stock');
  });
  it('impide cantidades fraccionarias y productos inactivos', () => {
    expect(() => addToCart([], p, 1.5)).toThrow();
    expect(() => addToCart([], { ...p, active: false })).toThrow();
  });
  it('calcula subtotal y total con enteros', () => {
    const q = { ...p, id: 'otro', salePriceCents: 450 };
    expect(
      cartTotal(
        [
          { productId: p.id, quantity: 2 },
          { productId: q.id, quantity: 1 },
        ],
        [p, q],
      ),
    ).toBe(1150);
  });
  it('calcula vuelto y rechaza efectivo insuficiente', () => {
    expect(changeFor(1150, 5000)).toBe(3850);
    expect(() => changeFor(1150, 1000)).toThrow('insuficiente');
  });
  it('convierte dinero sin error de coma flotante', () => {
    expect(moneyToCents('0.29')).toBe(29);
    expect(moneyToCents('10.1')).toBe(1010);
    expect(() => moneyToCents('1.001')).toThrow();
    expect(() => moneyToCents('-1')).toThrow();
    expect(() => moneyToCents('')).toThrow();
  });
  it('rechaza nombres vacíos, precios negativos y stock negativo', () => {
    expect(() => validateProduct({ ...p, name: ' ' })).toThrow();
    expect(() => validateProduct({ ...p, salePriceCents: -1 })).toThrow();
    expect(() => validateProduct({ ...p, stock: -1 })).toThrow();
  });
  it('usa el día peruano incluso cerca de medianoche UTC', () => {
    expect(peruDate('2026-10-25T02:00:00Z')).toBe('2026-10-24');
  });
});

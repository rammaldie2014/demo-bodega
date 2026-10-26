import { describe, expect, it } from 'vitest';
import { Product, Promotion } from './models';
import { addToCart, cartTotal, validateProduct } from './rules';
import { priceLine, stockEquivalence, validateCart } from './pricing';

const product: Product = {
  id: 'candy',
  name: 'Caramelo',
  purchasePriceCents: 12,
  salePriceCents: 20,
  stock: 300,
  minimumStock: 10,
  active: true,
  createdAt: '2026-10-25',
  updatedAt: '2026-10-25',
  unitName: 'Unidad',
  presentations: [
    {
      id: 'bag',
      productId: 'candy',
      name: 'Bolsa x100',
      unitsPerPresentation: 100,
      salePriceCents: 1800,
      active: true,
    },
  ],
};
const promotion: Promotion = {
  id: 'promo',
  productId: 'candy',
  presentationId: 'base',
  groupQuantity: 3,
  groupPriceCents: 50,
  active: true,
};
describe('HU-002: conversiones, carrito y promociones', () => {
  it.each([
    [1, 20],
    [2, 40],
    [3, 50],
    [4, 70],
    [5, 90],
    [6, 100],
    [7, 120],
  ])('%i caramelos cuestan %i céntimos', (quantity, total) => {
    expect(cartTotal([{ productId: 'candy', quantity }], [product], [promotion])).toBe(total);
  });
  it('muestra subtotal, ahorro y total sin duplicar el descuento', () => {
    const line = priceLine({ productId: 'candy', quantity: 7 }, product, [promotion]);
    expect(line).toMatchObject({
      subtotalCents: 140,
      discountCents: 20,
      totalCents: 120,
      baseQuantity: 7,
    });
  });
  it('ignora promociones inactivas, de otro producto o de otra presentación', () => {
    const line = { productId: 'candy', quantity: 7 };
    for (const offer of [
      { ...promotion, active: false },
      { ...promotion, productId: 'other' },
      { ...promotion, presentationId: 'bag' },
    ])
      expect(cartTotal([line], [product], [offer])).toBe(140);
  });
  it('mantiene unidad y bolsa separadas, acumula solo la misma presentación', () => {
    let cart = addToCart([], product);
    cart = addToCart(cart, product, 1, 'bag');
    cart = addToCart(cart, product, 1, 'bag');
    expect(cart).toHaveLength(2);
    expect(cart[1].quantity).toBe(2);
    expect(cartTotal(cart, [product], [promotion])).toBe(3620);
  });
  it('suma las unidades de todas las presentaciones antes de validar stock', () => {
    expect(() =>
      validateCart(
        [
          { productId: 'candy', quantity: 3, presentationId: 'bag' },
          { productId: 'candy', quantity: 1 },
        ],
        [product],
      ),
    ).toThrow('stock');
  });
  it('rechaza conversiones cero, negativas, fraccionarias y precios negativos', () => {
    for (const units of [0, -1, 1.5])
      expect(() =>
        validateProduct({
          ...product,
          presentations: [{ ...product.presentations![0], unitsPerPresentation: units }],
        }),
      ).toThrow('conversión');
    expect(() =>
      validateProduct({
        ...product,
        presentations: [{ ...product.presentations![0], salePriceCents: -1 }],
      }),
    ).toThrow();
  });
  it('rechaza presentación inexistente o inactiva', () => {
    expect(() =>
      validateCart([{ productId: 'candy', quantity: 1, presentationId: 'missing' }], [product]),
    ).toThrow('presentación');
    expect(() =>
      validateCart(
        [{ productId: 'candy', quantity: 1, presentationId: 'bag' }],
        [{ ...product, presentations: [{ ...product.presentations![0], active: false }] }],
      ),
    ).toThrow('inactiva');
  });
  it('no convierte seis unidades en pack automáticamente', () => {
    expect(cartTotal([{ productId: 'candy', quantity: 100 }], [product])).toBe(2000);
    expect(cartTotal([{ productId: 'candy', quantity: 1, presentationId: 'bag' }], [product])).toBe(
      1800,
    );
  });
  it('muestra equivalencia informativa sin generar otro inventario', () => {
    expect(stockEquivalence({ ...product, stock: 293 })).toBe('2 × Bolsa x100 + 93 Unidad');
  });
});

import { CartItem, Product, ProductPresentation, Promotion } from './models';
import { nonnegativeInteger, requireRule } from './rules';

export const productIcons = ['◇', '🍬', '🍯', '◉', '🍭', '🍪', '🥚', '🥖', '🥤', '💧'];
export function lineKey(item: Pick<CartItem, 'productId' | 'presentationId'>): string {
  return `${item.productId}:${item.presentationId ?? 'base'}`;
}
export function basePresentation(product: Product): ProductPresentation {
  return {
    id: 'base',
    productId: product.id,
    name: product.unitName || 'Unidad',
    unitsPerPresentation: 1,
    salePriceCents: product.salePriceCents,
    barcode: product.barcode,
    active: true,
  };
}
export function presentationsOf(product: Product): ProductPresentation[] {
  return [basePresentation(product), ...(product.presentations ?? [])];
}
export function presentationOf(product: Product, id?: string): ProductPresentation {
  const presentation = presentationsOf(product).find((p) => p.id === (id ?? 'base'));
  requireRule(presentation, 'La presentación ya no existe. Revisa el carrito.');
  return presentation;
}
export function presentationPrice(product: Product, presentation: ProductPresentation): number {
  return presentation.salePriceCents ?? product.salePriceCents * presentation.unitsPerPresentation;
}
export function validatePresentations(product: ProductInputLike): void {
  requireRule(
    !product.unitName || product.unitName.trim().length <= 32,
    'La unidad base admite hasta 32 caracteres.',
  );
  requireRule(
    !product.icon || productIcons.includes(product.icon),
    'Selecciona un icono del catálogo.',
  );
  if (product.quickOrder !== undefined) nonnegativeInteger(product.quickOrder, 'El orden rápido');
  const ids = new Set<string>();
  const names = new Set<string>([(product.unitName || 'Unidad').trim().toLowerCase()]);
  for (const p of product.presentations ?? []) {
    requireRule(
      p.id !== 'base' && !!p.id && !ids.has(p.id),
      'Identificador de presentación inválido o duplicado.',
    );
    ids.add(p.id);
    requireRule(
      p.name.trim().length > 0 &&
        p.name.trim().length <= 50 &&
        !names.has(p.name.trim().toLowerCase()),
      'Las presentaciones requieren nombres distintos de 1 a 50 caracteres.',
    );
    names.add(p.name.trim().toLowerCase());
    requireRule(
      Number.isSafeInteger(p.unitsPerPresentation) && p.unitsPerPresentation > 0,
      'La conversión debe ser un entero mayor que cero.',
    );
    if (p.salePriceCents !== undefined)
      nonnegativeInteger(p.salePriceCents, 'El precio por presentación');
    requireRule(
      !p.barcode || /^[a-zA-Z0-9-]{1,48}$/.test(p.barcode),
      'Código de presentación inválido.',
    );
    requireRule(typeof p.active === 'boolean', 'Estado de presentación inválido.');
  }
}
type ProductInputLike = Pick<Product, 'unitName' | 'icon' | 'quickOrder' | 'presentations'>;
export function promotionFor(
  promotions: Promotion[],
  productId: string,
  presentationId?: string,
): Promotion | undefined {
  return promotions.find(
    (p) => p.active && p.productId === productId && p.presentationId === (presentationId ?? 'base'),
  );
}
export function priceLine(item: CartItem, product: Product, promotions: Promotion[]) {
  const presentation = presentationOf(product, item.presentationId);
  const unitPriceCents = presentationPrice(product, presentation);
  const baseQuantity = item.quantity * presentation.unitsPerPresentation;
  nonnegativeInteger(baseQuantity, 'Las unidades base');
  const subtotalCents = unitPriceCents * item.quantity;
  const promotion = promotionFor(promotions, product.id, item.presentationId);
  const totalCents = promotion
    ? Math.floor(item.quantity / promotion.groupQuantity) * promotion.groupPriceCents +
      (item.quantity % promotion.groupQuantity) * unitPriceCents
    : subtotalCents;
  nonnegativeInteger(subtotalCents, 'El subtotal');
  nonnegativeInteger(totalCents, 'El total');
  return {
    ...item,
    key: lineKey(item),
    product,
    presentation,
    unitPriceCents,
    baseQuantity,
    subtotalCents,
    discountCents: subtotalCents - totalCents,
    totalCents,
    promotion,
  };
}
export function validateCart(items: CartItem[], products: Product[], promotions: Promotion[] = []) {
  requireRule(
    new Set(items.map(lineKey)).size === items.length,
    'El carrito contiene productos duplicados en la misma presentación.',
  );
  const consumed = new Map<string, number>();
  return items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    requireRule(product?.active, 'El producto no está disponible.');
    requireRule(Number.isSafeInteger(item.quantity) && item.quantity > 0, 'Cantidad inválida.');
    const line = priceLine(item, product, promotions);
    requireRule(line.presentation.active, 'La presentación está inactiva.');
    const units = (consumed.get(product.id) ?? 0) + line.baseQuantity;
    requireRule(
      Number.isSafeInteger(units) && units <= product.stock,
      `No hay stock suficiente para ${product.name}.`,
    );
    consumed.set(product.id, units);
    return line;
  });
}
export function stockEquivalence(product: Product): string {
  const pack = [...(product.presentations ?? [])]
    .filter((p) => p.active && p.unitsPerPresentation > 1)
    .sort((a, b) => b.unitsPerPresentation - a.unitsPerPresentation)[0];
  return pack
    ? `${Math.floor(product.stock / pack.unitsPerPresentation)} × ${pack.name} + ${product.stock % pack.unitsPerPresentation} ${product.unitName || 'un.'}`
    : `${product.stock} ${product.unitName || 'un.'}`;
}

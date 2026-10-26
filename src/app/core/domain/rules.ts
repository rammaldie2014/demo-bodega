import { CartItem, Product, ProductInput, Promotion } from './models';
import { lineKey, validateCart, validatePresentations } from './pricing';
export class BusinessError extends Error {}
export function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BusinessError(message);
}
export function nonnegativeInteger(value: number, label: string): void {
  requireRule(
    Number.isSafeInteger(value) && value >= 0,
    `${label} debe ser un entero mayor o igual a cero.`,
  );
}
export function validateProduct(input: ProductInput): void {
  requireRule(
    input.name.trim().length > 0 && input.name.trim().length <= 120,
    'Escribe un nombre de 1 a 120 caracteres.',
  );
  requireRule(
    !input.barcode || /^[a-zA-Z0-9-]{1,48}$/.test(input.barcode),
    'El código admite hasta 48 letras, números o guiones.',
  );
  nonnegativeInteger(input.purchasePriceCents, 'El precio de compra');
  nonnegativeInteger(input.salePriceCents, 'El precio de venta');
  nonnegativeInteger(input.stock, 'El stock');
  nonnegativeInteger(input.minimumStock, 'El stock mínimo');
  validatePresentations(input);
}
export function moneyToCents(value: string | number): number {
  const text = String(value).trim();
  requireRule(/^\d+(\.\d{1,2})?$/.test(text), 'Ingresa un importe válido con hasta dos decimales.');
  const [whole, decimal = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  nonnegativeInteger(result, 'El importe');
  return result;
}
export function cartTotal(
  items: CartItem[],
  products: Product[],
  promotions: Promotion[] = [],
): number {
  const total = validateCart(items, products, promotions).reduce(
    (sum, line) => sum + line.totalCents,
    0,
  );
  nonnegativeInteger(total, 'El total');
  return total;
}
export function addToCart(
  items: CartItem[],
  product: Product,
  quantity = 1,
  presentationId?: string,
): CartItem[] {
  const item: CartItem = {
    productId: product.id,
    quantity,
    ...(presentationId && presentationId !== 'base' ? { presentationId } : {}),
  };
  const key = lineKey(item);
  const amount = (items.find((i) => lineKey(i) === key)?.quantity ?? 0) + quantity;
  const next = [...items.filter((i) => lineKey(i) !== key), { ...item, quantity: amount }];
  validateCart(
    next.filter((i) => i.productId === product.id),
    [product],
  );
  return next;
}
export function peruDate(value = new Date().toISOString()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function changeFor(total: number, received: number): number {
  nonnegativeInteger(received, 'El importe recibido');
  requireRule(received >= total, 'El importe recibido es insuficiente.');
  return received - total;
}

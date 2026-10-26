import { Product, ProductInput } from '../domain/models';
export const hu2Catalog: ProductInput[] = [
  {
    name: 'Caramelo surtido',
    icon: '🍬',
    salePriceCents: 20,
    purchasePriceCents: 12,
    stock: 0,
    bag: 100,
    pack: 'Bolsa x100',
  },
  {
    name: 'Toffee',
    icon: '🍯',
    salePriceCents: 30,
    purchasePriceCents: 18,
    stock: 80,
    bag: 80,
    pack: 'Bolsa x80',
  },
  {
    name: 'Chicle',
    icon: '◉',
    salePriceCents: 50,
    purchasePriceCents: 25,
    stock: 50,
    bag: 50,
    pack: 'Caja x50',
  },
  {
    name: 'Chupetín',
    icon: '🍭',
    salePriceCents: 50,
    purchasePriceCents: 30,
    stock: 40,
    bag: 40,
    pack: 'Bolsa x40',
  },
  {
    name: 'Galleta suelta',
    icon: '🍪',
    salePriceCents: 100,
    purchasePriceCents: 60,
    stock: 24,
    bag: 12,
    pack: 'Paquete x12',
  },
  {
    name: 'Huevo por unidad',
    icon: '🥚',
    salePriceCents: 70,
    purchasePriceCents: 45,
    stock: 30,
    bag: 30,
    pack: 'Bandeja x30',
  },
].map((p, index) => ({
  name: p.name,
  icon: p.icon,
  salePriceCents: p.salePriceCents,
  purchasePriceCents: p.purchasePriceCents,
  stock: p.stock,
  categoryId: p.icon === '🥚' ? 'abarrotes' : 'snacks',
  unitName: 'Unidad',
  favorite: true,
  quickOrder: index,
  minimumStock: 10,
  active: true,
  presentations: [
    {
      id: crypto.randomUUID(),
      productId: '',
      name: p.pack,
      unitsPerPresentation: p.bag,
      active: true,
    },
  ],
}));
export function demoPack(product: Product) {
  const isCola = product.barcode === 'DEMO-001';
  return {
    id: crypto.randomUUID(),
    productId: product.id,
    name: isCola ? 'Pack x6' : 'Pack x12',
    unitsPerPresentation: isCola ? 6 : 12,
    salePriceCents: isCola ? 1600 : 2100,
    active: true,
  };
}

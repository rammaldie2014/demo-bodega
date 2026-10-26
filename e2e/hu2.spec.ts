import { expect, Page, test } from '@playwright/test';

async function openCash(page: Page) {
  await page.goto('/cash');
  await page.getByLabel('Monto inicial (S/)').fill('100');
  await page.getByRole('button', { name: 'Abrir caja →' }).click();
  await expect(page.getByRole('heading', { name: 'Tu caja está lista' })).toBeVisible();
}
async function paySimulated(page: Page) {
  await page.getByRole('button', { name: 'Cobrar venta' }).click();
  await page.getByRole('button', { name: 'Yape · demo', exact: true }).click();
  await page.getByLabel('Confirmar manualmente el pago simulado').check();
  await page.getByRole('button', { name: 'Registrar venta simulada' }).click();
  await expect(page.getByRole('dialog')).toContainText('Venta registrada');
}
async function receiveCandy(page: Page, name: string, quantity: string, cost: string) {
  await page.goto('/stock-receipts');
  await page.getByLabel('Producto de ingreso').selectOption({ label: '🍬 ' + name });
  await page.getByLabel('Presentación de compra').selectOption({ label: 'Bolsa x100 · 100 base' });
  await page.getByLabel('Cantidad comprada').fill(quantity);
  await page.getByLabel('Costo total de compra (S/)').fill(cost);
  await page.getByRole('button', { name: 'Confirmar ingreso' }).click();
  await expect(page.getByRole('alert')).toContainText('Mercadería ingresada');
}
async function createPromotion(page: Page, name: string) {
  await page.goto('/promotions');
  await page.getByLabel('Producto de promoción').selectOption({ label: '🍬 ' + name });
  await page.getByLabel('Presentación de promoción').selectOption({ label: 'Unidad' });
  await page.getByLabel('Cantidad del grupo').fill('3');
  await page.getByLabel('Precio del grupo (S/)').fill('0.50');
  await page.getByRole('button', { name: 'Guardar promoción' }).click();
  await expect(page.getByRole('alert')).toContainText('Promoción guardada');
}

test('HU-002: producto sin código, bolsas, 7 caramelos con promoción, merma y pack', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openCash(page);
  await page.goto('/products');
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre del producto').fill('Caramelo HU-002');
  await page.getByLabel('Precio de compra (S/)', { exact: true }).fill('0.12');
  await page.getByLabel('Precio de venta (S/)', { exact: true }).fill('0.20');
  await page.getByLabel('Stock inicial', { exact: true }).fill('0');
  await page.getByLabel('Unidad base', { exact: true }).fill('Unidad');
  await page.getByLabel('Icono', { exact: true }).selectOption('🍬');
  await page.getByLabel('Mostrar en venta rápida').check();
  await page.getByRole('button', { name: 'Añadir presentación' }).click();
  await page.getByLabel('Nombre de presentación 1', { exact: true }).fill('Bolsa x100');
  await page.getByLabel('Unidades base por presentación 1', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await receiveCandy(page, 'Caramelo HU-002', '3', '36');
  await page.goto('/inventory');
  await page.getByLabel('Buscar inventario').fill('Caramelo HU-002');
  await expect(page.locator('tbody').first()).toContainText('300 un.');
  await expect(page.locator('tbody').first()).toContainText('3 × Bolsa x100');
  await createPromotion(page, 'Caramelo HU-002');
  await page.goto('/pos');
  const quick = page.getByRole('button', { name: 'Venta rápida Caramelo HU-002', exact: true });
  await expect(quick).toContainText('3 por S/ 0.50');
  await quick.click();
  await expect(page.locator('.cart-summary .total-row')).toContainText('0.20');
  await quick.click();
  await quick.click();
  await expect(page.locator('.cart-summary .total-row')).toContainText('0.50');
  for (let i = 0; i < 4; i++) await quick.click();
  await expect(page.getByLabel('Cantidad de Caramelo HU-002', { exact: true })).toHaveValue('7');
  await expect(page.locator('.cart-summary')).toContainText('1.20');
  await expect(page.locator('.cart-summary')).toContainText('0.20');
  await page.screenshot({ path: 'test-results/hu2-desktop.png', animations: 'disabled' });
  await paySimulated(page);
  await expect(page.locator('.receipt')).toContainText('Ahorro promocional: S/ 0.20');
  await expect(page.locator('.receipt')).toContainText('1.20');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.goto('/inventory');
  await page.getByLabel('Buscar inventario').fill('Caramelo HU-002');
  await expect(page.locator('tbody').first()).toContainText('293 un.');
  await expect(page.locator('tbody').first()).toContainText('2 × Bolsa x100 + 93 Unidad');
  await page.getByRole('button', { name: 'Registrar merma', exact: true }).click();
  await page.getByLabel('Cantidad de merma (unidades base)').fill('3');
  await page.getByLabel('Motivo de merma').selectOption('Producto dañado');
  await page.getByRole('button', { name: 'Confirmar merma' }).click();
  await expect(page.locator('tbody').first()).toContainText('290 un.');
  await expect(page.locator('tbody').nth(1)).toContainText('Producto dañado');
  await page.goto('/promotions');
  const row = page.getByRole('row').filter({ hasText: 'Caramelo HU-002' });
  await row.getByRole('button', { name: 'Desactivar promoción' }).click();
  await expect(row).toContainText('Inactiva');
  await page.goto('/pos');
  await page.getByRole('button', { name: 'Venta rápida Caramelo HU-002', exact: true }).click();
  await expect(page.locator('.cart-summary .total-row')).toContainText('0.20');
  await page.getByRole('button', { name: 'Eliminar Caramelo HU-002', exact: true }).click();
  await page.getByLabel('Buscar productos').fill('DEMO-001');
  await page
    .getByLabel('Presentación para Gaseosa cola 500 ml')
    .selectOption({ label: 'Pack x6 · 6 base' });
  await page.getByRole('button', { name: 'Agregar Gaseosa cola 500 ml', exact: true }).click();
  await expect(page.locator('.cart-items')).toContainText('6 Botella');
  await expect(page.locator('.cart-summary .total-row')).toContainText('16.00');
  await paySimulated(page);
  await expect(page.locator('.receipt')).toContainText('Pack x6');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.goto('/inventory');
  await page.getByLabel('Buscar inventario').fill('DEMO-001');
  await expect(page.locator('tbody').first()).toContainText('34 un.');
  await page.reload();
  await expect(page.locator('tbody').first()).toContainText('34 un.');
});

test('HU-002: venta rápida táctil y cambio de presentación sin mezclar líneas', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCash(page);
  await page.goto('/pos');
  const quick = page.getByRole('button', { name: 'Venta rápida Toffee', exact: true });
  await quick.click();
  await quick.click();
  await expect(quick).toContainText('2 en carrito');
  await expect(page.getByRole('button', { name: 'Ver carrito de venta' })).toContainText('0.60');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await quick.boundingBox();
  expect(box!.height).toBeGreaterThan(44);
  await page.screenshot({ path: 'test-results/hu2-mobile.png', animations: 'disabled' });
  await page.getByLabel('Buscar productos').fill('DEMO-001');
  await page.getByRole('button', { name: 'Agregar Gaseosa cola 500 ml', exact: true }).click();
  await page
    .getByLabel('Presentación para Gaseosa cola 500 ml')
    .selectOption({ label: 'Pack x6 · 6 base' });
  await page.getByRole('button', { name: 'Agregar Gaseosa cola 500 ml', exact: true }).click();
  await page.getByRole('button', { name: 'Ver carrito de venta' }).click();
  await expect(page.locator('.cart-item')).toHaveCount(3);
  await page
    .getByLabel('Cambiar presentación de Gaseosa cola 500 ml Botella', { exact: true })
    .selectOption({ label: 'Pack x6' });
  await expect(page.locator('.cart-item')).toHaveCount(2);
  await expect(
    page.getByLabel('Cantidad de Gaseosa cola 500 ml · Pack x6', { exact: true }),
  ).toHaveValue('2');
  await expect(page.locator('.cart-summary .total-row')).toContainText('32.60');
});

test('HU-002: ingreso, promoción y venta rápida offline persisten al reabrir', async ({
  page,
  context,
}) => {
  await openCash(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await page.reload();
  await context.setOffline(true);
  await receiveCandy(page, 'Caramelo surtido', '3', '36');
  await createPromotion(page, 'Caramelo surtido');
  await page.goto('/pos');
  const quick = page.getByRole('button', { name: 'Venta rápida Caramelo surtido', exact: true });
  for (let i = 0; i < 7; i++) await quick.click();
  await expect(page.locator('.cart-summary .total-row')).toContainText('1.20');
  await paySimulated(page);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/inventory');
  await reopened.getByLabel('Buscar inventario').fill('Caramelo surtido');
  await expect(reopened.locator('tbody').first()).toContainText('293 un.');
  await reopened.goto('/sales');
  await reopened.getByRole('button', { name: 'Ver comprobante' }).click();
  await expect(reopened.locator('.receipt')).toContainText('1.20');
  await expect(reopened.locator('.receipt')).toContainText('3 por S/ 0.50');
});

import { test, expect, Page } from '@playwright/test';
async function openCash(page: Page) {
  await page.goto('/cash');
  await page.getByLabel('Monto inicial (S/)').fill('100');
  await page.getByRole('button', { name: 'Abrir caja →' }).click();
  await expect(page.getByRole('heading', { name: 'Tu caja está lista' })).toBeVisible();
}
async function scan(page: Page, code: string) {
  await page.getByLabel('Lector HID').fill(code);
  await page.getByLabel('Lector HID').press('Enter');
}
test('flujo comercial completo, comprobante, inventario, cierre y persistencia', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openCash(page);
  await page.goto('/pos');
  await page.getByRole('button', { name: 'Escanear', exact: true }).click();
  await scan(page, 'DEMO-001');
  await scan(page, 'DEMO-001');
  await scan(page, 'DEMO-007');
  await expect(page.getByLabel('Cantidad de Gaseosa cola 500 ml', { exact: true })).toHaveValue(
    '2',
  );
  await expect(page.locator('.cart-summary .total-row')).toContainText('11.50');
  await page.screenshot({ path: 'test-results/desktop-pos.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Cobrar venta' }).click();
  await page.getByLabel('Efectivo recibido (S/)').fill('50');
  await expect(page.locator('.change-box')).toContainText('38.50');
  await page.getByRole('button', { name: 'Confirmar venta en efectivo' }).click();
  await expect(page.getByRole('heading', { name: 'V-000001' })).toBeVisible();
  await expect(page.locator('.receipt')).toContainText('Sin validez tributaria');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.goto('/inventory');
  await page.getByLabel('Buscar inventario').fill('DEMO-001');
  await expect(page.locator('tbody').first().getByRole('row').first()).toContainText('38 un.');
  await expect(page.locator('tbody').nth(1)).toContainText('Venta V-000001');
  await page.goto('/sales');
  await expect(page.locator('tbody')).toContainText('V-000001');
  await page.goto('/dashboard');
  await expect(page.locator('.metric-card').first()).toContainText('11.50');
  await page.goto('/cash');
  await page.getByLabel('Efectivo contado (S/)').fill('111.50');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Cerrar caja', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Abre tu caja y empieza el día' })).toBeVisible();
  await page.reload();
  await expect(page.locator('tbody')).toContainText('111.50');
  await page.goto('/sales');
  await expect(page.locator('tbody')).toContainText('V-000001');
});
test('catálogo, ajuste, validación de lector y pagos simulados', async ({ page }) => {
  await openCash(page);
  await page.goto('/products');
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre del producto').fill('Producto E2E');
  await page.getByLabel('Código de barras (opcional)').fill('E2E-001');
  await page.getByLabel('Precio de compra (S/)').fill('1');
  await page.getByLabel('Precio de venta (S/)').fill('2.50');
  await page.getByLabel('Stock inicial').fill('3');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await page.getByLabel('Buscar en catálogo').fill('E2E-001');
  await expect(page.locator('tbody')).toContainText('Producto E2E');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Nombre del producto').fill('Producto E2E editado');
  await page.getByRole('button', { name: 'Guardar producto' }).click();
  await expect(page.locator('tbody')).toContainText('editado');
  await page.goto('/inventory');
  await page.getByLabel('Buscar inventario').fill('E2E-001');
  await page.getByRole('button', { name: 'Ajustar stock' }).click();
  await page.getByLabel('Nuevo stock total').fill('4');
  await page.getByLabel('Motivo del ajuste').fill('Reposición E2E');
  await page.getByRole('button', { name: 'Confirmar ajuste' }).click();
  await expect(page.locator('tbody').first()).toContainText('4 un.');
  await page.goto('/pos');
  await page.getByRole('button', { name: 'Escanear', exact: true }).click();
  await scan(page, 'NO-EXISTE');
  await expect(page.getByRole('alert')).toContainText('No se encontró');
  await scan(page, 'DEMO-006');
  await expect(page.getByRole('alert')).toContainText('stock suficiente');
  for (const method of ['Yape', 'Plin']) {
    await scan(page, 'E2E-001');
    await page.getByRole('button', { name: 'Cobrar venta' }).click();
    await page.getByRole('button', { name: method + ' · demo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Registrar venta simulada' })).toBeDisabled();
    await page.getByLabel('Confirmar manualmente el pago simulado').check();
    await page.getByRole('button', { name: 'Registrar venta simulada' }).click();
    await expect(page.locator('.receipt')).toContainText('Pago simulado');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  }
  await page.goto('/cash');
  await expect(page.locator('.metric-card').last()).toContainText('100.00');
});
test('PWA abre en frío y vende offline con persistencia y rutas lazy', async ({
  page,
  context,
}) => {
  await openCash(page);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    await registration.update();
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto('/pos');
  await expect(page.getByRole('heading', { name: 'Punto de venta.' })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar Gaseosa cola 500 ml', exact: true }).click();
  await page.getByRole('button', { name: 'Cobrar venta' }).click();
  await page.getByLabel('Efectivo recibido (S/)').fill('10');
  await page.getByRole('button', { name: 'Confirmar venta en efectivo' }).click();
  await expect(page.getByRole('heading', { name: 'V-000001' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/sales');
  await expect(reopened.locator('tbody')).toContainText('V-000001');
  await reopened.goto('/products');
  await expect(reopened.locator('tbody')).toContainText('Gaseosa cola');
  await reopened.goto('/inventory');
  await expect(reopened.getByRole('heading', { name: 'Inventario.' })).toBeVisible();
  await reopened.goto('/dashboard');
  await expect(reopened.locator('.metric-card').first()).toContainText('3.50');
  await reopened.goto('/settings');
  await expect(reopened.getByRole('heading', { name: 'Configuración.' })).toBeVisible();
});
test('interfaz móvil sin desbordamiento y navegación accesible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pos');
  await expect(page.getByRole('heading', { name: 'Punto de venta.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: 'test-results/mobile-pos.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Agregar Gaseosa cola 500 ml', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ver carrito de venta' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver carrito de venta' }).click();
  await expect(page.getByRole('heading', { name: 'Tu carrito 1' })).toBeInViewport();
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('link', { name: 'Mi caja', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'Mi caja.' })).toBeVisible();
  await page.screenshot({
    path: 'test-results/mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('lector sin Enter y navegación por teclado en el diálogo de pago', async ({ page }) => {
  await openCash(page);
  await page.goto('/settings');
  await page.getByLabel('El lector finaliza el escaneo con Enter').uncheck();
  await expect(page.getByRole('alert')).toContainText('Preferencia guardada');
  await page.goto('/pos');
  await page.getByRole('button', { name: 'Escanear', exact: true }).click();
  await page.getByLabel('Lector HID').fill('DEMO-001');
  await expect(page.getByLabel('Cantidad de Gaseosa cola 500 ml', { exact: true })).toHaveValue(
    '1',
  );
  await page.getByRole('button', { name: 'Cobrar venta' }).click();
  await expect(page.getByLabel('Efectivo recibido (S/)')).toBeFocused();
  await page.getByLabel('Efectivo recibido (S/)').fill('10');
  await page.getByRole('button', { name: 'Confirmar venta en efectivo' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Cerrar pago', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cobrar venta' })).toBeFocused();
});

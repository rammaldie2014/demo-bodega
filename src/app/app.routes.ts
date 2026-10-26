import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: 'stock-receipts',
    loadComponent: () =>
      import('./features/stock-receipts/stock-receipts').then((m) => m.StockReceiptsComponent),
    title: 'Ingreso de mercadería · Mi Bodega',
  },
  {
    path: 'promotions',
    loadComponent: () =>
      import('./features/promotions/promotions').then((m) => m.PromotionsComponent),
    title: 'Promociones · Mi Bodega',
  },
  {
    path: 'pos',
    loadComponent: () => import('./features/pos/pos').then((m) => m.PosComponent),
    title: 'Punto de venta · Mi Bodega',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
    title: 'Resumen · Mi Bodega',
  },
  {
    path: 'products',
    loadComponent: () => import('./features/products/products').then((m) => m.ProductsComponent),
    title: 'Productos · Mi Bodega',
  },
  {
    path: 'inventory',
    loadComponent: () => import('./features/inventory/inventory').then((m) => m.InventoryComponent),
    title: 'Inventario · Mi Bodega',
  },
  {
    path: 'sales',
    loadComponent: () => import('./features/sales/sales').then((m) => m.SalesComponent),
    title: 'Ventas · Mi Bodega',
  },
  {
    path: 'cash',
    loadComponent: () => import('./features/cash/cash').then((m) => m.CashComponent),
    title: 'Caja · Mi Bodega',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsComponent),
    title: 'Configuración · Mi Bodega',
  },
  { path: '', redirectTo: 'pos', pathMatch: 'full' },
  { path: '**', redirectTo: 'pos' },
];

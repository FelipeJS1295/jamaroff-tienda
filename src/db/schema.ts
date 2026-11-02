import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb, pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Enums ──────────────────────────────────────────────────────────
export const productModeEnum = pgEnum('product_mode', ['stock', 'pedido', 'ambos']);
export const roleEnum = pgEnum('user_role', ['customer', 'admin']);
export const wholesaleStatusEnum = pgEnum('wholesale_status', ['none', 'pending', 'approved', 'rejected']);
export const orderStatusEnum = pgEnum('order_status', [
  'pendiente_pago', 'pagado', 'en_fabricacion', 'listo_despacho', 'despachado', 'entregado', 'cancelado',
]);
export const paymentStatusEnum = pgEnum('payment_status', ['pendiente', 'pagado', 'fallido', 'reembolsado']);
export const paymentMethodEnum = pgEnum('payment_method', ['webpay', 'transferencia']);
export const deliveryMethodEnum = pgEnum('delivery_method', ['despacho', 'retiro']);
export const couponTypeEnum = pgEnum('coupon_type', ['percent', 'amount']);
export const quoteKindEnum = pgEnum('quote_kind', ['medida', 'mayorista', 'contacto']);
export const quoteStatusEnum = pgEnum('quote_status', ['nueva', 'respondida', 'cerrada']);

// Un bulto embalado: medidas en cm y peso en kg
export type PackageSpec = { largo: number; ancho: number; alto: number; peso: number };

// ─── Catálogo ───────────────────────────────────────────────────────
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  imageUrl: text('image_url'),
  position: integer('position').notNull().default(0),
  showInMenu: boolean('show_in_menu').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  sku: text('sku'),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  price: integer('price').notNull(), // CLP, IVA incluido
  compareAtPrice: integer('compare_at_price'), // precio "antes" para ofertas
  wholesalePrice: integer('wholesale_price'), // precio mayorista (neto o con IVA, según tu política)
  wholesaleMinQty: integer('wholesale_min_qty').notNull().default(1),
  mode: productModeEnum('mode').notNull().default('stock'),
  stock: integer('stock').notNull().default(0),
  leadTimeDays: integer('lead_time_days'), // días de fabricación a pedido
  material: text('material'),
  color: text('color'),
  dimensions: text('dimensions'), // "240 × 160 × 85 cm"
  specs: jsonb('specs').$type<{ label: string; value: string }[]>().notNull().default([]),
  packages: jsonb('packages').$type<PackageSpec[]>().notNull().default([]),
  featured: boolean('featured').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('products_category_idx').on(t.categoryId),
  index('products_active_idx').on(t.active),
]);

export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  thumbUrl: text('thumb_url'),
  alt: text('alt'),
  position: integer('position').notNull().default(0),
  // Dirección original de la foto cuando la publicó Cuadra (para no volver a descargarla)
  sourceUrl: text('source_url'),
}, (t) => [index('product_images_product_idx').on(t.productId)]);

// La misma escena del producto fotografiada a distintas horas (8, 10, 12, 15, 18, 21 y 0 h).
// En la ficha, el cliente desliza un sol para ver cómo cambia la luz sobre el sofá.
export const productLightImages = pgTable('product_light_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  hour: integer('hour').notNull(),
  url: text('url').notNull(),
  thumbUrl: text('thumb_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('product_light_images_product_hour_idx').on(t.productId, t.hour)]);

// Telas / colores disponibles para un producto
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  hex: text('hex').notNull().default('#cccccc'),
  priceDelta: integer('price_delta').notNull().default(0),
  madeToOrderOnly: boolean('made_to_order_only').notNull().default(false),
  position: integer('position').notNull().default(0),
}, (t) => [index('product_variants_product_idx').on(t.productId)]);

// ─── Usuarios ───────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: roleEnum('role').notNull().default('customer'),
  wholesaleStatus: wholesaleStatusEnum('wholesale_status').notNull().default('none'),
  companyName: text('company_name'),
  companyRut: text('company_rut'),
  companyGiro: text('company_giro'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Pedidos ────────────────────────────────────────────────────────
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  number: text('number').notNull().unique(),
  accessToken: text('access_token').notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  isWholesale: boolean('is_wholesale').notNull().default(false),
  email: text('email').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  rut: text('rut'),
  deliveryMethod: deliveryMethodEnum('delivery_method').notNull().default('despacho'),
  region: text('region'),
  comuna: text('comuna'),
  address: text('address'),
  addressExtra: text('address_extra'),
  customerNotes: text('customer_notes'),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  shippingCost: integer('shipping_cost').notNull().default(0),
  shippingToQuote: boolean('shipping_to_quote').notNull().default(false),
  shippingZone: text('shipping_zone'),
  total: integer('total').notNull(),
  couponCode: text('coupon_code'),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').notNull().default('pendiente'),
  status: orderStatusEnum('status').notNull().default('pendiente_pago'),
  invoice: jsonb('invoice').$type<{ razonSocial: string; rut: string; giro: string } | null>(),
  carrier: text('carrier'),
  trackingCode: text('tracking_code'),
  adminNotes: text('admin_notes'),
  stockApplied: boolean('stock_applied').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
}, (t) => [
  index('orders_status_idx').on(t.status),
  index('orders_user_idx').on(t.userId),
  index('orders_created_idx').on(t.createdAt),
]);

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  variantName: text('variant_name'),
  mode: text('mode').notNull(), // 'stock' | 'pedido'
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  leadTimeDays: integer('lead_time_days'),
  imageUrl: text('image_url'),
}, (t) => [index('order_items_order_idx').on(t.orderId)]);

export const orderEvents = pgTable('order_events', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: orderStatusEnum('status'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  token: text('token'),
  amount: integer('amount').notNull(),
  status: paymentStatusEnum('status').notNull().default('pendiente'),
  raw: jsonb('raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('payments_token_idx').on(t.token)]);

// ─── Despachos ──────────────────────────────────────────────────────
// Costo = tarifa base + tarifa por m³ × volumen embalado del pedido (mínimo `minRate`).
// Una zona aplica a comunas específicas (prioridad) o a regiones completas.
export const shippingZones = pgTable('shipping_zones', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  regions: text('regions').array().notNull().default([]),
  comunas: text('comunas').array().notNull().default([]),
  baseRate: integer('base_rate').notNull().default(0),
  ratePerM3: integer('rate_per_m3').notNull().default(0),
  minRate: integer('min_rate').notNull().default(0),
  freeOver: integer('free_over'), // despacho gratis sobre este subtotal
  etaText: text('eta_text').notNull().default(''),
  carrier: text('carrier'),
  quoteOnly: boolean('quote_only').notNull().default(false), // "a cotizar"
  active: boolean('active').notNull().default(true),
  position: integer('position').notNull().default(0),
});

// ─── Ventas ─────────────────────────────────────────────────────────
export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  type: couponTypeEnum('type').notNull().default('percent'),
  value: integer('value').notNull(),
  minSubtotal: integer('min_subtotal').notNull().default(0),
  usageLimit: integer('usage_limit'),
  used: integer('used').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quoteRequests = pgTable('quote_requests', {
  id: serial('id').primaryKey(),
  kind: quoteKindEnum('kind').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  company: text('company'),
  region: text('region'),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  message: text('message').notNull(),
  status: quoteStatusEnum('status').notNull().default('nueva'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Ajustes editables desde el admin (WhatsApp, datos de transferencia, etc.)
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
});

// Intentos de login para frenar fuerza bruta
export const loginAttempts = pgTable('login_attempts', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  ip: text('ip'),
  success: boolean('success').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('login_attempts_email_idx').on(t.email, t.createdAt)]);

export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type ShippingZone = typeof shippingZones.$inferSelect;
export type User = typeof users.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;

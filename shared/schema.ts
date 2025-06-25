import { pgTable, text, serial, integer, boolean, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const retailers = pgTable("retailers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  website: text("website"),
  isActive: boolean("is_active").default(true),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  image: text("image"),
  brand: text("brand"),
  model: text("model"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productOffers = pgTable("product_offers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  retailerId: integer("retailer_id").references(() => retailers.id).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  availability: text("availability").default("in_stock"), // in_stock, out_of_stock, limited_stock
  rating: decimal("rating", { precision: 2, scale: 1 }),
  reviewCount: integer("review_count").default(0),
  shippingInfo: text("shipping_info"),
  dealType: text("deal_type"), // best_price, bundle_deal, limited_time, etc.
  productUrl: text("product_url"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertRetailerSchema = createInsertSchema(retailers).omit({
  id: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertProductOfferSchema = createInsertSchema(productOffers).omit({
  id: true,
  lastUpdated: true,
});

export type Retailer = typeof retailers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductOffer = typeof productOffers.$inferSelect;

export type InsertRetailer = z.infer<typeof insertRetailerSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProductOffer = z.infer<typeof insertProductOfferSchema>;

// Combined types for API responses
export type ProductWithOffers = Product & {
  offers: (ProductOffer & { retailer: Retailer })[];
  bestPrice?: number;
  savings?: number;
  savingsPercentage?: number;
};

export type SearchFilters = {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  retailers?: number[];
  minRating?: number;
  availability?: string[];
  sortBy?: "price_low" | "price_high" | "rating" | "popularity";
};

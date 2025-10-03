import express from "express";
import { errorHandler } from "../handlers/error.handler.js";
import vendorController from "../controller/vendor.controller.js";
import productController from "../controller/product.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import adminController from "../controller/admin.controllers.js";

const vendorRouter = express.Router();

vendorRouter.post("/register", errorHandler(vendorController.vendorRegister));
vendorRouter.post("/login", errorHandler(vendorController.vendorLogin));
vendorRouter.post("/send-otp", errorHandler(vendorController.vendorSendOtpController));
vendorRouter.post("/verify-otp", errorHandler(vendorController.vendorVerifyOtpController));

vendorRouter.post("/forgot-password/request", errorHandler(vendorController.vendorForgotPasswordRequest));
vendorRouter.post("/forgot-password/verify", errorHandler(vendorController.vendorForgotPasswordVerifyOTP));
vendorRouter.post("/forgot-password/reset", errorHandler(vendorController.vendorForgotPasswordReset));
vendorRouter.post("/forgot-password/resend", errorHandler(vendorController.vendorResendForgotPasswordOTP));

vendorRouter.post("/variations", authGuard("VENDOR"), errorHandler(vendorController.createVariation));
vendorRouter.get("/variations", authGuard("VENDOR"), errorHandler(vendorController.getAllVariations));
vendorRouter.get("/variations/:id", errorHandler(vendorController.getVariation));
vendorRouter.put("/variations/:id", errorHandler(vendorController.updateVariation));
vendorRouter.patch("/variations/:id/categories", authGuard("VENDOR"), errorHandler(vendorController.updateVariationCategories));
vendorRouter.delete("/variations/:id", errorHandler(vendorController.deleteVariation));

vendorRouter.post("/products", authGuard("VENDOR"), errorHandler(productController.createProduct));
vendorRouter.get("/products", authGuard("VENDOR"), errorHandler(productController.getVendorProducts));

// Bulk operations (must be BEFORE any /products/:id routes)
vendorRouter.patch("/products/bulk/status", authGuard("VENDOR"), errorHandler(productController.bulkUpdateProductStatus));
vendorRouter.patch("/products/bulk/visibility", authGuard("VENDOR"), errorHandler(productController.bulkToggleProductVisibility));
vendorRouter.delete("/products/bulk", authGuard("VENDOR"), errorHandler(productController.bulkDeleteProducts));

vendorRouter.get("/reviews", authGuard("VENDOR"), errorHandler(productController.getVendorReviews));

// Single product operations
vendorRouter.get("/products/low-stock", authGuard("VENDOR"), errorHandler(productController.getLowStockProducts));
vendorRouter.get("/products/:id", errorHandler(productController.getProduct));
vendorRouter.put("/products/:id", authGuard("VENDOR"), errorHandler(productController.updateProduct));
vendorRouter.delete("/products/:id", authGuard("VENDOR"), errorHandler(productController.deleteProduct));
vendorRouter.patch("/products/:id/status", authGuard("VENDOR"), errorHandler(productController.updateProductStatus));
vendorRouter.put("/products/:id/specifications", authGuard("VENDOR"), errorHandler(productController.updateProductSpecifications));
vendorRouter.patch("/products/:id/visibility", authGuard("VENDOR"), errorHandler(productController.toggleProductVisibility));

// Variations
vendorRouter.post("/products/:id/variations", authGuard("VENDOR"), errorHandler(productController.addProductVariations));
vendorRouter.put("/products/:id/variations/:variationId", authGuard("VENDOR"), errorHandler(productController.updateProductVariation));
vendorRouter.delete("/products/:id/variations/:variationId", authGuard("VENDOR"), errorHandler(productController.deleteProductVariation));

vendorRouter.get("/categories/:categoryId/variations", authGuard("VENDOR"), errorHandler(productController.getAvailableVariationsForCategory));

// Store Management Routes
vendorRouter.post("/store", authGuard("VENDOR"), errorHandler(vendorController.createStore));
vendorRouter.get("/store", authGuard("VENDOR"), errorHandler(vendorController.getMyStore));
vendorRouter.put("/store/:storeId", authGuard("VENDOR"), errorHandler(vendorController.updateStore));
vendorRouter.delete("/store/:storeId", authGuard("VENDOR"), errorHandler(vendorController.deleteStore));
vendorRouter.get("/store/username/availability", authGuard("VENDOR"), errorHandler(vendorController.checkStoreUserNameAvailability));

// Bank Details Management Routes
vendorRouter.post("/bank-details", authGuard("VENDOR"), errorHandler(vendorController.createBankDetails));
vendorRouter.get("/bank-details", authGuard("VENDOR"), errorHandler(vendorController.getMyBankDetails));
vendorRouter.get("/bank-details/:bankId", authGuard("VENDOR"), errorHandler(vendorController.getBankDetails));
vendorRouter.put("/bank-details/:bankId", authGuard("VENDOR"), errorHandler(vendorController.updateBankDetails));
vendorRouter.delete("/bank-details/:bankId", authGuard("VENDOR"), errorHandler(vendorController.deleteBankDetails));

// Shipping Policies Management Routes
vendorRouter.post("/shipping-policies", authGuard("VENDOR"), errorHandler(vendorController.createShippingPolicy));
vendorRouter.get("/shipping-policies", authGuard("VENDOR"), errorHandler(vendorController.getMyShippingPolicies));
vendorRouter.get("/shipping-policies/:policyId", authGuard("VENDOR"), errorHandler(vendorController.getShippingPolicy));
vendorRouter.put("/shipping-policies/:policyId", authGuard("VENDOR"), errorHandler(vendorController.updateShippingPolicy));
vendorRouter.delete("/shipping-policies/:policyId", authGuard("VENDOR"), errorHandler(vendorController.deleteShippingPolicy));

// Zones Management Routes
vendorRouter.post("/zones", authGuard("VENDOR"), errorHandler(vendorController.createZone));
vendorRouter.get("/zones", authGuard("VENDOR"), errorHandler(vendorController.getMyZones));
vendorRouter.get("/zones/:zoneId", authGuard("VENDOR"), errorHandler(vendorController.getZone));
vendorRouter.put("/zones/:zoneId", authGuard("VENDOR"), errorHandler(vendorController.updateZone));
vendorRouter.delete("/zones/:zoneId", authGuard("VENDOR"), errorHandler(vendorController.deleteZone));

// Shipping Methods Management Routes
vendorRouter.post("/shipping-methods", authGuard("VENDOR"), errorHandler(vendorController.createShippingMethod));
vendorRouter.get("/shipping-methods/:methodId", authGuard("VENDOR"), errorHandler(vendorController.getShippingMethod));
vendorRouter.get("/zones/:zoneId/shipping-methods", authGuard("VENDOR"), errorHandler(vendorController.getZoneShippingMethods));
vendorRouter.put("/shipping-methods/:methodId", authGuard("VENDOR"), errorHandler(vendorController.updateShippingMethod));
vendorRouter.delete("/shipping-methods/:methodId", authGuard("VENDOR"), errorHandler(vendorController.deleteShippingMethod));

// Store Documents Management Routes
vendorRouter.post("/store-documents", authGuard("VENDOR"), errorHandler(vendorController.createStoreDocument));
vendorRouter.get("/store-documents", authGuard("VENDOR"), errorHandler(vendorController.getMyStoreDocuments));
vendorRouter.get("/store-documents/:documentId", authGuard("VENDOR"), errorHandler(vendorController.getStoreDocument));
vendorRouter.put("/store-documents/:documentId", authGuard("VENDOR"), errorHandler(vendorController.updateStoreDocument));
vendorRouter.delete("/store-documents/:documentId", authGuard("VENDOR"), errorHandler(vendorController.deleteStoreDocument));

vendorRouter.get("/categories/active", authGuard("VENDOR"), errorHandler(adminController.getActiveCategories));
vendorRouter.get("/categories/all", authGuard("VENDOR"), errorHandler(adminController.getAllCategoriesWithoutPagination));
vendorRouter.get("/categories/:id", errorHandler(adminController.getCategory));

// Warehouse Management Routes
vendorRouter.post("/warehouses", authGuard("VENDOR"), errorHandler(vendorController.createWarehouse));
vendorRouter.get("/warehouses", authGuard("VENDOR"), errorHandler(vendorController.getMyWarehouses));
vendorRouter.get("/warehouses/:warehouseId", authGuard("VENDOR"), errorHandler(vendorController.getWarehouse));
vendorRouter.put("/warehouses/:warehouseId", authGuard("VENDOR"), errorHandler(vendorController.updateWarehouse));
vendorRouter.delete("/warehouses/:warehouseId", authGuard("VENDOR"), errorHandler(vendorController.deleteWarehouse));

// Shipping Providers Management Routes
vendorRouter.post("/shipping-providers", authGuard("VENDOR"), errorHandler(vendorController.createShippingProvider));
vendorRouter.get("/shipping-providers", authGuard("VENDOR"), errorHandler(vendorController.getAllShippingProviders));
vendorRouter.get("/shipping-providers/all", authGuard("VENDOR"), errorHandler(vendorController.getAllShippingProvidersWithoutPagination));
vendorRouter.get("/shipping-providers/:providerId", authGuard("VENDOR"), errorHandler(vendorController.getShippingProvider));
vendorRouter.put("/shipping-providers/:providerId", authGuard("VENDOR"), errorHandler(vendorController.updateShippingProvider));
vendorRouter.patch("/shipping-providers/:providerId/toggle-status", authGuard("VENDOR"), errorHandler(vendorController.toggleShippingProviderStatus));
vendorRouter.delete("/shipping-providers/:providerId", authGuard("VENDOR"), errorHandler(vendorController.deleteShippingProvider));

// Order Management Routes
vendorRouter.post("/orders", authGuard("VENDOR"), errorHandler(vendorController.createOrder));
vendorRouter.get("/orders", authGuard("VENDOR"), errorHandler(vendorController.getVendorOrders));
vendorRouter.get("/orders/stats", authGuard("VENDOR"), errorHandler(vendorController.getVendorOrderStats));
vendorRouter.get("/orders/:orderId", authGuard("VENDOR"), errorHandler(vendorController.getVendorOrder));
vendorRouter.patch("/orders/:orderId/status", authGuard("VENDOR"), errorHandler(vendorController.updateOrderStatus));

// User Management Routes for Vendors
vendorRouter.get("/users/:userId/cart", authGuard("VENDOR"), errorHandler(vendorController.getUserCart));
vendorRouter.get("/users/phone-suggestions", authGuard("VENDOR"), errorHandler(vendorController.getPhoneSuggestions));
vendorRouter.get("/users/:userId/complete-info", authGuard("VENDOR"), errorHandler(vendorController.getUserCompleteInfo));

// Shipping Type Management Routes
vendorRouter.get("/shipping-type", authGuard("VENDOR"), errorHandler(vendorController.getMyShippingType));
vendorRouter.put("/shipping-type", authGuard("VENDOR"), errorHandler(vendorController.updateMyShippingType));

export default vendorRouter;
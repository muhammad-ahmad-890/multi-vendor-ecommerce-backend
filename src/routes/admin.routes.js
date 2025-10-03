
import express from "express";
import adminController from "../controller/admin.controllers.js";
import { errorHandler } from "../handlers/error.handler.js";
import { authGuard } from "../middleware/auth.middleware.js";
import productController from "../controller/product.controller.js";

const adminRouter = express.Router()

adminRouter.post("/register", errorHandler(adminController.adminRegister));
adminRouter.post("/login", errorHandler(adminController.adminLogin));


adminRouter.post("/categories",authGuard("ADMIN"), errorHandler(adminController.createCategory));
adminRouter.get("/categories",authGuard("ADMIN"),  errorHandler(adminController.getAllCategories));
adminRouter.get("/categories/:id",authGuard("ADMIN"),  errorHandler(adminController.getCategory));
adminRouter.put("/categories/:id", authGuard("ADMIN"), errorHandler(adminController.updateCategory));
adminRouter.patch("/categories/:id/toggle-status",authGuard("ADMIN"),  errorHandler(adminController.toggleCategoryStatus));
adminRouter.delete("/categories/:id",authGuard("ADMIN"),  errorHandler(adminController.deleteCategory));

adminRouter.get("/products", authGuard("ADMIN"), errorHandler(productController.getAllProducts));
adminRouter.patch("/products/:id/moderate", authGuard("ADMIN"), errorHandler(productController.moderateProduct));

adminRouter.get("/stores", authGuard("ADMIN"), errorHandler(adminController.getAllStores));
adminRouter.patch("/stores/:storeId/verify", authGuard("ADMIN"), errorHandler(adminController.toggleStoreVerification));

adminRouter.get("/bank-details", authGuard("ADMIN"), errorHandler(adminController.getAllBankDetails));

adminRouter.get("/shipping-policies", authGuard("ADMIN"), errorHandler(adminController.getAllShippingPolicies));

adminRouter.get("/zones", authGuard("ADMIN"), errorHandler(adminController.getAllZones));

adminRouter.get("/store-documents", authGuard("ADMIN"), errorHandler(adminController.getAllStoreDocuments));
adminRouter.get("/users/:userId/documents", authGuard("ADMIN"), errorHandler(adminController.getUserDocuments));
adminRouter.patch("/users/:userId/documents/status", authGuard("ADMIN"), errorHandler(adminController.updateUserDocumentsStatus));
adminRouter.patch("/users/:userId/documents/:documentId/status", authGuard("ADMIN"), errorHandler(adminController.updateUserDocumentStatus));
adminRouter.get("/users/:userId/detail", authGuard("ADMIN"), errorHandler(adminController.getUserDetail));

// Admin: user management
adminRouter.get("/users/customers", authGuard("ADMIN"), errorHandler(adminController.listCustomers));
adminRouter.get("/users/vendors", authGuard("ADMIN"), errorHandler(adminController.listVendors));
adminRouter.get("/users/vendor-staff", authGuard("ADMIN"), errorHandler(adminController.listVendorStaff));
adminRouter.get("/users/admins", authGuard("ADMIN"), errorHandler(adminController.listAdmins));
adminRouter.get("/users/admin-staff", authGuard("ADMIN"), errorHandler(adminController.listAdminStaff));
adminRouter.post("/users", authGuard("ADMIN"), errorHandler(adminController.createUser));
adminRouter.get("/users/:id", authGuard("ADMIN"), errorHandler(adminController.getUser));
adminRouter.put("/users/:id", authGuard("ADMIN"), errorHandler(adminController.updateUser));
adminRouter.delete("/users/:id", authGuard("ADMIN"), errorHandler(adminController.deleteUser));
adminRouter.patch("/users/:id/set-password", authGuard("ADMIN"), errorHandler(adminController.setUserPassword));
adminRouter.patch("/users/:id/demote-vendor", authGuard("ADMIN"), errorHandler(adminController.demoteVendor));

adminRouter.get("/vendors", authGuard("ADMIN"), errorHandler(adminController.getAllVendors));
adminRouter.get("/vendors/:id", authGuard("ADMIN"), errorHandler(adminController.getVendor));
adminRouter.patch("/vendors/:id/status", authGuard("ADMIN"), errorHandler(adminController.updateVendorStatus));
adminRouter.patch("/vendors/:id/toggle-active", authGuard("ADMIN"), errorHandler(adminController.toggleVendorActiveStatus));
adminRouter.get("/vendors-management", authGuard("ADMIN"), errorHandler(adminController.getVendorsManagement));
adminRouter.patch("/vendors-management/:id/toggle-active", authGuard("ADMIN"), errorHandler(adminController.toggleVendorActiveStatusManagement));
adminRouter.get("/verification/unverified-vendors", authGuard("ADMIN"), errorHandler(adminController.getUnverifiedVendors));
adminRouter.post("/verification/:userId/reject", authGuard("ADMIN"), errorHandler(adminController.rejectVendorRequest));
adminRouter.post("/verification/:userId/approve-form", authGuard("ADMIN"), errorHandler(adminController.approveVendorForm));
adminRouter.post("/verification/:userId/approve-final", authGuard("ADMIN"), errorHandler(adminController.approveVendorFinal));

// DocumentType (Admin)
adminRouter.post("/document-types", authGuard("ADMIN"), errorHandler(adminController.createDocumentType));
adminRouter.get("/document-types", authGuard("ADMIN"), errorHandler(adminController.listDocumentTypes));
adminRouter.put("/document-types/:id", authGuard("ADMIN"), errorHandler(adminController.updateDocumentType));
adminRouter.delete("/document-types/:id", authGuard("ADMIN"), errorHandler(adminController.deleteDocumentType));

// Business Types (Admin)
adminRouter.post("/business-types", authGuard("ADMIN"), errorHandler(adminController.createBusinessType));
adminRouter.get("/business-types", errorHandler(adminController.listBusinessTypes));
adminRouter.get("/business-types/:id", authGuard("ADMIN"), errorHandler(adminController.getBusinessType));
adminRouter.put("/business-types/:id", authGuard("ADMIN"), errorHandler(adminController.updateBusinessType));
adminRouter.delete("/business-types/:id", authGuard("ADMIN"), errorHandler(adminController.deleteBusinessType));

export default adminRouter;
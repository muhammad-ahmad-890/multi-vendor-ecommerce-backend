import authServices from "../services/auth.services.js";
import categoriesServices from "../services/categories.services.js";
import { dataResponse } from "../utils/response.js";
import storeServices from "../services/store.services.js";
import bankDetailsServices from "../services/bankDetails.services.js";
import shippingPoliciesServices from "../services/shippingPolicies.services.js";
import zonesServices from "../services/zones.services.js";
import storeDocumentServices from "../services/storeDocument.services.js";
import { getUnverifiedVendorsWithStore } from "../services/verification.services.js";
import { getUserDocuments, updateUserDocumentsStatus } from "../services/verification.services.js";
import { updateUserDocumentStatus } from "../services/verification.services.js";
import { rejectVendorRequest, approveVendorForm, approveVendorFinal } from "../services/verification.services.js";
import { getUserDetailWithStoreAndDocuments } from "../services/verification.services.js";
import { createDocumentType, getAllDocumentTypes, updateDocumentType, deleteDocumentType } from "../services/documentType.services.js";
import businessTypeServices from "../services/businessType.services.js";

const adminController = {
	async adminRegister(req, res, next) {
		const { email,
			firstName,
			lastName,
			phone, password } = req.body;
		const user = await authServices.adminRegister(email,
			firstName,
			lastName,
			phone,
			password);
		return res.status(200).send(dataResponse("Admin register successfully", user));
	},
	async adminLogin(req, res, next) {
		const { email,
			password,
		} = req.body;
		console.log("🚀 ~ adminLogin ~ password:", password)
		console.log("🚀 ~ adminLogin ~ email:", email)
		const user = await authServices.adminLogin(email, password);
		return res.status(200).send(dataResponse("Admin LoggedIn successfully", user));
	},
	async createCategory(req, res, next) {
		try {
			const category = await categoriesServices.createCategory(req.body);
			return res.status(201).send(dataResponse("Category created successfully", category));
		} catch (err) {
			next(err);
		}
	},

	async getAllCategories(req, res, next) {
		try {
			const categories = await categoriesServices.getAllCategories(req.query);
			return res.status(200).send(dataResponse("Categories retrieved successfully", categories));
		} catch (err) {
			next(err);
		}
	},

	async getAllCategoriesWithoutPagination(req, res, next) {
		try {
			const categories = await categoriesServices.getAllCategoriesWithoutPagination(req.query);
			return res.status(200).send(dataResponse("All categories retrieved successfully", categories));
		} catch (err) {
			next(err);
		}
	},

	async getActiveCategories(req, res, next) {
		try {
			const categories = await categoriesServices.getAllCategories({ ...req.query, isActive: true });
			return res.status(200).send(dataResponse("Active categories retrieved successfully", categories));
		} catch (err) {
			next(err);
		}
	},

	async getCategory(req, res, next) {
		try {
			const { id } = req.params;
			const category = await categoriesServices.getCategory({ id, ...req.query });
			return res.status(200).send(dataResponse("Category retrieved successfully", category));
		} catch (err) {
			next(err);
		}
	},

	async updateCategory(req, res, next) {
		try {
			const { id } = req.params;
			const category = await categoriesServices.updateCategory({ id, ...req.body });
			return res.status(200).send(dataResponse("Category updated successfully", category));
		} catch (err) {
			next(err);
		}
	},

	async toggleCategoryStatus(req, res, next) {
		try {
			const { id } = req.params;
			const category = await categoriesServices.toggleCategoryStatus({ id });
			return res.status(200).send(dataResponse("Category status updated successfully", category));
		} catch (err) {
			next(err);
		}
	},

	async deleteCategory(req, res, next) {
		try {
			const { id } = req.params;
			await categoriesServices.deleteCategory({ id });
			return res.status(200).send(dataResponse("Category deleted successfully"));
		} catch (err) {
			next(err);
		}
	},

	// Stores - Admin
	async getAllStores(req, res, next) {
		try {
			const stores = await storeServices.getAllStores(req.query);
			return res.status(200).send(dataResponse("Stores retrieved successfully", stores));
		} catch (err) {
			next(err);
		}
	},

	async toggleStoreVerification(req, res, next) {
		try {
			const { storeId } = req.params;
			const store = await storeServices.toggleStoreVerification(storeId);
			return res.status(200).send(dataResponse("Store verification status updated successfully", store));
		} catch (err) {
			next(err);
		}
	},

	// Bank Details Management (Admin)
	async getAllBankDetails(req, res, next) {
		try {
			const { page, limit, search, sortBy, sortOrder } = req.query;
			const bankDetails = await bankDetailsServices.getAllBankDetails({ page, limit, search, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Bank details retrieved successfully", bankDetails));
		} catch (err) {
			next(err);
		}
	},

	// Shipping Policies Management (Admin)
	async getAllShippingPolicies(req, res, next) {
		try {
			const { page, limit, search, sortBy, sortOrder } = req.query;
			const shippingPolicies = await shippingPoliciesServices.getAllShippingPolicies({ page, limit, search, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Shipping policies retrieved successfully", shippingPolicies));
		} catch (err) {
			next(err);
		}
	},

	// Zones Management (Admin)
	async getAllZones(req, res, next) {
		try {
			const { page, limit, search, country, sortBy, sortOrder } = req.query;
			const zones = await zonesServices.getAllZones({ page, limit, search, country, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Zones retrieved successfully", zones));
		} catch (err) {
			next(err);
		}
	},

	// Store Documents Management (Admin)
	async getAllStoreDocuments(req, res, next) {
		try {
			const { page, limit, search, documentType, sortBy, sortOrder } = req.query;
			const storeDocuments = await storeDocumentServices.getAllStoreDocuments({ page, limit, search, documentType, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Store documents retrieved successfully", storeDocuments));
		} catch (err) {
			next(err);
		}
	},

	async getUserDocuments(req, res, next) {
		try {
			const { userId } = req.params;
			const docs = await getUserDocuments(userId);
			return res.status(200).send(dataResponse("User documents retrieved successfully", docs));
		} catch (err) {
			next(err);
		}
	},

	async updateUserDocumentsStatus(req, res, next) {
		try {
			const { userId } = req.params;
			const { updates } = req.body; // [{ id, status }]
			const docs = await updateUserDocumentsStatus(userId, updates);
			return res.status(200).send(dataResponse("User documents status updated successfully", docs));
		} catch (err) {
			next(err);
		}
	},

	async updateUserDocumentStatus(req, res, next) {
		try {
			const { userId, documentId } = req.params;
			const { status, reason } = req.body;
			console.log("🚀 ~ updateUserDocumentStatus ~ reason:", reason)
			const docs = await updateUserDocumentStatus(userId, documentId, status, reason);
			return res.status(200).send(dataResponse("User document status updated successfully", docs));
		} catch (err) {
			next(err);
		}
	},

	// Vendor Management (Admin)
	async getAllVendors(req, res, next) {
		try {
			const { page, limit, search, status, sortBy, sortOrder } = req.query;
			const vendors = await authServices.getAllVendors({ page, limit, search, status, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Vendors retrieved successfully", vendors));
		} catch (err) {
			next(err);
		}
	},

	async getVendor(req, res, next) {
		try {
			const { id } = req.params;
			const vendor = await authServices.getVendorById(id);
			return res.status(200).send(dataResponse("Vendor retrieved successfully", vendor));
		} catch (err) {
			next(err);
		}
	},

	async updateVendorStatus(req, res, next) {
		try {
			const { id } = req.params;
			const { status } = req.body;
			const vendor = await authServices.updateVendorStatus(id, status);
			return res.status(200).send(dataResponse("Vendor status updated successfully", vendor));
		} catch (err) {
			next(err);
		}
	},

	async toggleVendorActiveStatus(req, res, next) {
		try {
			const { id } = req.params;
			const vendor = await authServices.toggleVendorActiveStatus(id);
			return res.status(200).send(dataResponse("Vendor active status updated successfully", vendor));
		} catch (err) {
			next(err);
		}
	},

	async getUnverifiedVendors(req, res, next) {
		try {
			const { page, limit, search, status, documentStatus } = req.query;
			const items = await getUnverifiedVendorsWithStore({ page, limit, search, status, documentStatus });
			return res.status(200).send(dataResponse("Unverified vendors retrieved successfully", items));
		} catch (err) {
			next(err);
		}
	},

	async rejectVendorRequest(req, res, next) {
		try {
			const { userId } = req.params;
			const { reason } = req.body;
			await rejectVendorRequest(userId, reason);
			return res.status(200).send(dataResponse("Vendor request rejected successfully"));
		} catch (err) {
			next(err);
		}
	},

	async approveVendorForm(req, res, next) {
		try {
			const { userId } = req.params;
			await approveVendorForm(userId);
			return res.status(200).send(dataResponse("Vendor form approved successfully"));
		} catch (err) {
			next(err);
		}
	},

	async approveVendorFinal(req, res, next) {
		try {
			const { userId } = req.params;
			const { reason } = req.body;
			await approveVendorFinal(userId, reason);
			return res.status(200).send(dataResponse("Vendor approved and store verified successfully"));
		} catch (err) {
			next(err);
		}
	},

	async getUserDetail(req, res, next) {
		try {
			const { userId } = req.params;
			const result = await getUserDetailWithStoreAndDocuments(userId);
			return res.status(200).send(dataResponse("User detail retrieved successfully", result));
		} catch (err) {
			next(err);
		}
	},

	// DocumentType CRUD (Admin)
	async createDocumentType(req, res, next) {
		try {
			const item = await createDocumentType(req.body);
			return res.status(201).send(dataResponse("Document type created", item));
		} catch (err) {
			next(err);
		}
	},

	async listDocumentTypes(req, res, next) {
		try {
			const result = await getAllDocumentTypes(req.query);
			return res.status(200).send(dataResponse("Document types retrieved", result));
		} catch (err) {
			next(err);
		}
	},

	async updateDocumentType(req, res, next) {
		try {
			const { id } = req.params;
			const item = await updateDocumentType({ id, ...req.body });
			return res.status(200).send(dataResponse("Document type updated", item));
		} catch (err) {
			next(err);
		}
	},

	async deleteDocumentType(req, res, next) {
		try {
			const { id } = req.params;
			const result = await deleteDocumentType(id);
			return res.status(200).send(dataResponse("Document type deleted", result));
		} catch (err) {
			next(err);
		}
	}
	,

	// Business Types CRUD
	async createBusinessType(req, res, next) {
		try {
			const { name } = req.body;
			const data = await businessTypeServices.create({ name });
			return res.status(201).send(dataResponse("Business type created", data));
		} catch (err) { next(err); }
	},

	async listBusinessTypes(req, res, next) {
		try {
			const result = await businessTypeServices.list(req.query);
			return res.status(200).send(dataResponse("Business types retrieved", result));
		} catch (err) { next(err); }
	},

	async getBusinessType(req, res, next) {
		try {
			const { id } = req.params;
			const data = await businessTypeServices.get(id);
			return res.status(200).send(dataResponse("Business type retrieved", data));
		} catch (err) { next(err); }
	},

	async updateBusinessType(req, res, next) {
		try {
			const { id } = req.params;
			const data = await businessTypeServices.update(id, req.body);
			return res.status(200).send(dataResponse("Business type updated", data));
		} catch (err) { next(err); }
	},

	async deleteBusinessType(req, res, next) {
		try {
			const { id } = req.params;
			const data = await businessTypeServices.remove(id);
			return res.status(200).send(dataResponse("Business type deleted", data));
		} catch (err) { next(err); }
	},

	// User management (Admin)
	async listCustomers(req, res, next) {
		try {
			const { page, limit, search, status, sortBy, sortOrder } = req.query;
			const result = await authServices.listUsersByRoles({ roles: ["CUSTOMER", "GUEST"], page, limit, search, status, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Customers retrieved successfully", result));
		} catch (err) { next(err); }
	},

	async listVendors(req, res, next) {
		try {
			const { page, limit, search, status, sortBy, sortOrder } = req.query;
			const result = await authServices.listUsersByRoles({ roles: ["VENDOR"], page, limit, search, status, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Vendors retrieved successfully", result));
		} catch (err) { next(err); }
	},

	async listVendorStaff(req, res, next) {
		try {
			const { page, limit, search, status, sortBy, sortOrder } = req.query;
			const result = await authServices.listVendorStaff({ page, limit, search, status, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Vendor staff retrieved successfully", result));
		} catch (err) { next(err); }
	},

	async listAdmins(req, res, next) {
		try {
			const { page, limit, search, status, sortBy, sortOrder } = req.query;
			const result = await authServices.listUsersByRoles({ roles: ["ADMIN"], page, limit, search, status, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Admins retrieved successfully", result));
		} catch (err) { next(err); }
	},

	async listAdminStaff(req, res, next) {
		try {
			const { page, limit, search, status, sortBy, sortOrder } = req.query;
			const result = await authServices.listAdminStaff({ page, limit, search, status, sortBy, sortOrder });
			return res.status(200).send(dataResponse("Admin staff retrieved successfully", result));
		} catch (err) { next(err); }
	},

	async createUser(req, res, next) {
		try {
			const { role } = req.body;
			let created;
			if (role === 'ADMIN_STAFF') {
				created = await authServices.createAdminStaff(req.body);
			} else if (role === 'VENDOR_STAFF') {
				created = await authServices.createVendorStaff(req.body);
			} else {
				created = await authServices.createUser(req.body);
			}
			return res.status(201).send(dataResponse("User created successfully", created));
		} catch (err) { next(err); }
	},

	async getUser(req, res, next) {
		try {
			const { id } = req.params;
			const user = await authServices.getUserById(id);
			return res.status(200).send(dataResponse("User retrieved successfully", user));
		} catch (err) { next(err); }
	},

	async updateUser(req, res, next) {
		try {
			const { id } = req.params;
			const updated = await authServices.updateUser(id, req.body);
			return res.status(200).send(dataResponse("User updated successfully", updated));
		} catch (err) { next(err); }
	},

	async deleteUser(req, res, next) {
		try {
			const { id } = req.params;
			const result = await authServices.deleteUserAndRelated(id);
			return res.status(200).send(dataResponse("User and related data deleted successfully", result));
		} catch (err) { next(err); }
	},

	// Demote a vendor: remove vendor-side data but keep user; set role to CUSTOMER
	async demoteVendor(req, res, next) {
		try {
			const { id } = req.params;
			const result = await authServices.demoteVendorToCustomer(id);
			return res.status(200).send(dataResponse("Vendor demoted to customer and vendor data deleted", result));
		} catch (err) { next(err); }
	},

	async setUserPassword(req, res, next) {
		try {
			const { id } = req.params;
			const { newPassword } = req.body;

			if (!newPassword) {
				return res.status(400).send(dataResponse("New password is required", null));
			}

			// Allow only specific roles to be updated via this admin endpoint
			const target = await authServices.getUserById(id);
			const allowedRoles = ["ADMIN", "ADMIN_STAFF", "VENDOR", "VENDOR_STAFF"];
			if (!allowedRoles.includes(target.role)) {
				return res.status(403).send(dataResponse("Password reset not permitted for this role", null));
			}

			const updated = await authServices.updateUser(id, { password: newPassword });
			return res.status(200).send(dataResponse("Password updated successfully", { id: updated.id }));
		} catch (err) { next(err); }
	},

	// Vendor Management for Admin Panel
	async getVendorsManagement(req, res, next) {
		try {
			const { page = 1, limit = 10, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

			// Get vendors with their stores and basic stats
			const vendors = await authServices.getVendorsManagement({
				page: parseInt(page),
				limit: parseInt(limit),
				search,
				status,
				sortBy,
				sortOrder
			});

			return res.status(200).send(dataResponse("Vendors management data retrieved successfully", vendors));
		} catch (err) {
			next(err);
		}
	},

	async toggleVendorActiveStatusManagement(req, res, next) {
		try {
			const { id } = req.params;
			const vendor = await authServices.toggleVendorActiveStatus(id);
			return res.status(200).send(dataResponse("Vendor active status updated successfully", vendor));
		} catch (err) {
			next(err);
		}
	}
};
export default adminController;
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MOBILE: /^[6-9]\d{9}$/,
  OTP: /^\d{6}$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  PRICE: /^\d+(\.\d{1,2})?$/,
  SKU: /^[A-Z0-9-_]{1,50}$/,
};

export const ERROR_MESSAGES = {
  REQUIRED_FIELDS: "All fields are required",
  INVALID_EMAIL: "Invalid email format",
  INVALID_MOBILE: "Invalid mobile number format",
  INVALID_OTP: "Invalid OTP",
  INVALID_DEVICE_ID: "Invalid deviceId",
  USER_EXISTS: "User already exists",
  USER_NOT_FOUND: "User not found",
  ONLY_CUSTOMERS_UPGRADE: "Only customers can be upgraded to vendors",
  APPROVAL_PENDING: "Approval pending",
  SERVER_ERROR: "Server error",
  FILES_REQUIRED: "Profile photo and cover photo are required",

  // Category errors
  CATEGORY_NOT_FOUND: "Category not found",
  CATEGORY_EXISTS: "Category already exists",
  CATEGORY_HAS_PRODUCTS: "Cannot delete category with existing products",
  INVALID_CATEGORY_NAME: "Category name must be 2-50 characters",
  INVALID_SLUG: "Invalid slug format",

  // Product errors
  PRODUCT_NOT_FOUND: "Product not found",
  PRODUCT_EXISTS: "Product with this name already exists",
  INVALID_PRICE: "Invalid price format",
  INVALID_STOCK: "Stock must be a positive number",
  INVALID_SKU: "Invalid SKU format",
  PRODUCT_NOT_YOURS: "You can only manage your own products",
  INSUFFICIENT_STOCK: "Insufficient stock available",
};

export const SUCCESS_MESSAGES = {
  GUEST_CREATED: "Guest created",
  CUSTOMER_REGISTERED: "Customer registered",
  VENDOR_SUBMITTED: "Vendor submitted",
  ROLE_UPDATE_SUBMITTED: "Role update submitted",
  OTP_SENT: "OTP sent",
  OTP_VERIFIED: "OTP verified",
  STATUS_RETRIEVED: "Status retrieved",
  VENDOR_LIVE: "Vendor live",

  // Category messages
  CATEGORY_CREATED: "Category created successfully",
  CATEGORY_UPDATED: "Category updated successfully",
  CATEGORY_DELETED: "Category deleted successfully",
  CATEGORY_STATUS_UPDATED: "Category status updated successfully",

  // Product messages
  PRODUCT_CREATED: "Product created successfully",
  PRODUCT_UPDATED: "Product updated successfully",
  PRODUCT_DELETED: "Product deleted successfully",
  PRODUCT_STATUS_UPDATED: "Product status updated successfully",
  PRODUCT_APPROVED: "Product approved successfully",
  PRODUCT_REJECTED: "Product rejected successfully",
};

export const USER_ROLES = {
  GUEST: "GUEST",
  USER: "USER",
  CUSTOMER: "CUSTOMER",
  VENDOR_PENDING: "VENDOR_PENDING",
  VENDOR: "VENDOR",
  ADMIN: "ADMIN",
};

export const USER_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  LIVE: "LIVE",
};

export const PRODUCT_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  PENDING_REVIEW: "PENDING_REVIEW",
  REJECTED: "REJECTED",
};

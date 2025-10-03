import createError from "http-errors";
import { dataResponse } from "../utils/response.js";
import productServices from "../services/product.services.js";

const productController = {
  async createProduct(req, res, next) {
    try {
      const vendorId = req.user; 
      const productData = { ...req.body, vendorId };

      const product = await productServices.createProduct(productData);
      return res.status(201).send(dataResponse("Product created successfully", product));
    } catch (err) {
      next(err);
    }
  },

  async getVendorProducts(req, res, next) {
    try {
      const vendorId = req.user; 
      const queryParams = { ...req.query, vendorId };

      const result = await productServices.getVendorProducts(queryParams);
      return res.status(200).send(dataResponse("Vendor products fetched successfully", result));
    } catch (err) {
      next(err);
    }
  },

  async getPublicProducts(req, res, next) {
    try {
      const result = await productServices.getPublicProducts({ ...req.query, currentUserId: req.user, userId: req.query.userId });
      return res.status(200).send(dataResponse("Public products fetched successfully", result));
    } catch (err) {
      next(err);
    }
  },

  async getProduct(req, res, next) {
    try {
      const { id } = req.params;
      const { includeInactive, userId } = req.query;

      const product = await productServices.getProduct({ id, includeInactive, currentUserId: req.user, userId });
      return res.status(200).send(dataResponse("Product fetched successfully", product));
    } catch (err) {
      next(err);
    }
  },

  async updateProduct(req, res, next) {
    try {
      const vendorId = req.user; // Changed from req.user.id to req.user
      const { id } = req.params;
      const updateData = req.body;

      const updatedProduct = await productServices.updateProduct({
        id,
        vendorId,
        updateData,
      });

      return res.status(200).send(dataResponse("Product updated successfully", updatedProduct));
    } catch (err) {
      next(err);
    }
  },

  async updateProductStatus(req, res, next) {
    try {
      const vendorId = req.user; // Changed from req.user.id to req.user
      const { id } = req.params;
      const { status } = req.body;

      const updatedProduct = await productServices.updateProductStatus({
        id,
        vendorId,
        status,
      });

      return res.status(200).send(dataResponse("Product status updated successfully", updatedProduct));
    } catch (err) {
      next(err);
    }
  },

  async deleteProduct(req, res, next) {
    try {
      const vendorId = req.user; // Changed from req.user.id to req.user
      const { id } = req.params;

      await productServices.deleteProduct({ id, vendorId });
      return res.status(200).send(dataResponse("Product deleted successfully", true));
    } catch (err) {
      next(err);
    }
  },

  async getLowStockProducts(req, res, next) {
    try {
      const vendorId = req.user; // Changed from req.user.id to req.user

      const lowStockProducts = await productServices.getLowStockProducts({ vendorId });
      return res.status(200).send(dataResponse("Low stock products fetched successfully", lowStockProducts));
    } catch (err) {
      next(err);
    }
  },

  async getAllProducts(req, res, next) {
    try {
      const result = await productServices.getAllProducts(req.query);
      return res.status(200).send(dataResponse("All products fetched successfully", result));
    } catch (err) {
      next(err);
    }
  },

  async moderateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const { action, reason } = req.body;

      const updatedProduct = await productServices.moderateProduct({
        id,
        action,
        reason,
      });

      const message = action === "approve" ? "Product approved successfully" : "Product rejected successfully";
      return res.status(200).send(dataResponse(message, updatedProduct));
    } catch (err) {
      next(err);
    }
  },

  async getVendorReviews(req, res, next) {
    try {
      const vendorId = req.user;
      const { page, limit, minRating, startDate, endDate, sortBy, sortOrder } = req.query;

      const result = await productServices.getVendorReviews({
        vendorId,
        page,
        limit,
        minRating,
        startDate,
        endDate,
        sortBy,
        sortOrder,
      });

      return res.status(200).send(dataResponse("Vendor reviews fetched successfully", result));
    } catch (err) {
      next(err);
    }
  },

  async updateProductSpecifications(req, res, next) {
    try {
      const vendorId = req.user; // Changed from req.user.id to req.user
      const { id } = req.params;
      const { specifications } = req.body;

      const updatedProduct = await productServices.updateProductSpecifications({
        id,
        vendorId,
        specifications,
      });

      return res.status(200).send(dataResponse("Product specifications updated successfully", updatedProduct));
    } catch (err) {
      next(err);
    }
  },

  async toggleProductVisibility(req, res, next) {
    try {
      const vendorId = req.user; // Changed from req.user.id to req.user
      const { id } = req.params;

      const updatedProduct = await productServices.toggleProductVisibility({
        id,
        vendorId,
      });

      const message = `Product ${updatedProduct.isVisible ? 'made visible' : 'hidden'} successfully`;
      return res.status(200).send(dataResponse(message, updatedProduct));
    } catch (err) {
      next(err);
    }
  },

  async getAvailableVariationsForCategory(req, res, next) {
    try {
      const vendorId = req.user; // Changed from req.user.id to req.user
      const { categoryId } = req.params; // Fixed parameter name from id to categoryId

      const variations = await productServices.getAvailableVariationsForCategory({
        categoryId,
        vendorId,
      });

      return res.status(200).send(dataResponse("Available variations fetched successfully", variations));
    } catch (err) {
      next(err);
    }
  },

  async addProductVariations(req, res, next) {
    try {
      const vendorId = req.user;
      const { id: productId } = req.params;
      const { variations } = req.body;

      const created = await productServices.addProductVariations({ productId, vendorId, variations });
      return res.status(201).send(dataResponse("Product variations created successfully", created));
    } catch (err) {
      next(err);
    }
  },

  async updateProductVariation(req, res, next) {
    try {
      const vendorId = req.user;
      const { id: productId, variationId: productVariationId } = req.params;
      const data = req.body;

      const updated = await productServices.updateProductVariation({ productId, vendorId, productVariationId, data });
      return res.status(200).send(dataResponse("Product variation updated successfully", updated));
    } catch (err) {
      next(err);
    }
  },

  async deleteProductVariation(req, res, next) {
    try {
      const vendorId = req.user;
      const { id: productId, variationId: productVariationId } = req.params;

      await productServices.deleteProductVariation({ productId, vendorId, productVariationId });
      return res.status(200).send(dataResponse("Product variation deleted successfully", true));
    } catch (err) {
      next(err);
    }
  },

  // Bulk operations
  async bulkUpdateProductStatus(req, res, next) {
    try {
      const vendorId = req.user;
      const { productIds, status } = req.body;

      const result = await productServices.bulkUpdateProductStatus({ vendorId, productIds, status });
      return res.status(200).send(dataResponse("Product status updated successfully", result));
    } catch (err) {
      next(err);
    }
  },

  async bulkToggleProductVisibility(req, res, next) {
    try {
      const vendorId = req.user;
      const { productIds } = req.body;

      const result = await productServices.bulkToggleProductVisibility({ vendorId, productIds });
      return res.status(200).send(dataResponse("Product visibility toggled successfully", result));
    } catch (err) {
      next(err);
    }
  },

  async bulkDeleteProducts(req, res, next) {
    try {
      const vendorId = req.user;
      const { productIds } = req.body;

      const result = await productServices.bulkDeleteProducts({ vendorId, productIds });
      return res.status(200).send(dataResponse("Products deleted successfully", result));
    } catch (err) {
      next(err);
    }
  },
};

export default productController;

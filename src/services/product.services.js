import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";
import { validateRequiredFields, validatePrice, validateStock, validateSku, validateProductStatus, generateSlug } from "../utils/validation.js";
import { PRODUCT_STATUS } from "../constants/validation.js";

const prisma = new PrismaClient();

const ERROR_MESSAGES = {
  PRODUCT_EXISTS: "Product with this name already exists",
  PRODUCT_NOT_FOUND: "Product not found",
  PRODUCT_NOT_YOURS: "This product does not belong to you",
  SKU_EXISTS: "SKU already exists for your products",
  INVALID_CATEGORY: "Invalid or inactive category",
  INVALID_STATUS: "Invalid product status",
  INSUFFICIENT_STOCK: "Insufficient stock for this operation",
};

// Generate a SKU using first 4 letters of product name (letters only) and a random number
function generateBaseSkuFromName(name) {
  const lettersOnly = (name || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = (lettersOnly.slice(0, 4) || "PROD").padEnd(4, "X");
  const rand = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `${prefix}-${rand}`;
}

function generateVariationSku(basePrefix) {
  const prefix = (basePrefix || "PROD").toUpperCase();
  const rand = Math.floor(10000000 + Math.random() * 90000000); // 8 digits
  return `${prefix}-VAR-${rand}`;
}

const productServices = {
  async getVendorReviews({ vendorId, page = 1, limit = 10, minRating, startDate, endDate, sortBy = "createdAt", sortOrder = "desc" }) {
    if (!vendorId) {
      throw createError(400, "Vendor ID is required");
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause = {
      product: { vendorId },
    };

    if (minRating) {
      whereClause.rating = { gte: parseInt(minRating) };
    }
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await prisma.$transaction([
      prisma.reviews.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          product: { select: { id: true, name: true, images: true, sku: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.reviews.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items,
      meta: { total, page, limit, totalPages },
    };
  },
  async createProduct({ vendorId, categoryId, name, description, price, discountedPrice, sku, stock, images,  tags, weight, height, width, length, status = PRODUCT_STATUS.ACTIVE, productVeriations = [], specifications = [], specification = [], brand, stockStatus, shippingMethod, RMA, warehouseId }) {
    // Check if vendor has an approved store
    // const vendorStore = await prisma.store.findFirst({
    //   where: { 
    //     vendorId,
    //     isVerified: true
    //   }
    // });

    // if (!vendorStore) {
    //   throw createError(403, "You must have an approved store to create products. Please create and get your store verified first.");
    // }

    const specsToCreate = specifications.length > 0 ? specifications : specification;
    
    const fieldsValidation = validateRequiredFields({ name, description, price, categoryId }, ["name", "description", "price", "categoryId"]);
    if (!fieldsValidation.isValid) {
      throw createError(400, fieldsValidation.message);
    }

    const priceValidation = validatePrice(price);
    if (!priceValidation.isValid) {
      throw createError(400, priceValidation.message);
    }

    if (discountedPrice) {
      const discountedPriceValidation = validatePrice(discountedPrice);
      if (!discountedPriceValidation.isValid) {
        throw createError(400, "Invalid discounted price format");
      }
    }

    const stockValue = stock || 0;
    const stockValidation = validateStock(stockValue);
    if (!stockValidation.isValid) {
      throw createError(400, stockValidation.message);
    }

    // Normalize or generate product SKU and ensure uniqueness per vendor
    let normalizedProductSku = sku && sku.trim() ? sku.trim().toUpperCase() : generateBaseSkuFromName(name);
    if (sku) {
      const skuValidation = validateSku(normalizedProductSku);
      if (!skuValidation.isValid) {
        throw createError(400, skuValidation.message);
      }
    }
    // Ensure uniqueness for product SKU within vendor; regenerate if needed when auto-generated
    // If user supplied a duplicate SKU, throw; if auto-generated and collides, regenerate until unique
    // Try a few times to avoid infinite loop
    for (let attempt = 0; attempt < 10; attempt++) {
      const existingSku = await prisma.product.findFirst({
        where: {
          vendorId,
          sku: normalizedProductSku,
        },
      });
      if (!existingSku) break;
      if (sku) {
        throw createError(400, ERROR_MESSAGES.SKU_EXISTS);
      }
      normalizedProductSku = generateBaseSkuFromName(name);
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || !category.isActive) {
      throw createError(400, ERROR_MESSAGES.INVALID_CATEGORY);
    }

    const existingProduct = await prisma.product.findFirst({
      where: {
        vendorId,
        name: name.trim(),
      },
    });

    if (existingProduct) {
      throw createError(400, ERROR_MESSAGES.PRODUCT_EXISTS);
    }

    const baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Validate product status if provided
    if (status && !validateProductStatus(status).isValid) {
      throw createError(400, ERROR_MESSAGES.INVALID_STATUS);
    }

    // Validate warehouse ownership if provided
    let validatedWarehouseId = null;
    if (warehouseId) {
      const warehouse = await prisma.wareHouse.findFirst({
        where: { id: warehouseId, userId: vendorId },
      });
      if (!warehouse) {
        throw createError(400, "Invalid warehouse selection");
      }
      validatedWarehouseId = warehouseId;
    }

    const lastProduct = await prisma.product.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { productId: true }
    });
    let nextProductId = "0000";
    if (lastProduct && lastProduct.productId) {
      const n = parseInt(lastProduct.productId, 10);
      const next = isNaN(n) ? 0 : n + 1;
      nextProductId = next.toString().padStart(4, '0');
    }

    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          vendorId,
          categoryId,
          productId: nextProductId,
          name: name.trim(),
          description: description.trim(),
          slug,
          sku: normalizedProductSku || null,
          price: parseFloat(price),
          discountedPrice: discountedPrice ? parseFloat(discountedPrice) : null,
          stock: parseInt(stockValue),
          images: images || [],
          tags: tags || [],
          weight: weight ? parseFloat(weight) : null,
          height: height || "",
          width: width || "",
          length: length || "",
          status,
          stockStatus: stockStatus || undefined,
          shippingMethod: shippingMethod || undefined,
          RMA: RMA || undefined,
          brand: brand || undefined,
          adminApproved: false,
          isVisible: true,
          warehouseId: validatedWarehouseId,
        },
      });

      // Create product variations if provided (auto-generate SKU when missing and ensure uniqueness)
      if (productVeriations && productVeriations.length > 0) {
        const basePrefix = (name || "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "PROD";
        for (const variation of productVeriations) {
          const desiredSkuRaw = variation.sku && variation.sku.trim() ? variation.sku.trim().toUpperCase() : generateVariationSku(basePrefix);
          let desiredSku = desiredSkuRaw;
          // Ensure variation SKU uniqueness across product variations (global)
          for (let attempt = 0; attempt < 10; attempt++) {
            const exists = await tx.productVeriations.findFirst({
              where: { sku: desiredSku }
            });
            if (!exists) break;
            if (variation.sku) {
              throw createError(400, `SKU ${variation.sku} already exists for another product`);
            }
            desiredSku = generateVariationSku(basePrefix);
          }

          const createdVariation = await tx.productVeriations.create({
            data: {
              name: variation.name || `${variation.key}: ${variation.value}`,
              sku: desiredSku,
              price: parseFloat(variation.price),
              stock: parseInt(variation.stock || 0),
              images: Array.isArray(variation.images) ? variation.images : [],
              discountedPrice: variation.discountedPrice !== undefined && variation.discountedPrice !== null
                ? parseFloat(variation.discountedPrice)
                : null,
              stockStatus: variation.stockStatus || undefined,
              status: variation.status || undefined,
              weight: variation.weight !== undefined && variation.weight !== null
                ? parseFloat(variation.weight)
                : null,
              height: variation.height || undefined,
              width: variation.width || undefined,
              length: variation.length || undefined,
              shippingMethod: variation.shippingMethod || undefined,
              productId: createdProduct.id,
              variationsId: variation.veriationId || undefined,
            }
          });

          // Create product variation attributes (array) if provided
          if (Array.isArray(variation.productVeriationsAttribute) && variation.productVeriationsAttribute.length > 0) {
            const attributesPayload = variation.productVeriationsAttribute
              .filter(a => a && a.veriationId && a.key && a.value)
              .map(a => ({
                key: a.key.trim(),
                value: a.value.trim(),
                veriationId: a.veriationId,
                productVeriationsId: createdVariation.id,
              }));
            if (attributesPayload.length > 0) {
              await tx.prodcuctVeriationAttributes.createMany({ data: attributesPayload });
            }
          } else if (variation.key && variation.value && variation.veriationId) {
            // Backward compatibility: single key/value on root
            await tx.prodcuctVeriationAttributes.create({
              data: {
                key: variation.key.trim(),
                value: variation.value.trim(),
                veriationId: variation.veriationId,
                productVeriationsId: createdVariation.id,
              }
            });
          }
        }
      }

      // Create specifications if provided
      if (specsToCreate && specsToCreate.length > 0) {
        const specsToCreateData = specsToCreate.map(spec => ({
          name: spec.name.trim(),
          value: spec.value.trim(),
          productId: createdProduct.id,
        }));

        await tx.specification.createMany({
          data: specsToCreateData
        });
      }

      return createdProduct;
    }, {
      timeout: 10000 // Increase timeout to 10 seconds
    });

    // Fetch the complete product with all relations after transaction
    const completeProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        vendor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            storeName: true,
          },
        },
        productVeriations: {
          include: {
            variations: {
              select: { id: true, name: true, type: true, group: true }
            },
            productVeriationAttributes: true
          }
        },
        specification: true
      },
    });

    return completeProduct;
  },

  async getVendorProducts({ vendorId, page = 1, limit = 10, status, categoryId, search, sortBy = "createdAt", sortOrder = "desc", visibility, minPrice, maxPrice, minStock, maxStock, minWeight, maxWeight, startDate, endDate }) {
    const whereClause = { vendorId };

    if (status && Object.values(PRODUCT_STATUS).includes(status)) {
      whereClause.status = status;
    }

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (visibility !== undefined) {
      whereClause.isVisible = visibility === 'visible' || visibility === true;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price.gte = parseFloat(minPrice);
      if (maxPrice) whereClause.price.lte = parseFloat(maxPrice);
    }

    // Stock range filter
    if (minStock !== undefined || maxStock !== undefined) {
      whereClause.stock = {};
      if (minStock !== undefined) whereClause.stock.gte = parseInt(minStock);
      if (maxStock !== undefined) whereClause.stock.lte = parseInt(maxStock);
    }

    // Weight range filter
    if (minWeight || maxWeight) {
      whereClause.weight = {};
      if (minWeight) whereClause.weight.gte = parseFloat(minWeight);
      if (maxWeight) whereClause.weight.lte = parseFloat(maxWeight);
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where: whereClause,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          productVeriations:{
            include:{
              variations:true,
              productVeriationAttributes: true
            }
          },
          specification:true
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  async getPublicProducts({ page = 1, limit = 12, categoryId, vendorId, search, minPrice, maxPrice, sortBy = "createdAt", sortOrder = "desc", featured, currentUserId, userId }) {
    const whereClause = {
      // isVisible: true,
      // adminApproved: true,
      // status: PRODUCT_STATUS.ACTIVE,
    };

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (vendorId) {
      whereClause.vendorId = vendorId;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }

    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price.gte = parseFloat(minPrice);
      if (maxPrice) whereClause.price.lte = parseFloat(maxPrice);
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 12;
    const skip = (page - 1) * limit;

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where: whereClause,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          warehouse: true,
          vendor: {
            select: {
              id: true,
              storeName: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
              Store: {
                select: {
                  id: true,
                  storeName: true,
                  userName: true,
                  isVerified: true,
                  isRejected: true,
                  reason: true,
                  description: true,
                  profileImage: true,
                  coverImage: true,
                }
              }
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    // Attach rating aggregates and vendor rating to each product
    const productsWithRatings = await Promise.all(products.map(async (p) => {
      const productAgg = await prisma.reviews.aggregate({
        where: { productId: p.id },
        _avg: { rating: true },
        _count: { rating: true }
      });

      const vendorAgg = await prisma.reviews.aggregate({
        where: { product: { vendorId: p.vendorId } },
        _avg: { rating: true },
        _count: { rating: true }
      });

      // Get detailed star breakdown for product
      const productReviews = await prisma.reviews.findMany({
        where: { productId: p.id },
        select: { rating: true }
      });

      const productStarBreakdown = {
        5: productReviews.filter(r => r.rating === 5).length,
        4: productReviews.filter(r => r.rating === 4).length,
        3: productReviews.filter(r => r.rating === 3).length,
        2: productReviews.filter(r => r.rating === 2).length,
        1: productReviews.filter(r => r.rating === 1).length
      };

      // Get detailed star breakdown for vendor
      const vendorReviews = await prisma.reviews.findMany({
        where: { product: { vendorId: p.vendorId } },
        select: { rating: true }
      });

      const vendorStarBreakdown = {
        5: vendorReviews.filter(r => r.rating === 5).length,
        4: vendorReviews.filter(r => r.rating === 4).length,
        3: vendorReviews.filter(r => r.rating === 3).length,
        2: vendorReviews.filter(r => r.rating === 2).length,
        1: vendorReviews.filter(r => r.rating === 1).length
      };

      let isFav = false;
      const userIdToCheck = userId || currentUserId;
      if (userIdToCheck) {
        const fav = await prisma.favProducts.findFirst({ where: { userId: userIdToCheck, productId: p.id } });
        console.log("🚀 ~ getPublicProducts ~ fav:", fav)
        isFav = !!fav;
      }

      return {
        ...p,
        rating: {
          average: productAgg._avg.rating || 0,
          count: productAgg._count.rating || 0,
          starBreakdown: productStarBreakdown
        },
        vendorRating: {
          average: vendorAgg._avg.rating || 0,
          count: vendorAgg._count.rating || 0,
          starBreakdown: vendorStarBreakdown
        },
        isFav
      };
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data: productsWithRatings,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  async getProduct({ id, includeInactive = true, currentUserId, userId }) {
    const whereClause = { id };

    if (!includeInactive) {
      whereClause.isVisible = true;
      whereClause.adminApproved = true;
      whereClause.status = PRODUCT_STATUS.ACTIVE;
    }

    const product = await prisma.product.findUnique({
      where: whereClause,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        warehouse:true,
        vendor: {
          select: {
            id: true,
            storeName: true,
            firstName: true,
            lastName: true,
            profilePhoto: true,
            city: true,
            state: true,
            role: true,
            status: true,
            Store: {
              select: {
                id: true,
                storeName: true,
                userName: true,
                isVerified: true,
                isRejected: true,
                reason: true,
                description: true,
                profileImage: true,
                coverImage: true,
              }
            }
          },
        },
        specification: true,
        productVeriations: {
          include: {
            variations: {
              select: { id: true, name: true, type: true, group: true }
            },
            productVeriationAttributes: true
          }
        }
      },
    });

    if (!product) {
      throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    // Aggregate product rating and vendor rating
    const productAgg = await prisma.reviews.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
      _count: { rating: true }
    });

    const vendorAgg = await prisma.reviews.aggregate({
      where: { product: { vendorId: product.vendorId } },
      _avg: { rating: true },
      _count: { rating: true }
    });

    // Get detailed star breakdown for product
    const productReviews = await prisma.reviews.findMany({
      where: { productId: product.id },
      select: { rating: true }
    });

    const productStarBreakdown = {
      5: productReviews.filter(r => r.rating === 5).length,
      4: productReviews.filter(r => r.rating === 4).length,
      3: productReviews.filter(r => r.rating === 3).length,
      2: productReviews.filter(r => r.rating === 2).length,
      1: productReviews.filter(r => r.rating === 1).length
    };

    // Get detailed star breakdown for vendor
    const vendorReviews = await prisma.reviews.findMany({
      where: { product: { vendorId: product.vendorId } },
      select: { rating: true }
    });

    const vendorStarBreakdown = {
      5: vendorReviews.filter(r => r.rating === 5).length,
      4: vendorReviews.filter(r => r.rating === 4).length,
      3: vendorReviews.filter(r => r.rating === 3).length,
      2: vendorReviews.filter(r => r.rating === 2).length,
      1: vendorReviews.filter(r => r.rating === 1).length
    };

    // Fetch latest reviews for product detail (limit 5)
    const latestReviews = await prisma.reviews.findMany({
      where: { productId: product.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    let isFav = false;
    const userIdToCheck = userId ;
    console.log("🚀 ~ getProduct ~ userIdToCheck:", userIdToCheck)
    console.log("🚀 ~ getProduct ~ userIdToCheck:",  product.id)
    if (userIdToCheck) {
      const fav = await prisma.favProducts.findFirst({ where: { userId: userIdToCheck, productId: product.id } });
      console.log("🚀 ~ getProduct ~ fav:", fav)
      isFav = !!fav;
    }

    return {
      ...product,
      rating: {
        average: productAgg._avg.rating || 0,
        count: productAgg._count.rating || 0,
        starBreakdown: productStarBreakdown
      },
      vendorRating: {
        average: vendorAgg._avg.rating || 0,
        count: vendorAgg._count.rating || 0,
        starBreakdown: vendorStarBreakdown
      },
      reviews: latestReviews,
      isFav
    };
  },

  async updateProduct({ id, vendorId, updateData }) {
    // Check if vendor has an approved store
    const vendorStore = await prisma.store.findFirst({
      where: { 
        vendorId,
        isVerified: true
      }
    });

    if (!vendorStore) {
      throw createError(403, "You must have an approved store to update products. Please get your store verified first.");
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    if (existingProduct.vendorId !== vendorId) {
      throw createError(403, ERROR_MESSAGES.PRODUCT_NOT_YOURS);
    }

    // Handle both 'specification' and 'specifications' field names
    const specsToUpdate = updateData.specifications || updateData.specification || [];
    const variationsToUpdate = updateData.productVeriations || [];

    const fieldsToUpdate = {};

    if (updateData.price !== undefined) {
      const priceValidation = validatePrice(updateData.price);
      if (!priceValidation.isValid) {
        throw createError(400, priceValidation.message);
      }
      fieldsToUpdate.price = parseFloat(updateData.price);
    }

    if (updateData.discountedPrice !== undefined) {
      if (updateData.discountedPrice) {
        const discountedPriceValidation = validatePrice(updateData.discountedPrice);
        if (!discountedPriceValidation.isValid) {
          throw createError(400, "Invalid discounted price format");
        }
        fieldsToUpdate.discountedPrice = parseFloat(updateData.discountedPrice);
      } else {
        fieldsToUpdate.discountedPrice = null;
      }
    }

    if (updateData.stock !== undefined) {
      const stockValidation = validateStock(updateData.stock);
      if (!stockValidation.isValid) {
        throw createError(400, stockValidation.message);
      }
      fieldsToUpdate.stock = parseInt(updateData.stock);
    }

    if (updateData.sku !== undefined) {
      if (updateData.sku) {
        const normalizedSku = updateData.sku.trim().toUpperCase();
        const skuValidation = validateSku(normalizedSku);
        if (!skuValidation.isValid) {
          throw createError(400, skuValidation.message);
        }

        const existingSku = await prisma.product.findFirst({
          where: {
            vendorId,
            sku: normalizedSku,
            id: { not: id },
          },
        });

        if (existingSku) {
          throw createError(400, ERROR_MESSAGES.SKU_EXISTS);
        }

        fieldsToUpdate.sku = normalizedSku;
      } else {
        // Auto-generate a new SKU when explicitly set to empty
        let autoSku = generateBaseSkuFromName(updateData.name || existingProduct.name);
        for (let attempt = 0; attempt < 10; attempt++) {
          const exists = await prisma.product.findFirst({
            where: { vendorId, sku: autoSku, id: { not: id } },
          });
          if (!exists) break;
          autoSku = generateBaseSkuFromName(updateData.name || existingProduct.name);
        }
        fieldsToUpdate.sku = autoSku;
      }
    }

    if (updateData.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: updateData.categoryId },
      });

      if (!category || !category.isActive) {
        throw createError(400, ERROR_MESSAGES.INVALID_CATEGORY);
      }

      fieldsToUpdate.categoryId = updateData.categoryId;
    }

    // Handle warehouse change: validate ownership; allow unset by null/empty
    if (updateData.warehouseId !== undefined) {
      if (updateData.warehouseId) {
        const warehouse = await prisma.wareHouse.findFirst({
          where: { id: updateData.warehouseId, userId: vendorId },
        });
        if (!warehouse) {
          throw createError(400, "Invalid warehouse selection");
        }
        fieldsToUpdate.warehouseId = updateData.warehouseId;
      } else {
        fieldsToUpdate.warehouseId = null;
      }
    }

    if (updateData.name && updateData.name.trim() !== existingProduct.name) {
      const existingName = await prisma.product.findFirst({
        where: {
          vendorId,
          name: updateData.name.trim(),
          id: { not: id },
        },
      });

      if (existingName) {
        throw createError(400, ERROR_MESSAGES.PRODUCT_EXISTS);
      }

      fieldsToUpdate.name = updateData.name.trim();

      const baseSlug = generateSlug(updateData.name);
      let slug = baseSlug;
      let counter = 1;

      while (
        await prisma.product.findFirst({
          where: { slug, id: { not: id } },
        })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      fieldsToUpdate.slug = slug;
    }

    const simpleFields = [
      "description",
      "lowStockThreshold",
      "images",
      "tags",
      "weight",
      "height",
      "width",
      "length",
      "isVisible",
      "brand",
      "stockStatus",
      "shippingMethod",
      "RMA",
    ];

    simpleFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        if (field === "weight") {
          fieldsToUpdate[field] = updateData[field]
            ? parseFloat(updateData[field])
            : null;
        } else if (field === "lowStockThreshold") {
          fieldsToUpdate[field] = parseInt(updateData[field]) || 5;
        } else {
          fieldsToUpdate[field] = updateData[field];
        }
      }
    });

    // Update product status (vendor allowed subset)
    if (updateData.status !== undefined) {
      const statusValidation = validateProductStatus(updateData.status);
      if (!statusValidation.isValid) {
        throw createError(400, statusValidation.message);
      }
      const allowedStatuses = [
        PRODUCT_STATUS.DRAFT,
        PRODUCT_STATUS.ACTIVE,
        PRODUCT_STATUS.INACTIVE,
      ];
      if (!allowedStatuses.includes(updateData.status)) {
        throw createError(400, "Invalid status for vendor");
      }
      fieldsToUpdate.status = updateData.status;
    }

    // Update product with variations and specifications in a transaction
    const updatedProduct = await prisma.$transaction(async (tx) => {
      // Update basic product fields
      const updatedProduct = await tx.product.update({
        where: { id },
        data: fieldsToUpdate,
      });

      // Update product variations if provided (auto-generate SKU when missing)
      if (variationsToUpdate.length > 0) {
        // Validate variations first
        for (const variation of variationsToUpdate) {
          if (!variation.veriationId || !variation.key || !variation.value || !variation.price) {
            throw createError(400, "Product variation must include veriationId, key, value, and price");
          }

          // Validate variation price
          const variationPriceValidation = validatePrice(variation.price);
          if (!variationPriceValidation.isValid) {
            throw createError(400, `Invalid price for variation ${variation.name || variation.key}: ${variationPriceValidation.message}`);
          }

          // Validate variation stock
          const variationStock = variation.stock || 0;
          const variationStockValidation = validateStock(variationStock);
          if (!variationStockValidation.isValid) {
            throw createError(400, `Invalid stock for variation ${variation.name || variation.key}: ${variationStockValidation.message}`);
          }

          // Check if variation exists and belongs to user
          const categoryIdToUse = updateData.categoryId || existingProduct.categoryId;
          const existingVariation = await tx.variations.findFirst({
            where: {
              id: variation.veriationId,
              userId: vendorId,
              categories: { has: categoryIdToUse }
            }
          });

          if (!existingVariation) {
            throw createError(400, `Variation ${variation.veriationId} not found or not available for this category`);
          }

          // Check if SKU already exists for other products
          // Validate uniqueness, generate if missing
          const basePrefix = (updateData.name || existingProduct.name || "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "PROD";
          let desiredSku = variation.sku && variation.sku.trim() ? variation.sku.trim().toUpperCase() : generateVariationSku(basePrefix);
          for (let attempt = 0; attempt < 10; attempt++) {
            const existingVariationSku = await tx.productVeriations.findFirst({
              where: {
                sku: desiredSku,
                productId: { not: id }
              }
            });
            if (!existingVariationSku) break;
            if (variation.sku) {
              throw createError(400, `SKU ${variation.sku} already exists for another product`);
            }
            desiredSku = generateVariationSku(basePrefix);
          }
          variation.__normalizedSku = desiredSku;
        }

        // Delete existing variation attributes then variations
        await tx.prodcuctVeriationAttributes.deleteMany({
          where: { productVeriations: { productId: id } }
        });
        await tx.productVeriations.deleteMany({
          where: { productId: id }
        });

        // Create new variations and their attributes
        for (const variation of variationsToUpdate) {
          const createdVariation = await tx.productVeriations.create({
            data: {
              name: variation.name || `${variation.key}: ${variation.value}`,
              sku: (variation.__normalizedSku || variation.sku || "").toString().toUpperCase(),
              price: parseFloat(variation.price),
              stock: parseInt(variation.stock || 0),
              images: Array.isArray(variation.images) ? variation.images : [],
              discountedPrice: variation.discountedPrice !== undefined && variation.discountedPrice !== null
                ? parseFloat(variation.discountedPrice)
                : null,
              stockStatus: variation.stockStatus || undefined,
              status: variation.status || undefined,
              weight: variation.weight !== undefined && variation.weight !== null
                ? parseFloat(variation.weight)
                : null,
              height: variation.height || undefined,
              width: variation.width || undefined,
              length: variation.length || undefined,
              shippingMethod: variation.shippingMethod || undefined,
              productId: id,
              variationsId: variation.veriationId || undefined,
            }
          });

          // Create attributes from array when provided, else fallback to single key/value
          if (Array.isArray(variation.productVeriationsAttribute) && variation.productVeriationsAttribute.length > 0) {
            const attributesPayload = variation.productVeriationsAttribute
              .filter(a => a && a.veriationId && a.key && a.value)
              .map(a => ({
                key: a.key.trim(),
                value: a.value.trim(),
                veriationId: a.veriationId,
                productVeriationsId: createdVariation.id,
              }));
            if (attributesPayload.length > 0) {
              await tx.prodcuctVeriationAttributes.createMany({ data: attributesPayload });
            }
          } else if (variation.key && variation.value && variation.veriationId) {
            await tx.prodcuctVeriationAttributes.create({
              data: {
                key: variation.key.trim(),
                value: variation.value.trim(),
                veriationId: variation.veriationId,
                productVeriationsId: createdVariation.id,
              }
            });
          }
        }
      }

      // Update specifications if provided
      if (specsToUpdate.length > 0) {
        // Validate specifications
        for (const spec of specsToUpdate) {
          if (!spec.name || !spec.value) {
            throw createError(400, "Specification must include both name and value");
          }
        }

        // Delete existing specifications
        await tx.specification.deleteMany({
          where: { productId: id }
        });

        // Create new specifications
        const specsToCreate = specsToUpdate.map(spec => ({
          name: spec.name.trim(),
          value: spec.value.trim(),
          productId: id,
        }));

        await tx.specification.createMany({
          data: specsToCreate
        });
      }

      return updatedProduct;
    }, {
      timeout: 10000 // Increase timeout to 10 seconds
    });

    // Fetch the complete updated product with all relations
    const completeProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        vendor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            storeName: true,
          },
        },
        productVeriations: {
          include: {
            variations: {
              select: { id: true, name: true, type: true, group: true }
            },
            productVeriationAttributes: true
          }
        },
        specification: true
      },
    });

    return completeProduct;
  },

  async updateProductStatus({ id, vendorId, status }) {
    // Check if vendor has an approved store
    const vendorStore = await prisma.store.findFirst({
      where: { 
        vendorId,
        isVerified: true
      }
    });

    if (!vendorStore) {
      throw createError(403, "You must have an approved store to manage products. Please get your store verified first.");
    }

    const statusValidation = validateProductStatus(status);
    if (!statusValidation.isValid) {
      throw createError(400, statusValidation.message);
    }

    const allowedStatuses = [
      PRODUCT_STATUS.DRAFT,
      PRODUCT_STATUS.ACTIVE,
      PRODUCT_STATUS.INACTIVE,
    ];
    if (!allowedStatuses.includes(status)) {
      throw createError(400, "Invalid status for vendor");
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    if (existingProduct.vendorId !== vendorId) {
      throw createError(403, ERROR_MESSAGES.PRODUCT_NOT_YOURS);
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { status },
    });

    return updatedProduct;
  },

  async deleteProduct({ id, vendorId }) {
    if (!id) {
      throw createError(400, "Product ID is required");
    }

    if (!vendorId) {
      throw createError(400, "Vendor ID is required");
    }

    // First check if product exists and belongs to vendor
    const existingProduct = await prisma.product.findFirst({
      where: { 
        id,
        vendorId 
      },
    });

    if (!existingProduct) {
      // Check if product exists but doesn't belong to vendor
      const productExists = await prisma.product.findUnique({
        where: { id },
        select: { id: true, vendorId: true }
      });

      if (productExists) {
        throw createError(403, ERROR_MESSAGES.PRODUCT_NOT_YOURS);
      } else {
        throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
      }
    }

    // Delete product - cascade deletion will handle all related data automatically
    // But we'll use a transaction for safety and to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Delete product variation attributes first (they reference productVeriations)
      await tx.prodcuctVeriationAttributes.deleteMany({
        where: { productVeriations: { productId: id } }
      });

      // Delete the product - this will cascade delete all other related records
      await tx.product.delete({ where: { id } });
    });

    return true;
  },

  async getLowStockProducts({ vendorId }) {
    const allProducts = await prisma.product.findMany({
      where: {
        vendorId,
        isVisible: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        lowStockThreshold: true,
        category: {
          select: { name: true },
        },
      },
      orderBy: { stock: "asc" },
    });

    const lowStockProducts = allProducts.filter(
      (product) => product.stock <= product.lowStockThreshold
    );

    return lowStockProducts;
  },

  async getAllProducts({ page = 1, limit = 10, status, vendorId, categoryId, search, sortBy = "createdAt", sortOrder = "desc" }) {
    const whereClause = {};

    if (status && Object.values(PRODUCT_STATUS).includes(status)) {
      whereClause.status = status;
    }

    if (vendorId) {
      whereClause.vendorId = vendorId;
    }

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where: whereClause,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          vendor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              storeName: true,
              email: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  async moderateProduct({ id, action, reason }) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!product) {
      throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    let updateData = {};

    if (action === "approve") {
      updateData = {
        adminApproved: true,
        status: PRODUCT_STATUS.ACTIVE,
      };
    } else if (action === "reject") {
      updateData = {
        adminApproved: false,
        status: PRODUCT_STATUS.REJECTED,
      };
    } else {
      throw createError(400, "Invalid action. Use 'approve' or 'reject'");
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true },
        },
        vendor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            storeName: true,
          },
        },
      },
    });

    return updatedProduct;
  },

  async updateProductSpecifications({ id, vendorId, specifications }) {
    // Check if vendor has an approved store
    const vendorStore = await prisma.store.findFirst({
      where: { 
        vendorId,
        isVerified: true
      }
    });

    if (!vendorStore) {
      throw createError(403, "You must have an approved store to manage products. Please get your store verified first.");
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    if (existingProduct.vendorId !== vendorId) {
      throw createError(403, ERROR_MESSAGES.PRODUCT_NOT_YOURS);
    }

    // Delete existing specifications
    await prisma.specification.deleteMany({
      where: { productId: id },
    });

    // Create new specifications
    if (specifications && specifications.length > 0) {
      await prisma.specification.createMany({
        data: specifications.map(spec => ({
          name: spec.name,
          value: spec.value,
          productId: id,
        })),
      });
    }

    const updatedProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        specification: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        vendor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            storeName: true,
          },
        },
      },
    });

    return updatedProduct;
  },

  async toggleProductVisibility({ id, vendorId }) {
    // Check if vendor has an approved store
    const vendorStore = await prisma.store.findFirst({
      where: { 
        vendorId,
        isVerified: true
      }
    });

    if (!vendorStore) {
      throw createError(403, "You must have an approved store to manage products. Please get your store verified first.");
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    }

    if (existingProduct.vendorId !== vendorId) {
      throw createError(403, ERROR_MESSAGES.PRODUCT_NOT_YOURS);
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { isVisible: !existingProduct.isVisible },
    });

    return updatedProduct;
  },

  async getAvailableVariationsForCategory({ categoryId, vendorId }) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category || !category.isActive) {
      throw createError(400, ERROR_MESSAGES.INVALID_CATEGORY);
    }

    const variations = await prisma.variations.findMany({
      where: {
        userId: vendorId,
        categories: { has: categoryId }
      },
      include: {
        variationOptions: {
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { order: "asc" }
    });

    return variations;
  },

  async addProductVariations({ productId, vendorId, variations }) {
    if (!Array.isArray(variations) || variations.length === 0) {
      throw createError(400, "Variations array is required");
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    if (product.vendorId !== vendorId) throw createError(403, ERROR_MESSAGES.PRODUCT_NOT_YOURS);

    const basePrefix = (product.name || "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "PROD";

    const created = await prisma.$transaction(async (tx) => {
      const createdVariations = [];
      for (const v of variations) {
        if (!v.price) throw createError(400, "Variation price is required");
        const priceValidation = validatePrice(v.price);
        if (!priceValidation.isValid) throw createError(400, priceValidation.message);

        const stockCount = v.stock || 0;
        const stockValidation = validateStock(stockCount);
        if (!stockValidation.isValid) throw createError(400, stockValidation.message);

        let desiredSku = v.sku && v.sku.trim() ? v.sku.trim().toUpperCase() : generateVariationSku(basePrefix);
        for (let attempt = 0; attempt < 10; attempt++) {
          const exists = await tx.productVeriations.findFirst({ where: { sku: desiredSku } });
          if (!exists) break;
          if (v.sku) throw createError(400, `SKU ${v.sku} already exists for another product`);
          desiredSku = generateVariationSku(basePrefix);
        }

        const createdVariation = await tx.productVeriations.create({
          data: {
            name: v.name || undefined,
            sku: desiredSku,
            price: parseFloat(v.price),
            stock: parseInt(stockCount),
            images: Array.isArray(v.images) ? v.images : [],
            discountedPrice: v.discountedPrice !== undefined && v.discountedPrice !== null ? parseFloat(v.discountedPrice) : null,
            stockStatus: v.stockStatus || undefined,
            status: v.status || undefined,
            weight: v.weight !== undefined && v.weight !== null ? parseFloat(v.weight) : null,
            height: v.height || undefined,
            width: v.width || undefined,
            length: v.length || undefined,
            shippingMethod: v.shippingMethod || undefined,
            productId,
            variationsId: v.veriationId || undefined,
          }
        });

        if (Array.isArray(v.productVeriationsAttribute) && v.productVeriationsAttribute.length > 0) {
          const attrs = v.productVeriationsAttribute
            .filter(a => a && a.veriationId && a.key && a.value)
            .map(a => ({
              key: a.key.trim(),
              value: a.value.trim(),
              veriationId: a.veriationId,
              productVeriationsId: createdVariation.id,
            }));
          if (attrs.length > 0) {
            await tx.prodcuctVeriationAttributes.createMany({ data: attrs });
          }
        }

        createdVariations.push(createdVariation);
      }

      return createdVariations;
    });

    return created;
  },

  async updateProductVariation({ productId, vendorId, productVariationId, data }) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    if (product.vendorId !== vendorId) throw createError(403, ERROR_MESSAGES.PRODUCT_NOT_YOURS);

    const variation = await prisma.productVeriations.findUnique({ where: { id: productVariationId } });
    if (!variation || variation.productId !== productId) {
      throw createError(404, "Product variation not found");
    }

    const updatePayload = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.price !== undefined) {
      const pv = validatePrice(data.price);
      if (!pv.isValid) throw createError(400, pv.message);
      updatePayload.price = parseFloat(data.price);
    }
    if (data.discountedPrice !== undefined) {
      updatePayload.discountedPrice = data.discountedPrice !== null && data.discountedPrice !== ""
        ? parseFloat(data.discountedPrice)
        : null;
    }
    if (data.stock !== undefined) {
      const sv = validateStock(data.stock);
      if (!sv.isValid) throw createError(400, sv.message);
      updatePayload.stock = parseInt(data.stock);
    }
    if (data.sku !== undefined) {
      if (data.sku) {
        const normalized = data.sku.trim().toUpperCase();
        const exists = await prisma.productVeriations.findFirst({ where: { sku: normalized, id: { not: productVariationId } } });
        if (exists) throw createError(400, `SKU ${normalized} already exists for another product`);
        updatePayload.sku = normalized;
      } else {
        const basePrefix = (product.name || "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "PROD";
        let newSku = generateVariationSku(basePrefix);
        for (let attempt = 0; attempt < 10; attempt++) {
          const exists = await prisma.productVeriations.findFirst({ where: { sku: newSku } });
          if (!exists) break;
          newSku = generateVariationSku(basePrefix);
        }
        updatePayload.sku = newSku;
      }
    }
    if (data.images !== undefined) updatePayload.images = Array.isArray(data.images) ? data.images : [];
    if (data.stockStatus !== undefined) updatePayload.stockStatus = data.stockStatus;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.weight !== undefined) updatePayload.weight = data.weight !== null && data.weight !== "" ? parseFloat(data.weight) : null;
    if (data.height !== undefined) updatePayload.height = data.height;
    if (data.width !== undefined) updatePayload.width = data.width;
    if (data.length !== undefined) updatePayload.length = data.length;
    if (data.shippingMethod !== undefined) updatePayload.shippingMethod = data.shippingMethod;
    if (data.veriationId !== undefined) updatePayload.variationsId = data.veriationId || undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedVar = await tx.productVeriations.update({ where: { id: productVariationId }, data: updatePayload });

      if (data.productVeriationsAttribute !== undefined) {
        await tx.prodcuctVeriationAttributes.deleteMany({ where: { productVeriationsId: productVariationId } });
        if (Array.isArray(data.productVeriationsAttribute) && data.productVeriationsAttribute.length > 0) {
          const attrs = data.productVeriationsAttribute
            .filter(a => a && a.veriationId && a.key && a.value)
            .map(a => ({
              key: a.key.trim(),
              value: a.value.trim(),
              veriationId: a.veriationId,
              productVeriationsId: productVariationId,
            }));
          if (attrs.length > 0) await tx.prodcuctVeriationAttributes.createMany({ data: attrs });
        }
      }

      return updatedVar;
    });

    return updated;
  },

  async deleteProductVariation({ productId, vendorId, productVariationId }) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw createError(404, ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    if (product.vendorId !== vendorId) throw createError(403, ERROR_MESSAGES.PRODUCT_NOT_YOURS);

    const variation = await prisma.productVeriations.findUnique({ where: { id: productVariationId } });
    if (!variation || variation.productId !== productId) {
      throw createError(404, "Product variation not found");
    }

    await prisma.$transaction([
      prisma.prodcuctVeriationAttributes.deleteMany({ where: { productVeriationsId: productVariationId } }),
      prisma.productVeriations.delete({ where: { id: productVariationId } })
    ]);

    return true;
  },

  // Bulk operations
  async bulkUpdateProductStatus({ vendorId, productIds, status }) {
    console.log("🚀 ~ bulkUpdateProductStatus ~ status:", status)
    console.log("🚀 ~ bulkUpdateProductStatus ~ productIds:", productIds)
    console.log("🚀 ~ bulkUpdateProductStatus ~ vendorId:", vendorId)
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw createError(400, "Product IDs array is required");
    }

    if (!Object.values(PRODUCT_STATUS).includes(status)) {
      throw createError(400, ERROR_MESSAGES.INVALID_STATUS);
    }

    // Verify all products belong to the vendor
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        vendorId
      },
      select: { id: true }
    });

    if (products.length !== productIds.length) {
      throw createError(400, "Some products do not belong to you or do not exist");
    }

    const updatedProducts = await prisma.product.updateMany({
      where: {
        id: { in: productIds },
        vendorId
      },
      data: { status }
    });

    return { updatedCount: updatedProducts.count, productIds };
  },

  async bulkToggleProductVisibility({ vendorId, productIds }) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw createError(400, "Product IDs array is required");
    }

    // Verify all products belong to the vendor
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        vendorId
      },
      select: { id: true, isVisible: true }
    });

    if (products.length !== productIds.length) {
      throw createError(400, "Some products do not belong to you or do not exist");
    }

    // Toggle visibility for each product
    const updatePromises = products.map(product => 
      prisma.product.update({
        where: { id: product.id },
        data: { isVisible: !product.isVisible }
      })
    );

    await Promise.all(updatePromises);

    return { updatedCount: products.length, productIds };
  },

  async bulkDeleteProducts({ vendorId, productIds }) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw createError(400, "Product IDs array is required");
    }

    // Verify all products belong to the vendor
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        vendorId
      },
      select: { id: true }
    });

    if (products.length !== productIds.length) {
      throw createError(400, "Some products do not belong to you or do not exist");
    }

    // Delete products in a transaction
    const deletedProducts = await prisma.$transaction(async (tx) => {
      // Delete related data first
      await tx.specification.deleteMany({
        where: { productId: { in: productIds } }
      });

      await tx.prodcuctVeriationAttributes.deleteMany({
        where: { productVeriations: { productId: { in: productIds } } }
      });

      await tx.productVeriations.deleteMany({
        where: { productId: { in: productIds } }
      });

      // Finally delete the products
      return await tx.product.deleteMany({
        where: {
          id: { in: productIds },
          vendorId
        }
      });
    });

    return { deletedCount: deletedProducts.count, productIds };
  },
};

export default productServices;
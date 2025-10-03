import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";
import { validateRequiredFields } from "../utils/validation.js";

const prisma = new PrismaClient();

const ERROR_MESSAGES = {
  VARIATION_EXISTS: "Variation with this name already exists",
  VARIATION_NOT_FOUND: "Variation not found",
  VARIATION_OPTION_NOT_FOUND: "Variation option not found",
};

const variationsServices = {
 async createVariation({ name, type, group, isRequire, order, variationOptions = [] },userId) {
    console.log("🚀 ~ createVariation ~ userId:", userId)
    const fieldsValidation = validateRequiredFields(
      { name, type, group, userId },
      ["name", "type", "group", "userId"]
    );
    if (!fieldsValidation.isValid) {
      throw createError(400, fieldsValidation.message);
    }

    const existingVariation = await prisma.variations.findFirst({
      where: { name: name.trim(), userId },
    });
    if (existingVariation) throw createError(400, ERROR_MESSAGES.VARIATION_EXISTS);

    // Create variation with optional options in a single transaction
    const variation = await prisma.variations.create({
      data: {
        name: name.trim(),
        type: type.trim(),
        group: group.trim(),
        userId,
        isRequire: isRequire?.trim() || "false",
        order: order || 0,
        variationOptions: {
          create: variationOptions.map(opt => ({
            name: opt.name.trim(),
            value: opt.value.trim(),
          })),
        },
      },
      include: { variationOptions: true },
    });

    return variation;
  },


  async getAllVariations({ userId, group, page = 1, limit = 10, search = "" }) {
    const whereClause = { userId };

    if (group) {
      whereClause.group = group;
    }

    if (search) {
      whereClause.name = { contains: search, mode: "insensitive" };
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [variations, total] = await prisma.$transaction([
      prisma.variations.findMany({
        where: whereClause,
        orderBy: { order: "asc" },
        skip,
        take: limit,
        include: { variationOptions: true },
      }),
      prisma.variations.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: variations,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  async getVariation({ id, userId }) {
    const variation = await prisma.variations.findFirst({
      where: { id, userId },
      include: { variationOptions: true },
    });

    if (!variation) {
      throw createError(404, ERROR_MESSAGES.VARIATION_NOT_FOUND);
    }

    return variation;
  },

 // in src/services/variation.services.js
async updateVariation({ id, userId, name, type, group, isRequire, order, options = [], deleteOptionIds = [] }) {
  const existingVariation = await prisma.variations.findFirst({ where: { id, userId } });
  if (!existingVariation) throw createError(404, ERROR_MESSAGES.VARIATION_NOT_FOUND);

  const updateData = {};
  if (name !== undefined) {
    const nameExists = await prisma.variations.findFirst({
      where: { name: name.trim(), userId, id: { not: id } },
    });
    if (nameExists) throw createError(400, ERROR_MESSAGES.VARIATION_EXISTS);
    updateData.name = name.trim();
  }
  if (type !== undefined) updateData.type = type.trim();
  if (group !== undefined) updateData.group = group.trim();
  if (isRequire !== undefined) updateData.isRequire = isRequire.trim();
  if (order !== undefined) updateData.order = order;

  // split options by intent: create vs update
  const createItems = options.filter(o => !o.id).map(o => ({
    name: o.name.trim(),
    value: o.value.trim(),
  }));

  const updateItems = options.filter(o => o.id).map(o => ({
    where: { id: o.id },
    data: {
      name: o.name?.trim(),
      value: o.value?.trim(),
    }
  }));

  const deleteIds = Array.isArray(deleteOptionIds) ? deleteOptionIds : [];

  const updated = await prisma.variations.update({
    where: { id },
    data: {
      ...updateData,
      variationOptions: {
        // delete unwanted
        deleteMany: deleteIds.length ? deleteIds.map(optId => ({ id: optId })) : [],
        // update existing
        update: updateItems,
        // create new
        create: createItems,
      },
    },
    include: { variationOptions: true },
  });

  return updated;
},

  async deleteVariation({ id, userId }) {
  const variation = await prisma.variations.findFirst({
    where: { id, userId },
  });
  if (!variation) throw createError(404, ERROR_MESSAGES.VARIATION_NOT_FOUND);

  // Delete all variation options linked to this variation
  await prisma.variationOptions.deleteMany({ where: { variationId: id } });

  // Then delete the variation
  await prisma.variations.delete({ where: { id } });
  return true;
},

  async updateVariationCategories({ id, userId, categories }) {
    const existingVariation = await prisma.variations.findFirst({
      where: { id, userId },
    });
    
    if (!existingVariation) {
      throw createError(404, ERROR_MESSAGES.VARIATION_NOT_FOUND);
    }

    if (!Array.isArray(categories)) {
      throw createError(400, "Categories must be an array");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const categoryId of categories) {
      if (!uuidRegex.test(categoryId)) {
        throw createError(400, `Invalid category ID format: ${categoryId}`);
      }
    }

    if (categories.length > 0) {
      const existingCategories = await prisma.category.findMany({
        where: {
          id: { in: categories },
          isActive: true
        },
        select: { id: true }
      });

      if (existingCategories.length !== categories.length) {
        throw createError(400, "One or more categories not found or inactive");
      }
    }

    const updatedVariation = await prisma.variations.update({
      where: { id },
      data: { categories },
      include: { variationOptions: true },
    });

    return updatedVariation;
  },

 

};

export default variationsServices;
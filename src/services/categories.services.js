import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";
import { validateRequiredFields, validateCategoryName, generateSlug } from "../utils/validation.js";

const prisma = new PrismaClient();

const ERROR_MESSAGES = {
  CATEGORY_EXISTS: "Category with this name already exists",
  CATEGORY_NOT_FOUND: "Category not found",
};

const categoriesServices = {
  async createCategory({ name, description, commission, image, isActive = true, type="percentage" }) {
    const fieldsValidation = validateRequiredFields({ name, commission }, ["name", "commission"]);
    if (!fieldsValidation.isValid) {
      throw createError(400, fieldsValidation.message);
    }

    const nameValidation = validateCategoryName(name);
    if (!nameValidation.isValid) {
      throw createError(400, nameValidation.message);
    }

    const existingCategory = await prisma.category.findUnique({
      where: { name: name.trim() },
    });
    if (existingCategory) throw createError(400, ERROR_MESSAGES.CATEGORY_EXISTS);

    const baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.category.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        commission,
        slug,
        image,
        isActive,
        type
      },
    });

    return category;
  },

async getAllCategories({ isActive, page = 1, limit = 100, search = "" }) {
  const whereClause = {};

  if (isActive !== undefined) {
    if (typeof isActive === "string") {
      if (isActive.toLowerCase() === "true") whereClause.isActive = true;
      else if (isActive.toLowerCase() === "false") whereClause.isActive = false;
    } else {
      whereClause.isActive = Boolean(isActive);
    }
  }

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;
  const skip = (page - 1) * limit;

  if (search) {
    whereClause.name = { contains: search, mode: "insensitive" };
  }

  const [categories, total] = await prisma.$transaction([
    prisma.category.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.category.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: categories,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
},

async getAllCategoriesWithoutPagination({ isActive, search = "" }) {
  const whereClause = {};

  if (isActive !== undefined) {
    if (typeof isActive === "string") {
      if (isActive.toLowerCase() === "true") whereClause.isActive = true;
      else if (isActive.toLowerCase() === "false") whereClause.isActive = false;
    } else {
      whereClause.isActive = Boolean(isActive);
    }
  }

  if (search) {
    whereClause.name = { contains: search, mode: "insensitive" };
  }

  const categories = await prisma.category.findMany({
    where: whereClause,
    orderBy: { name: "asc" },
  });

  return categories;
},
  async getCategory({ id, includeInactive = false }) {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category || (!includeInactive && !category.isActive)) {
      throw createError(404, ERROR_MESSAGES.CATEGORY_NOT_FOUND);
    }

    return category;
  },

  async updateCategory({ id, name, description, commission, image, isActive }) {
    const existingCategory = await prisma.category.findUnique({ where: { id } });
    if (!existingCategory) throw createError(404, ERROR_MESSAGES.CATEGORY_NOT_FOUND);

    const updateData = {};

    if (name !== undefined) {
      const nameValidation = validateCategoryName(name);
      if (!nameValidation.isValid) throw createError(400, nameValidation.message);

      const nameExists = await prisma.category.findFirst({
        where: { name: name.trim(), id: { not: id } },
      });
      if (nameExists) throw createError(400, ERROR_MESSAGES.CATEGORY_EXISTS);

      updateData.name = name.trim();

      if (name.trim() !== existingCategory.name) {
        const baseSlug = generateSlug(name);
        let slug = baseSlug;
        let counter = 1;
        while (await prisma.category.findFirst({ where: { slug, id: { not: id } } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        updateData.slug = slug;
      }
    }

    if (description !== undefined) updateData.description = description?.trim();
    if (commission !== undefined) updateData.commission = commission;
    if (image !== undefined) updateData.image = image;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    return updatedCategory;
  },

  async deleteCategory({ id }) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw createError(404, ERROR_MESSAGES.CATEGORY_NOT_FOUND);

    await prisma.category.delete({ where: { id } });
    return true;
  },

  async toggleCategoryStatus({ id }) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw createError(404, ERROR_MESSAGES.CATEGORY_NOT_FOUND);

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { isActive: !category.isActive },
    });

    return updatedCategory;
  },
};

export default categoriesServices;

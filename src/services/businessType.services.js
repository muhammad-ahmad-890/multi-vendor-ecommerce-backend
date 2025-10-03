import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const businessTypeServices = {
  async create({ name }) {
    if (!name || !String(name).trim()) {
      throw createError(400, "Name is required");
    }
    const exists = await prisma.businessType.findFirst({
      where: { name: { equals: String(name).trim(), mode: "insensitive" } }
    });
    if (exists) throw createError(400, "Business type already exists");
    return prisma.businessType.create({ data: { name: String(name).trim() } });
  },

  async list({ page = 1, limit = 100, search = "" } = {}) {
    const where = search
      ? { name: { contains: String(search).trim(), mode: "insensitive" } }
      : {};
    const currentPage = Math.max(1, parseInt(page));
    const perPage = Math.max(1, parseInt(limit));
    const skip = (currentPage - 1) * perPage;
    const [items, total] = await prisma.$transaction([
      prisma.businessType.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: perPage }),
      prisma.businessType.count({ where })
    ]);
    return {
      data: items,
      meta: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages: Math.ceil(total / perPage) || 1
      }
    };
  },

  async get(id) {
    if (!id) throw createError(400, "id is required");
    const item = await prisma.businessType.findUnique({ where: { id } });
    if (!item) throw createError(404, "Business type not found");
    return item;
  },

  async update(id, { name }) {
    if (!id) throw createError(400, "id is required");
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    try {
      return await prisma.businessType.update({ where: { id }, data });
    } catch (e) {
      throw createError(404, "Business type not found");
    }
  },

  async remove(id) {
    if (!id) throw createError(400, "id is required");
    try {
      await prisma.businessType.delete({ where: { id } });
      return { success: true };
    } catch (e) {
      throw createError(404, "Business type not found");
    }
  }
};

export default businessTypeServices;



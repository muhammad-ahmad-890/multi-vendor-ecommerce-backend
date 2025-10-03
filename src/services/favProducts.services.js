import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const favProductsServices = {
  async toggleFavorite({ userId, productId }) {
    if (!productId) throw createError(400, "productId is required");

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw createError(404, "Product not found");

    const existing = await prisma.favProducts.findFirst({ where: { userId, productId } });
    if (existing) {
      await prisma.favProducts.delete({ where: { id: existing.id } });
      return { isFav: false };
    }

    await prisma.favProducts.create({ data: { userId, productId } });
    return { isFav: true };
  },

  async getUserFavorites({ userId, page = 1, limit = 10 }) {
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.favProducts.findMany({
        where: { userId },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true, slug: true } },
              vendor: { select: { id: true, storeName: true } },
              warehouse: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.favProducts.count({ where: { userId } })
    ]);

    return {
      data: items.map(i => ({ ...i.product, isFav: true })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
};

export default favProductsServices;



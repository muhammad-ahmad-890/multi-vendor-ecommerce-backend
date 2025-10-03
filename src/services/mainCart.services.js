import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const mainCartServices = {
  async getMyCart({ userId }) {
    const items = await prisma.mainCart.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            vendor: { select: { id: true, storeName: true } },
            warehouse: true,
          }
        },
        selectedVariation: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    return items;
  },

  async addToCart({ userId, productId, quantity = 1, selectedVariationId }) {
    if (!productId) throw createError(400, "productId is required");

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw createError(404, "Product not found");

    if (selectedVariationId) {
      const variation = await prisma.productVeriations.findUnique({ where: { id: selectedVariationId } });
      if (!variation || variation.productId !== productId) {
        throw createError(400, "Invalid variation for this product");
      }
    }

    const existing = await prisma.mainCart.findFirst({
      where: { userId, productId, selectedVariationId: selectedVariationId || null }
    });

    if (existing) {
      const updated = await prisma.mainCart.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + (parseInt(quantity) || 1) }
      });
      return updated;
    }

    const created = await prisma.mainCart.create({
      data: {
        userId,
        productId,
        quantity: parseInt(quantity) || 1,
        selectedVariationId: selectedVariationId || null,
      },
    });

    return created;
  },

  async updateCartItem({ userId, cartItemId, quantity, selectedVariationId }) {
    if (quantity === undefined) throw createError(400, "quantity is required");

    const existing = await prisma.mainCart.findUnique({ where: { id: cartItemId } });
    if (!existing || existing.userId !== userId) throw createError(404, "Cart item not found");

    if (selectedVariationId !== undefined) {
      if (selectedVariationId) {
        const variation = await prisma.productVeriations.findUnique({ where: { id: selectedVariationId } });
        if (!variation || variation.productId !== existing.productId) {
          throw createError(400, "Invalid variation for this product");
        }
      }
    }

    const qty = parseInt(quantity);
    if (isNaN(qty)) throw createError(400, "quantity must be a number");

    if (qty <= 0) {
      await prisma.mainCart.delete({ where: { id: cartItemId } });
      return true;
    }

    const updated = await prisma.mainCart.update({
      where: { id: cartItemId },
      data: {
        quantity: qty,
        selectedVariationId: selectedVariationId !== undefined ? (selectedVariationId || null) : undefined,
      }
    });
    return updated;
  },

  async removeFromCart({ userId, cartItemId }) {
    const existing = await prisma.mainCart.findUnique({ where: { id: cartItemId } });
    if (!existing || existing.userId !== userId) throw createError(404, "Cart item not found");
    await prisma.mainCart.delete({ where: { id: cartItemId } });
    return true;
  },

  async clearCart({ userId }) {
    await prisma.mainCart.deleteMany({ where: { userId } });
    return true;
  }
};

export default mainCartServices;



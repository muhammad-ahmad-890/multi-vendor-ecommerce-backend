import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const orderServices = {
  async createOrder({ vendorId, orderData, userInfo }) {
    // If userId is provided, use existing user
    if (orderData.userId) {
      const order = await prisma.order.create({
        data: {
          ...orderData,
          orderItems: {
            create: orderData.orderItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              productVeriationId: item.productVeriationId || null,
            }))
          },
          shippingAddress: {
            create: orderData.shippingAddress
          },
          billingAddress: {
            create: orderData.billingAddress
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              mobile: true,
            }
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  discountedPrice: true,
                  images: true,
                  productId: true,
                }
              },
              productVeriation: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  sku: true,
                }
              }
            }
          },
          shippingAddress: true,
          billingAddress: true,
        }
      });
      return order;
    }

    // If no userId but userInfo provided, create new customer
    if (userInfo) {
      const newUser = await prisma.user.create({
        data: {
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          email: userInfo.email,
          mobile: userInfo.mobile || orderData.phone,
          role: "CUSTOMER",
          status: "APPROVED",
          isActive: true,
        }
      });

      const order = await prisma.order.create({
        data: {
          ...orderData,
          userId: newUser.id,
          orderItems: {
            create: orderData.orderItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              productVeriationId: item.productVeriationId || null,
            }))
          },
          shippingAddress: {
            create: orderData.shippingAddress
          },
          billingAddress: {
            create: orderData.billingAddress
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              mobile: true,
            }
          },
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  discountedPrice: true,
                  images: true,
                  productId: true,
                }
              },
              productVeriation: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  sku: true,
                }
              }
            }
          },
          shippingAddress: true,
          billingAddress: true,
        }
      });
      return order;
    }

    // If no userId and no userInfo, create order without user
    const order = await prisma.order.create({
      data: {
        ...orderData,
        orderItems: {
          create: orderData.orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            productVeriationId: item.productVeriationId || null,
          }))
        },
        shippingAddress: {
          create: orderData.shippingAddress
        },
        billingAddress: {
          create: orderData.billingAddress
        }
      },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                discountedPrice: true,
                images: true,
                productId: true,
              }
            },
            productVeriation: {
              select: {
                id: true,
                name: true,
                price: true,
                sku: true,
              }
            }
          }
        },
        shippingAddress: true,
        billingAddress: true,
      }
    });
    return order;
  },

  async getVendorOrders({ vendorId, page = 1, limit = 10, status, search, sortBy = "createdAt", sortOrder = "desc", startDate, endDate }) {
    const whereClause = {
      orderItems: {
        some: {
          product: {
            vendorId: vendorId
          }
        }
      }
    };

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              mobile: true,
            }
          },
          orderItems: {
            where: {
              product: {
                vendorId: vendorId
              }
            },
            include: {
            
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  discountedPrice: true,
                  images: true,
                  productId: true,
                  vendorId: true,
                }
              },
              productVeriation: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  sku: true,
                }
              }
            }
          },
          shippingAddress: true,
          billingAddress: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  },

  async getVendorOrder({ orderId, vendorId }) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        orderItems: {
          some: {
            product: {
              vendorId: vendorId
            }
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
            profilePhoto: true,
          }
        },
        orderItems: {
          where: {
            product: {
              vendorId: vendorId
            }
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                discountedPrice: true,
                images: true,
                productId: true,
                vendorId: true,
                description: true,
                brand: true,
                sku: true,
              }
            },
            productVeriation: {
              select: {
                id: true,
                name: true,
                price: true,
                sku: true,
                images: true,
              }
            }
          }
        },
        shippingAddress: true,
        billingAddress: true,
      },
    });

    if (!order) {
      throw createError(404, "Order not found or does not belong to this vendor");
    }

    return order;
  },

  async updateOrderStatus({ orderId, vendorId, status, notes }) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        orderItems: {
          some: {
            product: {
              vendorId: vendorId
            }
          }
        }
      }
    });

    if (!order) {
      throw createError(404, "Order not found or does not belong to this vendor");
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: status,
        notes: notes || null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
          }
        },
        orderItems: {
          where: {
            product: {
              vendorId: vendorId
            }
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                discountedPrice: true,
                images: true,
                productId: true,
              }
            },
            productVeriation: {
              select: {
                id: true,
                name: true,
                price: true,
                sku: true,
              }
            }
          }
        },
        shippingAddress: true,
        billingAddress: true,
      },
    });

    return updatedOrder;
  },

  async getVendorOrderStats({ vendorId, startDate, endDate }) {
    const whereClause = {
      orderItems: {
        some: {
          product: {
            vendorId: vendorId
          }
        }
      }
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const [
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      recentOrders
    ] = await prisma.$transaction([
      prisma.order.count({ where: whereClause }),
      prisma.order.aggregate({
        where: whereClause,
        _sum: { totalAmount: true }
      }),
      prisma.order.count({
        where: { ...whereClause, status: 'PENDING' }
      }),
      prisma.order.count({
        where: { ...whereClause, status: 'DELIVERED' }
      }),
      prisma.order.count({
        where: { ...whereClause, status: 'CANCELLED' }
      }),
      prisma.order.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            }
          },
          orderItems: {
            where: {
              product: {
                vendorId: vendorId
              }
            },
            include: {
              product: {
                select: {
                  name: true,
                  price: true,
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      recentOrders
    };
  }
};

export default orderServices;

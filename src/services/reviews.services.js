import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const reviewsServices = {
  async createReview({ userId, productId, rating, comment, images, purchasedVeriation }) {
    if (!productId || !rating) {
      throw createError(400, "productId and rating are required");
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw createError(404, "Product not found");
    }

  

    const existing = await prisma.reviews.findFirst({ where: { productId, userId } });
    if (existing) {
      throw createError(400, "You have already reviewed this product");
    }

    const created = await prisma.reviews.create({
      data: {
        productId,
        userId,
        rating: parseInt(rating),
        comment: comment || null,
        images: Array.isArray(images) ? images : [],
        purchasedVeriation: purchasedVeriation || null,
      },
    });

    return created;
  },

  async getProductReviews({ productId, page = 1, limit = 10, userId = null, starFilter = null, sortBy = 'latest' }) {
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    // Debug: Log the parameters
    console.log('Service - getProductReviews called with:', { productId, userId, starFilter, sortBy });

    // Debug: Check if reviewImpressions table has data for this user
    if (userId) {
      const testImpression = await prisma.reviewImpressions.findFirst({
        where: { userId },
        include: { review: { select: { productId: true } } }
      });
      console.log('Debug - Found impression for user:', testImpression);
    }

    // Build where clause
    let whereClause = { productId };
    if (starFilter && !isNaN(parseInt(starFilter))) {
      whereClause.rating = parseInt(starFilter);
    }

    // Build orderBy clause
    let orderBy = { createdAt: 'desc' }; // default
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'highest_rating':
        orderBy = { rating: 'desc' };
        break;
      case 'lowest_rating':
        orderBy = { rating: 'asc' };
        break;
      case 'most_impressed':
        orderBy = { impressedCount: 'desc' };
        break;
      case 'least_impressed':
        orderBy = { impressedCount: 'asc' };
        break;
      case 'most_not_impressed':
        orderBy = { notImpressedCount: 'desc' };
        break;
      case 'least_not_impressed':
        orderBy = { notImpressedCount: 'asc' };
        break;
      case 'latest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Build include object based on whether userId is provided
    const includeObject = {
      user: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
      product: { select: { id: true, name: true, images: true } }
    };

    if (userId) {
      includeObject.reviewImpressions = {
        where: { userId },
        select: { isImpressed: true }
      };
    }

    const [items, total, ratingStats] = await prisma.$transaction([
      prisma.reviews.findMany({
        where: whereClause,
        include: includeObject,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.reviews.count({ where: whereClause }),
      // Get rating statistics
      prisma.reviews.groupBy({
        by: ['rating'],
        where: { productId },
        _count: { rating: true },
        _avg: { rating: true }
      })
    ]);

    // Calculate average rating and star breakdown
    const allReviews = await prisma.reviews.findMany({
      where: { productId },
      select: { rating: true, images: true }
    });

    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0 
      ? (allReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews).toFixed(1)
      : 0;

    // Star breakdown
    const starBreakdown = {
      5: allReviews.filter(r => r.rating === 5).length,
      4: allReviews.filter(r => r.rating === 4).length,
      3: allReviews.filter(r => r.rating === 3).length,
      2: allReviews.filter(r => r.rating === 2).length,
      1: allReviews.filter(r => r.rating === 1).length
    };

    // Collect all assets (images) from all reviews
    const allAssets = [];
    allReviews.forEach((review, index) => {
      if (review.images && Array.isArray(review.images) && review.images.length > 0) {
        console.log(`Review ${index + 1} has ${review.images.length} images:`, review.images);
        allAssets.push(...review.images);
      }
    });
    
    // Filter out empty strings but keep duplicates
    const allAssetsFiltered = allAssets.filter(asset => asset && asset.trim() !== '');
    
    // Debug logging for allAssets
    console.log('All assets collected:', {
      totalReviews: allReviews.length,
      totalImages: allAssets.length,
      filteredImages: allAssetsFiltered.length,
      sampleAssets: allAssetsFiltered.slice(0, 5),
      allAssetsRaw: allAssets
    });

    // Add user impression status and purchased variation info to each review
    const reviewsWithImpression = await Promise.all(items.map(async (review) => {
      let userImpression = null;
      let purchasedVariationInfo = null;
      
      // Debug: Log review details
      console.log('Processing review:', {
        reviewId: review.id,
        reviewUserId: review.userId,
        currentUserId: userId,
        hasReviewImpressions: !!review.reviewImpressions,
        reviewImpressionsData: review.reviewImpressions,
        purchasedVeriation: review.purchasedVeriation
      });
      
      if (userId && review.reviewImpressions) {
        if (review.reviewImpressions.length > 0) {
          userImpression = review.reviewImpressions[0].isImpressed;
          console.log('Found user impression:', userImpression);
        } else {
          console.log('No impressions found for this user on this review');
        }
      } else if (userId) {
        console.log('No reviewImpressions field in review data');
      } else {
        console.log('No userId provided');
      }

      // Get purchased variation details if it exists
      if (review.purchasedVeriation) {
        try {
          const variation = await prisma.productVeriations.findUnique({
            where: { id: review.purchasedVeriation },
            select: {
              id: true,
              name: true,
              price: true,
              images: true,
              sku: true
            }
          });
          purchasedVariationInfo = variation;
        } catch (error) {
          console.error('Error fetching purchased variation:', error);
        }
      }
      
      return {
        ...review,
        userImpression,
        purchasedVariationInfo,
        reviewImpressions: undefined // Remove the raw data
      };
    }));

    return {
      data: reviewsWithImpression,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        averageRating: parseFloat(averageRating),
        totalReviews,
        starBreakdown,
        allAssets: allAssetsFiltered
      }
    };
  },

  async getReview({ reviewId, userId = null }) {
    const review = await prisma.reviews.findUnique({
      where: { id: reviewId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        product: { select: { id: true, name: true, images: true } },
        reviewImpressions: userId ? {
          where: { userId },
          select: { isImpressed: true }
        } : false
      }
    });

    if (!review) throw createError(404, "Review not found");
    
    // Add user impression status
    const userImpression = review.reviewImpressions && review.reviewImpressions.length > 0 
      ? review.reviewImpressions[0].isImpressed 
      : null;

    // Get purchased variation details if it exists
    let purchasedVariationInfo = null;
    if (review.purchasedVeriation) {
      try {
        const variation = await prisma.productVeriations.findUnique({
          where: { id: review.purchasedVeriation },
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            sku: true
          }
        });
        purchasedVariationInfo = variation;
      } catch (error) {
        console.error('Error fetching purchased variation:', error);
      }
    }
    
    return {
      ...review,
      userImpression,
      purchasedVariationInfo,
      reviewImpressions: undefined // Remove the raw data
    };
  },

  async getUserReviews({ userId, page = 1, limit = 10 }) {
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.reviews.findMany({
        where: { userId },
        include: {
          product: { select: { id: true, name: true, images: true, slug: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.reviews.count({ where: { userId } })
    ]);

    // Add purchased variation info to each review
    const reviewsWithVariationInfo = await Promise.all(items.map(async (review) => {
      let purchasedVariationInfo = null;
      
      if (review.purchasedVeriation) {
        try {
          const variation = await prisma.productVeriations.findUnique({
            where: { id: review.purchasedVeriation },
            select: {
              id: true,
              name: true,
              price: true,
              images: true,
              sku: true
            }
          });
          purchasedVariationInfo = variation;
        } catch (error) {
          console.error('Error fetching purchased variation:', error);
        }
      }
      
      return {
        ...review,
        purchasedVariationInfo
      };
    }));

    return {
      data: reviewsWithVariationInfo,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  async updateReview({ reviewId, userId, rating, comment, images, purchasedVeriation }) {
    const existing = await prisma.reviews.findUnique({ where: { id: reviewId } });
    if (!existing) throw createError(404, "Review not found");
    if (existing.userId !== userId) throw createError(403, "You can update only your review");


    const updated = await prisma.reviews.update({
      where: { id: reviewId },
      data: {
        rating: rating !== undefined ? parseInt(rating) : undefined,
        comment: comment !== undefined ? (comment || null) : undefined,
        images: images !== undefined ? (Array.isArray(images) ? images : []) : undefined,
        purchasedVeriation: purchasedVeriation !== undefined ? (purchasedVeriation || null) : undefined,
      }
    });

    return updated;
  },

  async deleteReview({ reviewId, userId }) {
    const existing = await prisma.reviews.findUnique({ where: { id: reviewId } });
    if (!existing) throw createError(404, "Review not found");
    if (existing.userId !== userId) throw createError(403, "You can delete only your review");

    await prisma.reviews.delete({ where: { id: reviewId } });
    return true;
  },

  async toggleImpression({ reviewId, userId, isImpressed }) {
    if (!reviewId || !userId || isImpressed === undefined) {
      throw createError(400, "reviewId, userId, and isImpressed are required");
    }

    const review = await prisma.reviews.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw createError(404, "Review not found");
    }

    // Check if user has already impressed/unimpressed this review
    const existingImpression = await prisma.reviewImpressions.findUnique({
      where: { reviewId_userId: { reviewId, userId } }
    });

    let result;
    let action;

    if (existingImpression) {
      // If user has already impressed/unimpressed, check if it's the same action
      if (existingImpression.isImpressed === isImpressed) {
        // Same action - remove the impression (toggle off)
        await prisma.reviewImpressions.delete({
          where: { reviewId_userId: { reviewId, userId } }
        });

        // Update counts
        const updateData = isImpressed 
          ? { impressedCount: { decrement: 1 } }
          : { notImpressedCount: { decrement: 1 } };

        await prisma.reviews.update({
          where: { id: reviewId },
          data: updateData
        });

        action = isImpressed ? "unimpressed" : "unnot-impressed";
        result = { isImpressed: null, action };
      } else {
        // Different action - update the impression
        await prisma.reviewImpressions.update({
          where: { reviewId_userId: { reviewId, userId } },
          data: { isImpressed }
        });

        // Update counts - decrement old, increment new
        const updateData = isImpressed
          ? { 
              impressedCount: { increment: 1 },
              notImpressedCount: { decrement: 1 }
            }
          : { 
              impressedCount: { decrement: 1 },
              notImpressedCount: { increment: 1 }
            };

        await prisma.reviews.update({
          where: { id: reviewId },
          data: updateData
        });

        action = isImpressed ? "impressed" : "not-impressed";
        result = { isImpressed, action };
      }
    } else {
      // No existing impression - create new one
      await prisma.reviewImpressions.create({
        data: { reviewId, userId, isImpressed }
      });

      // Update counts
      const updateData = isImpressed 
        ? { impressedCount: { increment: 1 } }
        : { notImpressedCount: { increment: 1 } };

      await prisma.reviews.update({
        where: { id: reviewId },
        data: updateData
      });

      action = isImpressed ? "impressed" : "not-impressed";
      result = { isImpressed, action };
    }

    // Get updated review with counts
    const updatedReview = await prisma.reviews.findUnique({
      where: { id: reviewId },
      select: { 
        id: true, 
        impressedCount: true, 
        notImpressedCount: true 
      }
    });

    return {
      ...result,
      counts: {
        impressed: updatedReview.impressedCount,
        notImpressed: updatedReview.notImpressedCount
      }
    };
  },

  async getUserImpression({ reviewId, userId }) {
    const impression = await prisma.reviewImpressions.findUnique({
      where: { reviewId_userId: { reviewId, userId } }
    });

    return impression ? impression.isImpressed : null;
  },
};

export default reviewsServices;



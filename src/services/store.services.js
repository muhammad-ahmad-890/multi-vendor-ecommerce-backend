import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import createError from "http-errors";

const prisma = new PrismaClient();

const storeServices = {
	// Validate store username format and length
	validateUserName(userName) {
		if (!userName || typeof userName !== "string") {
			throw createError(400, "Username is required");
		}
		const normalized = userName.trim().toLowerCase();
		if (normalized.length < 3 || normalized.length > 30) {
			throw createError(400, "Username must be between 3 and 30 characters");
		}
		// allow lowercase letters, numbers, hyphens and underscores, no consecutive separators, no leading/trailing separators
		const validPattern = /^(?![-_])(?!.*[-_]{2})[a-z0-9_-]+(?<![-_])$/;
		if (!validPattern.test(normalized)) {
			throw createError(400, "Username can contain lowercase letters, numbers, hyphens, or underscores without consecutive or trailing separators");
		}
		return normalized;
	},

	// Check if username is available (optionally excluding vendor's own current store)
	async checkUserNameAvailability({ userName, vendorId }) {
		const normalized = this.validateUserName(userName);

		let excludeStoreId = null;
		if (vendorId) {
			const myStore = await prisma.store.findFirst({ where: { vendorId } });
			excludeStoreId = myStore?.id || null;
		}

		const existing = await prisma.store.findFirst({
			where: {
				userName: normalized,
				...(excludeStoreId ? { id: { not: excludeStoreId } } : {})
			}
		});

		return { available: !existing, userName: normalized };
	},

	// Create store - only vendors can create, one store per vendor
	async createStore(storeData) {
		const { vendorId, storeName, userName, returnPolicy, shippingDay, street, city, state, country, pinCode, coverImage, profileImage } = storeData;

		const vendor = await prisma.user.findUnique({
			where: { id: vendorId },
			select: { id: true, role: true }
		});

		if (!vendor) {
			throw createError(404, "Vendor not found");
		}

		if (vendor.role !== "VENDOR") {
			throw createError(403, "Only vendors can create stores");
		}

		const existingStore = await prisma.store.findFirst({
			where: { vendorId }
		});

		if (existingStore) {
			throw createError(400, "Vendor can only have one store");
		}

		// Normalize and validate username
		const normalizedUserName = this.validateUserName(userName);

		// Check if store name is already taken
		const existingStoreName = await prisma.store.findFirst({
			where: { storeName: storeName.trim() }
		});

		if (existingStoreName) {
			throw createError(400, "Store name already taken");
		}

		// Check if username is already taken
		const existingUserName = await prisma.store.findFirst({
			where: { userName: normalizedUserName }
		});

		if (existingUserName) {
			throw createError(400, "Username already taken");
		}

		// Create store
		const store = await prisma.store.create({
			data: {
				vendorId,
				storeName: storeName.trim(),
				userName: normalizedUserName,
				returnPolicy: returnPolicy?.trim() || null,
				shippingDay: shippingDay || null,
				street: street?.trim() || null,
				city: city?.trim() || null,
				state: state?.trim() || null,
				country: country?.trim() || null,
				pinCode: pinCode?.trim(),
				coverImage: coverImage || null,
				profileImage: profileImage || null,
				isVerified: false
			},
			include: {
				vendor: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						mobile: true
					}
				}
			}
		});

		return store;
	},

	// Get store by ID
	async getStore(storeId) {
		const store = await prisma.store.findUnique({
			where: { id: storeId },
			include: {
				vendor: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						mobile: true,
						city: true,
						state: true
					}
				}
			}
		});

		if (!store) {
			throw createError(404, "Store not found");
		}

		return store;
	},

	// Get store by ID with products (for public viewing)
	async getStoreWithProducts(storeId, userId = null) {
		const store = await prisma.store.findUnique({
			where: { id: storeId },
			include: {
				vendor: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						mobile: true,
						city: true,
						state: true
					}
				}
			}
		});

		if (!store) {
			throw createError(404, "Store not found");
		}

		console.log(`Store found: ${store.storeName}, vendorId: ${store.vendorId}, isVerified: ${store.isVerified}`);

		// Get products for this store's vendor
		const products = await prisma.product.findMany({
			where: {
				vendorId: store.vendorId,
			},
			select: {
				id: true,
				name: true,
				description: true,
				price: true,
				discountedPrice: true,
				images: true,
				slug: true,
				stock: true,
				createdAt: true
			},
			orderBy: {
				createdAt: 'desc'
			},
			take: 20 // Limit to 20 most recent products
		});

		console.log(`Found ${products.length} products for store ${storeId}, vendor ${store.vendorId}`);

		// Get reviews for all products of this store
		const productIds = products.map(p => p.id);
		let reviews = [];
		let averageRating = 0;
		let totalReviews = 0;

		if (productIds.length > 0) {
			reviews = await prisma.reviews.findMany({
				where: {
					productId: { in: productIds }
				},
				include: {
					user: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							profilePhoto: true
						}
					},
					product: {
						select: {
							id: true,
							name: true,
							images: true
						}
					}
				},
				orderBy: {
					createdAt: 'desc'
				}
			});

			// Calculate average rating
			const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
			averageRating = reviews.length > 0 ? (totalRating / reviews.length) : 0;
			totalReviews = reviews.length;
		}

		// Check if current user is following this store
		let isFollowing = false;
		if (userId) {
			const followRecord = await prisma.follow.findFirst({
				where: {
					followerId: userId,
					storeId: storeId
				}
			});
			isFollowing = !!followRecord;
		}

		// Get followers count
		const followersCount = await prisma.follow.count({
			where: { storeId: storeId }
		});

		// Get following count (how many entities this store is following)
		const followingCount = await prisma.following.count({
			where: { storeId: storeId }
		});

		// Get recent followers with basic user info
		const followers = await prisma.follow.findMany({
			where: { storeId: storeId },
			include: {
				user: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						profilePhoto: true
					}
				}
			},
			orderBy: { createdAt: 'desc' },
			take: 20
		});

		// Enrich products with rating (avg & count) and isFav
		const productsWithMeta = await Promise.all(products.map(async (p) => {
			const agg = await prisma.reviews.aggregate({
				where: { productId: p.id },
				_avg: { rating: true },
				_count: { rating: true }
			});

			let isFav = false;
			if (userId) {
				const fav = await prisma.favProducts.findFirst({ where: { userId, productId: p.id } });
				isFav = !!fav;
			}

			return {
				...p,
				rating: agg._avg.rating || 0,
				ratingCount: agg._count.rating || 0,
				isFav
			};
		}));

		// Return store with products, reviews, and follow info
		return {
			...store,
			products: productsWithMeta,
			reviews,
			averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
			totalReviews: totalReviews,
			followersCount: followersCount,
			followingCount: followingCount,
			followers: followers.map(f => ({
				id: f.id,
				user: f.user,
				createdAt: f.createdAt
			})),
			isFollowing
		};
	},

	// Get all products for a store with filters, meta, and user flags
	async getStoreProducts(storeId, { page = 1, limit = 12, search, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc', inStock, hasDiscount }, userId = null) {
		// Resolve vendorId for this store
		const store = await prisma.store.findUnique({
			where: { id: storeId },
			select: { id: true, vendorId: true, isVerified: true }
		});

		if (!store) {
			throw createError(404, 'Store not found');
		}

		// Build where clause scoped to vendor
		const whereClause = { vendorId: store.vendorId };

		if (search) {
			whereClause.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
				{ tags: { has: search } }
			];
		}

		if (minPrice || maxPrice) {
			whereClause.price = {};
			if (minPrice) whereClause.price.gte = parseFloat(minPrice);
			if (maxPrice) whereClause.price.lte = parseFloat(maxPrice);
		}

		if (inStock !== undefined) {
			// Treat any truthy value as in stock > 0
			if (String(inStock) === 'true') {
				whereClause.stock = { gt: 0 };
			} else if (String(inStock) === 'false') {
				whereClause.stock = 0;
			}
		}

		if (hasDiscount !== undefined) {
			if (String(hasDiscount) === 'true') {
				whereClause.discountedPrice = { not: null };
			} else if (String(hasDiscount) === 'false') {
				whereClause.discountedPrice = null;
			}
		}

		page = parseInt(page) || 1;
		limit = parseInt(limit) || 12;
		const skip = (page - 1) * limit;

		// Map sort fields
		let orderBy = { createdAt: sortOrder };
		switch (sortBy) {
			case 'price':
				orderBy = { price: sortOrder };
				break;
			case 'discountedPrice':
				orderBy = { discountedPrice: sortOrder };
				break;
			case 'createdAt':
			default:
				orderBy = { createdAt: sortOrder };
		}

		const [products, total] = await prisma.$transaction([
			prisma.product.findMany({
				where: whereClause,
				select: {
					id: true,
					name: true,
					description: true,
					price: true,
					discountedPrice: true,
					images: true,
					slug: true,
					stock: true,
					createdAt: true
				},
				orderBy,
				skip,
				take: limit
			}),
			prisma.product.count({ where: whereClause })
		]);

		// Enrich with rating and isFav
		const productsWithMeta = await Promise.all(products.map(async (p) => {
			const agg = await prisma.reviews.aggregate({
				where: { productId: p.id },
				_avg: { rating: true },
				_count: { rating: true }
			});

			let isFav = false;
			if (userId) {
				const fav = await prisma.favProducts.findFirst({ where: { userId, productId: p.id } });
				isFav = !!fav;
			}

			return {
				...p,
				rating: agg._avg.rating || 0,
				ratingCount: agg._count.rating || 0,
				isFav
			};
		}));

		const totalPages = Math.ceil(total / limit);

		return {
			data: productsWithMeta,
			meta: {
				total,
				page,
				limit,
				totalPages
			}
		};
	},

	// Follow/Unfollow store
	async toggleFollowStore(followerId, storeId) {
		// Check if store exists
		const store = await prisma.store.findUnique({
			where: { id: storeId }
		});

		if (!store) {
			throw createError(404, "Store not found");
		}

		// Check if user is trying to follow their own store
		if (store.vendorId === followerId) {
			throw createError(400, "Cannot follow your own store");
		}

		// Check if already following
		const existingFollow = await prisma.follow.findFirst({
			where: {
				followerId: followerId,
				storeId: storeId
			}
		});

		if (existingFollow) {
			// Unfollow
			await prisma.follow.delete({
				where: { id: existingFollow.id }
			});

			// Get updated followers count
			const followersCount = await prisma.follow.count({
				where: { storeId: storeId }
			});

			return {
				isFollowing: false,
				followersCount,
				message: "Unfollowed store successfully"
			};
		} else {
			// Follow
			await prisma.follow.create({
				data: {
					followerId: followerId,
					storeId: storeId,
					userId: followerId // This seems to be a duplicate field in schema
				}
			});

			// Get updated followers count
			const followersCount = await prisma.follow.count({
				where: { storeId: storeId }
			});

			return {
				isFollowing: true,
				followersCount,
				message: "Followed store successfully"
			};
		}
	},

	// Get store reviews with filters
	async getStoreReviews(storeId, filters = {}) {
		const {
			rating = null,
			sortBy = 'createdAt',
			sortOrder = 'desc',
			page = 1,
			limit = 10,
			mostImpressed = false
		} = filters;

		// Get store's products first
		const store = await prisma.store.findUnique({
			where: { id: storeId },
			select: { vendorId: true }
		});

		if (!store) {
			throw createError(404, "Store not found");
		}

		const products = await prisma.product.findMany({
			where: {
				vendorId: store.vendorId
			},
			select: { id: true }
		});

		const productIds = products.map(p => p.id);

		// Build where clause
		const whereClause = {
			productId: { in: productIds }
		};

		if (rating !== null) {
			whereClause.rating = rating;
		}

		// Build orderBy clause
		let orderBy = {};
		if (mostImpressed) {
			orderBy = { impressedCount: 'desc' };
		} else {
			orderBy = { [sortBy]: sortOrder };
		}

		// Calculate pagination
		const skip = (page - 1) * limit;

		// Get reviews
		const reviews = await prisma.reviews.findMany({
			where: whereClause,
			include: {
				user: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						profilePhoto: true
					}
				},
				product: {
					select: {
						id: true,
						name: true,
						images: true
					}
				}
			},
			orderBy: orderBy,
			skip: skip,
			take: parseInt(limit)
		});

		// Get total count for pagination
		const totalReviews = await prisma.reviews.count({
			where: whereClause
		});

		// Calculate average rating
		const allReviews = await prisma.reviews.findMany({
			where: { productId: { in: productIds } },
			select: { rating: true }
		});

		const totalRating = allReviews.reduce((sum, review) => sum + review.rating, 0);
		const averageRating = allReviews.length > 0 ? (totalRating / allReviews.length) : 0;

		// Get rating distribution
		const ratingDistribution = {};
		for (let i = 1; i <= 5; i++) {
			ratingDistribution[i] = allReviews.filter(r => r.rating === i).length;
		}

		return {
			reviews,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total: totalReviews,
				pages: Math.ceil(totalReviews / limit)
			},
			stats: {
				averageRating: Math.round(averageRating * 10) / 10,
				totalReviews: allReviews.length,
				ratingDistribution
			}
		};
	},

	// Get store by vendor ID
	async getStoreByVendor(vendorId) {
		const store = await prisma.store.findFirst({
			where: { vendorId },
			include: {
				vendor: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						mobile: true,
						city: true,
						state: true
					}
				}
			}
		});

		if (!store) {
			throw createError(404, "Store not found for this vendor");
		}

		return store;
	},

	// Update store - only store owner can update
	async updateStore(storeId, vendorId, updateData) {
		// Check if store exists and belongs to vendor
		const existingStore = await prisma.store.findUnique({
			where: { id: storeId }
		});

		if (!existingStore) {
			throw createError(404, "Store not found");
		}

		if (existingStore.vendorId !== vendorId) {
			throw createError(403, "You can only update your own store");
		}

		// Check if new store name is already taken (if updating)
		if (updateData.storeName && updateData.storeName.trim() !== existingStore.storeName) {
			const existingStoreName = await prisma.store.findFirst({
				where: {
					storeName: updateData.storeName.trim(),
					id: { not: storeId }
				}
			});

			if (existingStoreName) {
				throw createError(400, "Store name already taken");
			}
		}

		// Check if new username is already taken (if updating)
		let normalizedUserName = undefined;
		if (updateData.userName) {
			normalizedUserName = this.validateUserName(updateData.userName);
			if (normalizedUserName !== existingStore.userName) {
				const existingUserName = await prisma.store.findFirst({
					where: {
						userName: normalizedUserName,
						id: { not: storeId }
					}
				});
				if (existingUserName) {
					throw createError(400, "Username already taken");
				}
			}
		}

		// Update store
		const updatedStore = await prisma.store.update({
			where: { id: storeId },
			data: {
				storeName: updateData.storeName?.trim(),
				userName: normalizedUserName ?? undefined,
				returnPolicy: updateData.returnPolicy?.trim(),
				shippingDay: updateData.shippingDay,
				street: updateData.street?.trim(),
				city: updateData.city?.trim(),
				state: updateData.state?.trim(),
				country: updateData.country?.trim(),
				pinCode: updateData.pinCode?.trim(),
				coverImage: updateData.coverImage,
				profileImage: updateData.profileImage
			},
			include: {
				vendor: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						mobile: true
					}
				}
			}
		});

		return updatedStore;
	},

	// Delete store - only store owner can delete
	async deleteStore(storeId, vendorId) {
		// Check if store exists and belongs to vendor
		const existingStore = await prisma.store.findUnique({
			where: { id: storeId }
		});

		if (!existingStore) {
			throw createError(404, "Store not found");
		}

		if (existingStore.vendorId !== vendorId) {
			throw createError(403, "You can only delete your own store");
		}

		// Check if store has products
		const productCount = await prisma.product.count({
			where: { vendorId }
		});

		if (productCount > 0) {
			throw createError(400, "Cannot delete store with existing products. Please remove all products first.");
		}

		await prisma.store.delete({
			where: { id: storeId }
		});

		return { message: "Store deleted successfully" };
	},

	// Get all stores (for admin)
	async getAllStores({ page = 1, limit = 10, status, search, sortBy = "createdAt", sortOrder = "desc" }) {
		const whereClause = {};

		if (status) {
			whereClause.isVerified = status === "verified";
		}

		if (search) {
			whereClause.OR = [
				{ storeName: { contains: search, mode: "insensitive" } },
				{ userName: { contains: search, mode: "insensitive" } },
				{ vendor: {
					OR: [
						{ firstName: { contains: search, mode: "insensitive" } },
						{ lastName: { contains: search, mode: "insensitive" } },
						{ email: { contains: search, mode: "insensitive" } }
					]
				}}
			];
		}

		page = parseInt(page) || 1;
		limit = parseInt(limit) || 10;
		const skip = (page - 1) * limit;

		const [stores, total] = await prisma.$transaction([
			prisma.store.findMany({
				where: whereClause,
				include: {
					vendor: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							mobile: true
						}
					}
				},
				orderBy: { [sortBy]: sortOrder },
				skip,
				take: limit,
			}),
			prisma.store.count({ where: whereClause }),
		]);

		const totalPages = Math.ceil(total / limit);

		return {
			data: stores,
			meta: {
				total,
				page,
				limit,
				totalPages,
			},
		};
	},

	// Toggle store verification (admin only)
	async toggleStoreVerification(storeId, adminId) {
		// Check if admin exists and is admin
		const admin = await prisma.user.findUnique({
			where: { id: adminId },
			select: { id: true, role: true }
		});

		if (!admin || admin.role !== "ADMIN") {
			throw createError(403, "Only admins can verify stores");
		}

		// Check if store exists
		const store = await prisma.store.findUnique({
			where: { id: storeId }
		});

		if (!store) {
			throw createError(404, "Store not found");
		}

		// Toggle verification status
		const updatedStore = await prisma.store.update({
			where: { id: storeId },
			data: { isVerified: !store.isVerified },
			include: {
				vendor: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true
					}
				}
			}
		});

		return updatedStore;
	},

	// Get verified stores (public)
	async getVerifiedStores({ page = 1, limit = 10, search, sortBy = "createdAt", sortOrder = "desc" }) {
		const whereClause = {
			isVerified: true,
		};

		if (search) {
			whereClause.OR = [
				{ storeName: { contains: search, mode: "insensitive" } },
				{ userName: { contains: search, mode: "insensitive" } },
				{ vendor: {
					OR: [
						{ firstName: { contains: search, mode: "insensitive" } },
						{ lastName: { contains: search, mode: "insensitive" } }
					]
				}}
			];
		}

		page = parseInt(page) || 1;
		limit = parseInt(limit) || 10;
		const skip = (page - 1) * limit;

		const [stores, total] = await prisma.$transaction([
			prisma.store.findMany({
				where: whereClause,
				include: {
					vendor: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							city: true,
							state: true
						}
					}
				},
				orderBy: { [sortBy]: sortOrder },
				skip,
				take: limit,
			}),
			prisma.store.count({ where: whereClause }),
		]);

		const totalPages = Math.ceil(total / limit);

		return {
			data: stores,
			meta: {
				total,
				page,
				limit,
				totalPages,
			},
		};
	},

	// Get shipping type for a vendor's store
	async getShippingType(vendorId) {
		const store = await prisma.store.findFirst({
			where: { vendorId },
			select: {
				id: true,
				storeName: true,
				shippingType: true
			}
		});

		if (!store) {
			throw createError(404, "Store not found");
		}

		return {
			storeId: store.id,
			storeName: store.storeName,
			shippingType: store.shippingType
		};
	},

	// Update shipping type for a vendor's store
	async updateShippingType(vendorId, shippingType) {
		// Validate shipping type
		const validTypes = ["manual", "automatic"];
		if (!validTypes.includes(shippingType)) {
			throw createError(400, "Invalid shipping type. Must be 'manual' or 'automatic'");
		}

		const store = await prisma.store.findFirst({
			where: { vendorId }
		});

		if (!store) {
			throw createError(404, "Store not found");
		}

		const updatedStore = await prisma.store.update({
			where: { id: store.id },
			data: {
				shippingType: shippingType
			},
			select: {
				id: true,
				storeName: true,
				shippingType: true,
				updatedAt: true
			}
		});

		return updatedStore;
	}
};

export default storeServices;

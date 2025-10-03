import express from "express";
import { assignHTTPError, errorResponder, invalidPathHandler } from "../middleware/error.middleware.js";
import adminRouter from "./admin.routes.js";
import userRouter from "./user.routes.js";
import vendorRouter from "./vendor.routes.js";
import customerRouter from "./customer.routes.js";

const router = express.Router();

router.use('/admin', adminRouter)
router.use('/user', userRouter)
router.use('/vendor', vendorRouter)
router.use('/customer', customerRouter)


router.use(assignHTTPError);
router.use(errorResponder);
router.use(invalidPathHandler);

export default router;
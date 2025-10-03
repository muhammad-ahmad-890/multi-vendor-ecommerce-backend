
import express from "express";
import multer from "multer";
import { errorHandler } from "../handlers/error.handler.js";
import { authGuard } from "../middleware/auth.middleware.js"
import uploadController from "../controller/upload.controller.js";
import productController from "../controller/product.controller.js";
const userRouter = express.Router()
const upload = multer({
    limits: { fileSize: 100 * 1024 * 1024 },
});


userRouter.post("/upload", authGuard("all"), upload.single("file"), errorHandler(uploadController.uploadImage));
userRouter.post("/upload/document", authGuard("all"), upload.single("file"), errorHandler(uploadController.uploadDocument));
userRouter.post("/upload/multiple", authGuard("all"), upload.array("files"), errorHandler(uploadController.uploadMultipleFiles));

export default userRouter;
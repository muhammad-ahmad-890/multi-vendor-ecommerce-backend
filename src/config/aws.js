import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3Config = {
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

const s3Client = new S3Client(s3Config);

export const AWS_CONFIG = {
  bucket: process.env.AWS_S3_BUCKET_NAME,
  region: process.env.AWS_REGION || "us-east-1",
  profilePhotosPath: "vendor-profiles/",
  coverPhotosPath: "vendor-covers/",
  allowedFileTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  maxFileSize: 5 * 1024 * 1024, // 5MB
};

export default s3Client;

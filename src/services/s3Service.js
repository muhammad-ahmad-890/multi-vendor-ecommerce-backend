import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3Client, { AWS_CONFIG } from "../config/aws.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";

export async function uploadToS3(fileBuffer, fileName, fileType, folderPath) {
  try {
    if (!AWS_CONFIG.allowedFileTypes.includes(fileType)) {
      throw new Error(
        `Invalid file type. Allowed types: ${AWS_CONFIG.allowedFileTypes.join(
          ", "
        )}`
      );
    }

    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const s3Key = `${folderPath}${uniqueFileName}`;

    const uploadParams = {
      Bucket: AWS_CONFIG.bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: fileType,
      ACL: "public-read",
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    const fileUrl = `https://${AWS_CONFIG.bucket}.s3.${AWS_CONFIG.region}.amazonaws.com/${s3Key}`;

    return {
      success: true,
      fileUrl,
      fileName: uniqueFileName,
      s3Key,
      message: "File uploaded successfully",
    };
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw new Error(`File upload failed: ${error.message}`);
  }
}

export async function deleteFromS3(s3Key) {
  try {
    const deleteParams = {
      Bucket: AWS_CONFIG.bucket,
      Key: s3Key,
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);

    return {
      success: true,
      message: "File deleted successfully",
    };
  } catch (error) {
    console.error("S3 Delete Error:", error);
    throw new Error(`File deletion failed: ${error.message}`);
  }
}

export async function getPresignedUrl(s3Key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: AWS_CONFIG.bucket,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error("Presigned URL Error:", error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

export async function uploadVendorProfilePhoto(fileBuffer, fileName, fileType) {
  return await uploadToS3(
    fileBuffer,
    fileName,
    fileType,
    AWS_CONFIG.profilePhotosPath
  );
}

export async function uploadVendorCoverPhoto(fileBuffer, fileName, fileType) {
  return await uploadToS3(
    fileBuffer,
    fileName,
    fileType,
    AWS_CONFIG.coverPhotosPath
  );
}

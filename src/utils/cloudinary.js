import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadPhotoOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        // Upload the file cloudinary
        const uploadResult = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto',
            folder: "FZtube/photos",
        })
        // console.log(`File ${localFilePath} have been uploaded successfully! Public cloudinary URL: ${uploadResult.url}`)
        fs.unlinkSync(localFilePath)  // Successful upload: File is deleted because it’s no longer needed locally
        // console.log("Cloudinary Response ->", uploadResult)
        return uploadResult
    } catch {
        fs.unlinkSync(localFilePath)  // Unsuccessful upload: File is deleted to avoid clutter, even though the upload failed. This approach ensures effective resource management and avoids filling up disk space unnecessarily.
        return null
    }
}


const extractPublicIdFromCloudinaryUrl = (url) => {
    if (!url) return null;  // Ensure URL is valid
    try {
        const parts = url.split('/');
        const publicIdWithExtension = parts[parts.length - 1];  // Get the last part of the URL
        const publicId = publicIdWithExtension.split('.')[0];    // Extract the public ID
        return publicId;
    } catch (error) {
        console.error("Error while extracting public ID:", error);
        return null;
    }
}

const deleteImageFromCloudinary = async (publicId) => {
    if (!publicId) return null;  // Ensure public ID is valid
    try {
        const result = await cloudinary.uploader.destroy(
            `FZtube/photos/${publicId}`, 
            {
            resource_type: "image",
            }
        );  // Use destroy method
        console.log(`File with public ID ${publicId} has been deleted from Cloudinary.`);
        return result;
    } catch (error) {
        console.error("Failed to delete from Cloudinary:", error);
        throw new ApiError(500, "Error while deleting from Cloudinary");
    }
};

export {
    uploadPhotoOnCloudinary,
    extractPublicIdFromCloudinaryUrl,
    deleteImageFromCloudinary
}
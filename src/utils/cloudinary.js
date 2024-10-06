import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        // Upload the file cloudinary
        const uploadResult = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto',
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


export { uploadOnCloudinary }
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        // Upload the file cloudinary
        const uploadResult = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto',
        })
        console.log(`File ${localFilePath} have been uploaded successfully! Public cloudinary URL: ${uploadResult.url}`)
        return uploadResult
    } catch {
        fs.unlinkSync(localFilePath)  // remove the locally saved temperary file as the upload operation got failed
        return null
    }
}


export { uploadOnCloudinary }
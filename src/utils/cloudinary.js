import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { ApiError } from "./ApiError.js"

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
        console.log(`Image with public ID ${publicId} has been deleted from Cloudinary.`);
        return result;
    } catch (error) {
        console.error("Failed to delete image from Cloudinary:", error);
        throw new ApiError(500, "Error while deleting image from Cloudinary");
    }
};


const uploadVideoOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        console.log("uploading video...");

        // Upload the file cloudinary
        // upload -> supports uploading of file upto 100MB
        // const uploadResult = await cloudinary.uploader.upload(localFilePath, {
        //     resource_type: 'video',
        //     folder: "FZtube/videos"
        // })
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_large(localFilePath, {
                resource_type: 'video',
                folder: "FZtube/videos",
                chunk_size: 6000000, // 6MB chunks
                timeout: 600000, // Increased timeout to 10 minutes
            }, (error, result) => {
                if (error) {
                    console.log("CLOUDINARY :: FILE UPLOAD ERROR ", error.message)
                    reject(error)
                } else {
                    // console.log("> Result:", result.secure_url)
                    resolve(result)
                    // console.log("cloudinary video file", result);
                }

            })
        }
        )
        // console.log("Cloudinary Response after uploading a video ->", uploadResult)
        fs.unlinkSync(localFilePath, (unlinkError) => {
            if (unlinkError) console.log("Error deleting local file:", unlinkError);
        })
        return uploadResult
    } catch {
        console.log("CLOUDINARY :: FILE UPLOAD ERROR ", error);
        fs.unlinkSync(localFilePath)
        return null
    }
}

// const uploadVideoOnCloudinary = async (localFilePath) => {
//     try {
//       if (!localFilePath) return null;

//       console.log("uploading video...");

//       return new Promise((resolve, reject) => {
//         cloudinary.uploader.upload_large(localFilePath, {
//           resource_type: "video",
//           folder: "FZtube/videos",
//           chunk_size: 6000000, // 6MB chunks
//           eager: [
//             {
//               streaming_profile: "hd",
//               format: "m3u8", // HLS format
//             },
//           ],
//           timeout: 600000, // Increased timeout to 10 minutes
//         }, (error, result) => {
//           if (error) {
//             console.log("CLOUDINARY :: FILE UPLOAD ERROR ", error.message);
//             reject(error);
//           } else {
//             console.log("cloudinary video file", result);

//             const hlsurl = result.eager?.[0]?.secure_url;

//             if (!hlsurl) {
//               console.log("HLS URL not found in Cloudinary response");
//               reject(new Error("HLS URL not generated"));
//             } else {
//               resolve({ ...result, hlsurl });
//             }
//           }

//           // Clean up local file after upload attempt
//           fs.unlink(localFilePath, (unlinkError) => {
//             if (unlinkError) console.log("Error deleting local file:", unlinkError);
//           });
//         });
//       });
//     } catch (error) {
//       console.log("CLOUDINARY :: FILE UPLOAD ERROR ", error);
//       return null;
//     }
//   };

const deleteVideoFromCloudinary = async (publicId) => {
    if (!publicId) return null;  // Ensure public ID is valid
    try {
        const result = await cloudinary.uploader.destroy(
            `FZtube/videos/${publicId}`,
            {
                resource_type: "video",
            }
        );  // Use destroy method
        console.log(`Video with public ID ${publicId} has been deleted from Cloudinary.`);
        return result;
    } catch (error) {
        console.error("Failed to delete video from Cloudinary:", error);
        throw new ApiError(500, "Error while deleting video from Cloudinary");
    }
};



export {
    uploadPhotoOnCloudinary,
    extractPublicIdFromCloudinaryUrl,
    deleteImageFromCloudinary,
    uploadVideoOnCloudinary,
    deleteVideoFromCloudinary
}
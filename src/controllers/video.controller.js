import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadPhotoOnCloudinary, extractPublicIdFromCloudinaryUrl, deleteImageFromCloudinary, uploadVideoOnCloudinary, deleteVideoFromCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination

})

const publishAVideo = asyncHandler(async (req, res) => {
    // TODO: get video, upload to cloudinary, create video
    const { title, description, videoFile, thumbnail } = req.body

    if (!title) throw new ApiError(400, "Title is Required");
    if (!description) throw new ApiError(400, "Description is Required");

    const videoFileLocalFilePath = req.files?.videoFile?.[0]?.path;
    console.log("videoFileLocalFilePath -> ", videoFileLocalFilePath)
    if (!videoFileLocalFilePath) throw new ApiError(400, "Video File Must be Required");

    const thumbnailLocalFilePath = req.files?.thumbnail?.[0]?.path;
    console.log("videoFileLocalFilePath -> ", videoFileLocalFilePath)
    if (!thumbnailLocalFilePath) throw new ApiError(400, "Thumbnail File Must be Required");

    // Upload thumbnail to Cloudinary
    const thumbnailFileUpload = await uploadPhotoOnCloudinary(thumbnailLocalFilePath);
    if (!thumbnailFileUpload) throw new ApiError(500, "Error while uploading thumbnail file");

    // Upload video to Cloudinary
    const videoFileUpload = await uploadVideoOnCloudinary(videoFileLocalFilePath)
    if (!videoFileUpload) throw new ApiError(500, "Error while Uploading Video File")

    // Ensure video duration is available
    const videoDuration = videoFileUpload.duration;
    if (!videoDuration) throw new ApiError(500, "Video duration is missing from Cloudinary response");

    const video = await Video.create({
        videoFile: videoFileUpload.secure_url,
        title,
        description: description || "No description provided",
        duration: videoDuration,
        thumbnail: thumbnailFileUpload.secure_url,
        owner: req.user?._id,
    });

    if (!video) throw new ApiError(500, "Error while publishing video");

    return res.status(200).json(new ApiResponse(200, video, "Video published successfully"));

})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    const { title, description } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        throw new ApiError(400, "Invalid title");
    }

    if (!description || typeof description !== "string" || description.trim == '') {
        throw new ApiError(400, "Invalid description");
    }

    const thumbnailLocalPath = req.file?.path;
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is required");
    }

    const thumbnailOnCloudinary = await uploadPhotoOnCloudinary(thumbnailLocalPath);

    const video = await Video.findByIdAndUpdate(
        videoId,
        // {
        //   owner: req.user?._id,
        // },
        {
            title: title,
            description: description,
            thumbnail: thumbnailOnCloudinary?.url,
        },
        { new: true }
    );

    if (!video) {
        throw new ApiError(
            404,
            "Video not found or you are not allowed to update this video"
        );
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video updated successfully"));

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
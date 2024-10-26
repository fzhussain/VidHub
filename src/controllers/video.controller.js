import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadPhotoOnCloudinary, extractPublicIdFromCloudinaryUrl, deleteImageFromCloudinary, uploadVideoOnCloudinary, deleteVideoFromCloudinary } from "../utils/cloudinary.js"
import { stopWords } from "../utils/stopWords.js"



const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query = "", sortBy, sortType = "video", userId, order } = req.query

    // filter video by given filters
    let filters = { isPublished: true }
    if (isValidObjectId(userId)) filters.owner = new mongoose.Types.ObjectId(userId)

    let pipeline = [
        {
            $match: {
                ...filters,
            },
        },
    ]

    const sort = {}
    if (query) {
        const queryWords = query.trim().toLowerCase().replace(/\s+/g, " ").split(" ");  // Remove leading and trailing spaces -> convert to lowercase -> Replace "  "(multiple spaces) to " "(single space) -> split based on " "
        const filteredWords = queryWords.filter((word) => !stopWords.includes(word));  //  "the", "and", "is", etc.,  are discarded
        console.log("query: ", queryWords);
        console.log("filteredWords: ", filteredWords);


        // $addFields: Adds a new field (titleMatchWordCount/descriptionMatchWordCount) to each video document.
        // $size: Counts how many filteredWords match any word in the video’s title.
        // $filter: Iterates over each word in filteredWords and checks if it's in the video title (split into individual words).
        // This helps rank videos based on how many words from the search query are in the title.
        pipeline.push({
            $addFields: {
                titleMatchWordCount: {
                    $size: {
                        $filter: {
                            input: filteredWords,
                            as: "word",
                            cond: {
                                $in: ["$$word", { $split: [{ $toLower: "$title" }, " "] }],
                            },
                        },
                    },
                },
            },
        });

        pipeline.push({
            $addFields: {
                descriptionMatchWordCount: {
                    $size: {
                        $filter: {
                            input: filteredWords,
                            as: "word",
                            cond: {
                                $in: [
                                    "$$word",
                                    { $split: [{ $toLower: "$description" }, " "] },
                                ],
                            },
                        },
                    },
                },
            },
        });

        pipeline.push({
            $match: {
                $or: [
                    { titleMatchWordCount: { $gt: 0 } },
                    { descriptionMatchWordCount: { $gt: 0 } }
                ]
            }
        });

        sort.titleMatchWordCount = -1;  // sorts based on descending order
        sort.descriptionMatchWordCount = -1;  // sorts based on descending order
    }

    // sort the documents
    if (sortBy) {
        sort[sortBy] = parseInt(order);
    } else if (!query && !sortBy) {
        sort["createdAt"] = -1;
    }

    pipeline.push({
        $sort: {
            ...sort,
        },
    });

    // fetch owner detail
    // $lookup: Joins the users collection, fetching the owner's details (e.g., username, fullName, avatar).
    // $unwind: Converts the array of owners into a single object, because each video only has one owner.
    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            userName: 1,
                            fullName: 1,
                            avatar: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$owner",
        }
    );

    // Fetch associated comments for each video
    pipeline.push({
        $lookup: {
            from: "comments",
            localField: "_id",
            foreignField: "video",
            as: "comments",
            pipeline: [
                { $sort: { createdAt: -1 } }, // Sort comments by newest first if needed
                // {
                //     $limit: 5, // Optional: Limit the number of comments per video
                // },
                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    userName: 1,
                                    fullName: 1,
                                    avatar: 1,
                                },
                            },
                        ],
                    },
                },
                {
                    $unwind: "$owner",
                },
                {
                    $project: {
                        video: 0, // Exclude the 'video' field from each comment
                    },
                },
            ],
        },
    });

    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };

    const allVideos = await Video.aggregatePaginate(videoAggregate, options);

    const { docs, ...pagingInfo } = allVideos;

    if (!docs.length) {
        return res.status(404).json(
            new ApiError(404, "No videos found with the selected filters!")
        );
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { videos: docs, pagingInfo },
                "All Query Videos Sent Successfully"
            )
        );

})


const publishAVideo = asyncHandler(async (req, res) => {
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
    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid video id");

    // Fetch the video document
    const video = await Video.findOne({ _id: videoId, isPublished: true });
    if (!video) throw new ApiError(404, "Video not found or not published");

    // Fetch associated comments separately
    const comments = await Comment.find({ video: videoId })
        .populate("owner", "userName fullName avatar") // Populate owner details if needed
        .sort({ createdAt: -1 }); // Sort comments if needed, e.g., latest first

    let watchHistory;
    if (req.user) {
        // Check if the video is already in the user's watch history
        const user = await User.findById(req.user._id);
        const isAlreadyInHistory = user.watchHistory?.some(
            (videoInHistory) => videoInHistory.toString() === videoId
        );
        // If the video is not in the history, add it and increment views
        if (!isAlreadyInHistory) {
            watchHistory = await User.findByIdAndUpdate(
                req.user._id,
                {
                    $push: { watchHistory: new mongoose.Types.ObjectId(videoId) },
                },
                { new: true }
            );

            if (!watchHistory) {
                throw new ApiError(400, "Error occurred while adding to watch history");
            }

            // Increment video views
            video.views += 1;
            const updatedVideo = await video.save();
            if (!updatedVideo) {
                throw new ApiError(400, "Error occurred while updating video views");
            }
        }

    }

    return res.status(200).json(
        new ApiResponse(200, { video, comments }, "Video fetched successfully! View updated and added to user's watch history (if new)")
    );

})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    // Find the video to verify ownership
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if the user is the owner of the video
    if (String(video.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You are not allowed to update this video");
    }

    const { title, description } = req.body;

    // Create an object to store updates
    const updateFields = {};

    // If the title is provided and valid, update it
    if (title && typeof title === 'string' && title.trim() !== '') {
        updateFields.title = title;
    }

    // If the description is provided and valid, update it
    if (description && typeof description === 'string' && description.trim() !== '') {
        updateFields.description = description;
    }

    // Handle the thumbnail update if provided
    const oldThumbnailURL = video.thumbnail
    if (req.file?.path) {
        const thumbnailOnCloudinary = await uploadPhotoOnCloudinary(req.file.path);
        updateFields.thumbnail = thumbnailOnCloudinary?.url;
    }

    // If no valid fields are provided, throw an error
    if (Object.keys(updateFields).length === 0) {
        throw new ApiError(400, "No valid fields provided for update");
    }

    // Update the video with the new fields
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $set: updateFields },
        { new: true }
    );

    if (oldThumbnailURL) {
        // Extract public ID from the old URL for Cloudinary deletion
        const publicId = extractPublicIdFromCloudinaryUrl(oldThumbnailURL);
        await deleteImageFromCloudinary(publicId);
    }

    if (!updatedVideo) {
        throw new ApiError(
            500,
            "Error while upldating the fields"
        );
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if the user is the owner of the video
    if (String(video.owner) !== String(req.user._id)) {
        throw new ApiError(403, "You are not allowed to update this video");
    }

    const videoPublicID = extractPublicIdFromCloudinaryUrl(video.videoFile)
    const thunbnailPublicID = extractPublicIdFromCloudinaryUrl(video.thumbnail)

    const videoFile = await deleteVideoFromCloudinary(videoPublicID)
    const thumbnail = await deleteImageFromCloudinary(thunbnailPublicID)

    if (!videoFile && !thumbnail) {
        throw new ApiError(
            400,
            "thumbnail or videoFile is not deleted from cloudinary"
        );
    }

    await Video.findByIdAndDelete(videoId);

    return res
        .status(200)
        .json(new ApiResponse(200, "Video deleted successfully"));

})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    const video = await Video.findOne({
        _id: videoId,
        owner: req.user?._id,
    });

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    video.isPublished = !video.isPublished;
    await video.save();

    return res
        .status(200)
        .json(
            new ApiResponse(200, video, "Video published status updated successfully")
        );

})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
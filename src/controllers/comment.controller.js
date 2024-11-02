import mongoose, { isValidObjectId } from "mongoose"
import { Comment } from "../models/comment.model.js"
import { Video } from "../models/video.model.js"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid VideoId");

    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");

    const options = { page, limit };

    const pipeline = [
        // Match comments for the specified video
        { $match: { video: new mongoose.Types.ObjectId(videoId) } },

        // Sort comments by creation date
        { $sort: { createdAt: -1 } },

        // Lookup for likes and dislikes
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes",
            },
        },
        {
            $lookup: {
                from: "dislikes",
                localField: "_id",
                foreignField: "comment",
                as: "dislikes",
            },
        },

        // Add fields for total likes/dislikes and like/dislike status
        {
            $addFields: {
                totalLikes: { $size: "$likes" },
                totalDislikes: { $size: "$dislikes" },
                isLiked: {
                    $in: [req.user?._id, "$likes.likedBy"],
                },
                isDisLiked: {
                    $in: [req.user?._id, "$dislikes.dislikedBy"],
                },
                isLikedByVideoOwner: {
                    $in: [video.owner, "$likes.likedBy"],
                },
            },
        },

        // Lookup for owner details and unwind the result
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: 1,
                            _id: 1,
                        },
                    },
                ],
            },
        },
        { $unwind: "$owner" },

        // Project the fields we want in the output
        {
            $project: {
                content: 1,
                owner: 1,
                createdAt: 1,
                updatedAt: 1,
                totalLikes: 1,
                totalDislikes: 1,
                isLiked: 1,
                isDisLiked: 1,
                isLikedByVideoOwner: 1,
                isOwner: { $eq: [req.user?._id, "$owner._id"] },
            },
        },
    ];

    // Paginate the comments
    const paginatedComments = await Comment.aggregatePaginate(pipeline, options);

    const { docs: comments, ...pagingInfo } = paginatedComments;
    if (!comments.length) {
        return res.status(404).json(new ApiError(404, "No comments found!"));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { comments, pagingInfo }, "All Comments Sent Successfully"));
});


const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid VideoId");
    if (!content) throw new ApiError(400, "No Comment Content Found");

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id,
    });
    if (!comment) throw new ApiError(500, "Error while adding comment");

    const { userName, avatar, fullName, _id } = req.user;

    const commentData = {
        ...comment._doc,
        owner: { userName, avatar, fullName, _id },
        likesCount: 0,
        isOwner: true,
    };

    return res
        .status(200)
        .json(new ApiResponse(200, commentData, "Comment added successfully"));
})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;
    if (!isValidObjectId(commentId)) throw new ApiError(400, "Invalid VideoId");
    if (!content) throw new ApiError(400, "No Comment Found");
    const newComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set: {
                content,
            },
        },
        {
            new: true,
        }
    );
    if (!newComment) throw new ApiError(500, "Invalid Comment Id or Error while editing comment");
    return res
        .status(200)
        .json(new ApiResponse(200, newComment, "Comment updated successfully"));
})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    if (!isValidObjectId(commentId)) throw new ApiError(400, "Invalid VideoId");

    const comment = await Comment.findByIdAndDelete(commentId);
    console.log("comment ->", comment)

    if (!comment) throw new ApiError(500, "Error while deleting comment");

    const deleteLikes = await Like.deleteMany({
        comment: new mongoose.Types.ObjectId(commentId),
    });
    if (!deleteLikes) throw new ApiError(500, "Error while deleting Likes");

    return res
        .status(200)
        .json(
            new ApiResponse(200, { isDeleted: true }, "Comment deleted successfully")
        );
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}
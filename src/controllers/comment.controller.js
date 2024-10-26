import mongoose, { isValidObjectId } from "mongoose"
import { Comment } from "../models/comment.model.js"
import { Video } from "../models/video.model.js"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid VideoId");

    const options = {
        page,
        limit,
    };

    const video = await Video.findById(videoId);


    const filters = {
        video: new mongoose.Types.ObjectId(videoId),
    }
    // Finds all comments associated with the specified videoId.
    let pipeline = [
        {
            $match: {
                ...filters,
            },
        },
    ]
    // Sorts comments in descending order by createdAt, so the newest comments come first.
    pipeline.push({
        $sort: {
            createdAt: -1,
        },
    })
    // Looks up documents in the likes collection that match each comment’s _id. Filters to only include records where liked is true. Groups these by liked status, collecting likedBy users (those who liked the comment) into an array called owners.
    pipeline.push({
        $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "comment",
            as: "likes",
            pipeline: [
                {
                    $match: {
                        liked: true,
                    },
                },
                {
                    $group: {
                        _id: "liked",
                        owners: { $push: "$likedBy" },
                    },
                },
            ],
        },
    })

    // Similar to the likes lookup, but filters for liked: false to get users who disliked the comment.
    pipeline.push({
        $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "comment",
            as: "dislikes",
            pipeline: [
                {
                    $match: {
                        liked: false,
                    },
                },
                {
                    $group: {
                        _id: "liked",
                        owners: { $push: "$likedBy" },
                    },
                },
            ],
        },
    })
    //If the likes array has any items, sets likes to the array of user IDs from owners. If not, sets likes to an empty array. Does the same for dislikes.

    pipeline.push({
        $addFields: {
            likes: {
                $cond: {
                    if: { $gt: [{ $size: "$likes" }, 0] },
                    then: { $first: "$likes.owners" },
                    else: [],
                },
            },
            dislikes: {
                $cond: {
                    if: { $gt: [{ $size: "$dislikes" }, 0] },
                    then: { $first: "$dislikes.owners" },
                    else: [],
                },
            },
        },
    })
    // Joins the users collection to fetch the owner’s details (full name, username, avatar, and ID). Uses $unwind to flatten the array created by $lookup since each comment has only one owner.
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
                            fullName: 1,
                            username: 1,
                            avatar: 1,
                            _id: 1,
                        },
                    },
                ],
            },
        },
        { $unwind: "$owner" }
    )
    // $project to specify the fields to include in the output
    pipeline.push({
        $project: {
            content: 1,
            owner: 1,
            createdAt: 1,
            updatedAt: 1,
            isOwner: {
                $cond: {
                    if: { $eq: [req.user?._id, "$owner._id"] },
                    then: true,
                    else: false,
                },
            },
            likesCount: { $size: "$likes" },
            disLikesCount: { $size: "$dislikes" },
            isLiked: {
                $cond: {
                    if: { $in: [req.user?._id, "$likes"] },
                    then: true,
                    else: false,
                },
            },
            isDisLiked: {
                $cond: {
                    if: { $in: [req.user?._id, "$dislikes"] },
                    then: true,
                    else: false,
                },
            },
            isLikedByVideoOwner: {
                $cond: {
                    if: { $in: [video.owner, "$likes"] },
                    then: true,
                    else: false,
                },
            },
        },
    })

    const allComments = await Comment.aggregate(pipeline)
    if (!allComments) throw new ApiError(400, "No Comments Found")

    // return res
    //     .status(200)
    //     .json(new ApiResponse(200, allComments, "All comments Sent"));


    const paginatedAllComments = await Comment.aggregatePaginate(pipeline, options)
    console.log("paginatedAllComments ->", paginatedAllComments)

    const { docs, ...pagingInfo } = paginatedAllComments;
    console.log("pagingInfo ->", pagingInfo)

    if (!docs.length) {
        return res.status(404).json(
            new ApiError(404, "No comments found!")
        );
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { comments: docs, pagingInfo },
                "All Comments Sent Successfully"
            )
        );

})

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
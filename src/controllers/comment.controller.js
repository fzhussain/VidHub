import mongoose, { isValidObjectId } from "mongoose"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
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
    // TODO: update a comment
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}
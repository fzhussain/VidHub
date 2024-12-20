import mongoose, { isValidObjectId } from "mongoose"
import { Like } from "../models/like.model.js"
import { Video } from "../models/video.model.js"
import { Tweet } from "../models/tweet.model.js"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "invalid videoId");
    }

    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(400, "video not found");

    let isLiked = await Like.find({ video: videoId, likedBy: req.user?._id });

    console.log("isLiked ->", isLiked)

    if (isLiked && isLiked.length > 0) {
        const like = await Like.findByIdAndDelete(isLiked[0]._id);
        isLiked = false;
    } else {
        const like = await Like.create({ video: videoId, likedBy: req.user?._id });
        if (!like) throw new ApiError(500, "error while toggling like");
        isLiked = true;
    }

    let totalLikes = await Like.find({ video: videoId });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isLiked, totalLikes: totalLikes.length },
                "like toggled successfully"
            )
        );

})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)) throw new ApiError(400, "invalid commentId");
    const comment = await Comment.findById(commentId);
    if (!comment) throw new ApiError(400, "no Comments found");
    let isLiked = await Like.find({ comment: commentId, likedBy: req.user?._id });
    if (isLiked?.length > 0) {
        await Like.findByIdAndDelete(isLiked[0]._id);
        isLiked = false;
    } else {
        const like = await Like.create({ comment: commentId, likedBy: req.user?._id });
        if (!like) throw new ApiError(500, "error while toggling like");
        isLiked = true;
    }
    let totalLikes = await Like.find({ comment: commentId });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isLiked, totalLikes: totalLikes.length },
                "Comment like toggled successfully"
            )
        );

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params


    if (!isValidObjectId(tweetId)) throw new ApiError(400, "invalid tweetId");
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) throw new ApiError(400, "no tweet found");

    let isLiked = await Like.find({ tweet: tweetId, likedBy: req.user?._id });

    if (isLiked?.length > 0) {
        await Like.findByIdAndDelete(isLiked[0]._id);
        isLiked = false;
    } else {
        const like = await Like.create({ tweet: tweetId, likedBy: req.user?._id });
        if (!like) throw new ApiError(500, "error while toggling like");
        isLiked = true;
    }

    let totalLikes = await Like.find({ tweet: tweetId });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isLiked, totalLikes: totalLikes.length },
                "Tweet like toggled successfully"
            )
        );

}
)

const getLikedVideos = asyncHandler(async (req, res) => {


    let filters = {
        video: { $ne: null },  // Filter out documents where 'video' is null
        likedBy: new mongoose.Types.ObjectId(req.user?._id),  // Filter by the user who liked the video
    }

    let pipeline = [
        {
            $match: {
                ...filters,  // Match documents based on the filters
            },
        },
    ]

    pipeline.push(
        {
            $lookup: {
                from: "videos",  // Join with the 'videos' collection
                localField: "video",  // Field in the current collection
                foreignField: "_id",  // Field in the 'videos' collection
                as: "video",  // Output array field
                pipeline: [
                    {
                        $lookup: {
                            from: "users",  // Join with the 'users' collection
                            localField: "owner",  // Field in the current collection
                            foreignField: "_id",  // Field in the 'users' collection
                            as: "owner",  // Output array field
                            pipeline: [
                                {
                                    $project: {  // Project specific fields
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $unwind: "$owner",  // Unwind the 'owner' array to denormalize
                    },
                ],
            },
        }
    )

    pipeline.push(
        {
            $unwind: "$video",  // Unwind the 'video' array to denormalize
        }
    )

    pipeline.push(
        {
            $match: {
                "video.isPublished": true,  // Only include published videos
            },
        }
    )

    pipeline.push(
        {
            $group: {
                _id: "likedBy",  // Group by 'likedBy' field
                videos: { $push: "$video" },  // Push matched videos into an array
            },
        }
    )

    const likedVideos = await Like.aggregate(pipeline)
    const videos = likedVideos[0]?.videos || [];

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "videos sent successfully"));
})

const getLikedTweets = asyncHandler(async (req, res) => {

    let filters = {
        tweet: { $ne: null },  // Filter out documents where 'tweet' is null
        likedBy: new mongoose.Types.ObjectId(req.user?._id),  // Filter by the user who liked the tweet
    }

    let pipeline = [
        {
            $match: {
                ...filters,  // Match documents based on the filters
            },
        },
    ]

    pipeline.push(
        {
            $lookup: {
                from: "tweets",  // Join with the 'tweets' collection
                localField: "tweet",  // Field in the current collection
                foreignField: "_id",  // Field in the 'tweets' collection
                as: "tweet",  // Output array field
                pipeline: [
                    {
                        $lookup: {
                            from: "users",  // Join with the 'users' collection
                            localField: "owner",  // Field in the current collection
                            foreignField: "_id",  // Field in the 'users' collection
                            as: "owner",  // Output array field
                            pipeline: [
                                {
                                    $project: {  // Project specific fields
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $unwind: "$owner",  // Unwind the 'owner' array to denormalize
                    },
                ],
            },
        }
    )

    pipeline.push(
        {
            $unwind: "$tweet",  // Unwind the 'tweet' array to denormalize
        }
    )

    pipeline.push(
        {
            $group: {
                _id: "likedBy",  // Group by 'likedBy' field
                tweets: { $push: "$tweet" },  // Push matched tweets into an array
            },
        }
    )

    const likedTweets = await Like.aggregate(pipeline)
    const tweets = likedTweets[0]?.tweets || [];

    return res.status(200).json(new ApiResponse(200, tweets, "Tweets sent successfully"));
});

const getLikedComments = asyncHandler(async (req, res) => {

    let filters = {
        comment: { $ne: null },  // Filter out documents where 'comment' is null
        likedBy: new mongoose.Types.ObjectId(req.user?._id),  // Filter by the user who liked the comment
    }

    let pipeline = [
        {
            $match: {
                ...filters,  // Match documents based on the filters
            },
        },
    ]

    pipeline.push(
        {
            $lookup: {
                from: "comments",  // Join with the 'comments' collection
                localField: "comment",  // Field in the current collection
                foreignField: "_id",  // Field in the 'comments' collection
                as: "comment",  // Output array field
                pipeline: [
                    {
                        $lookup: {
                            from: "users",  // Join with the 'users' collection
                            localField: "owner",  // Field in the current collection
                            foreignField: "_id",  // Field in the 'users' collection
                            as: "owner",  // Output array field
                            pipeline: [
                                {
                                    $project: {  // Project specific fields
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $unwind: "$owner",  // Unwind the 'owner' array to denormalize
                    },
                ],
            },
        }
    )

    pipeline.push(
        {
            $unwind: "$comment",  // Unwind the 'comment' array to denormalize
        }
    )


    pipeline.push(
        {
            $group: {
                _id: "likedBy",  // Group by 'likedBy' field
                comments: { $push: "$comment" },  // Push matched comments into an array
            },
        }
    )

    const likedComments = await Like.aggregate(pipeline)
    const comments = likedComments[0]?.comments || [];

    return res.status(200).json(new ApiResponse(200, comments, "Comments sent successfully"));
});


export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos,
    getLikedTweets,
    getLikedComments
}
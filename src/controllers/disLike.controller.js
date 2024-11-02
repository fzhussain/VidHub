import mongoose, { isValidObjectId } from "mongoose"
import { Dislike } from "../models/dislike.model.js"
import { Video } from "../models/video.model.js"
import { Tweet } from "../models/tweet.model.js"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const toggleVideoDisLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: toggle like on video
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "invalid videoId");
    }

    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(400, "video not found");

    let isDisLiked = await Dislike.find({ video: videoId, dislikedBy: req.user?._id });

    console.log("isDisLiked ->", isDisLiked)

    if (isDisLiked && isDisLiked.length > 0) {
        const disLike = await Dislike.findByIdAndDelete(isDisLiked[0]._id);
        isDisLiked = false;
    } else {
        const disLike = await Dislike.create({ video: videoId, dislikedBy: req.user?._id });
        if (!disLike) throw new ApiError(500, "error while toggling dislike");
        isDisLiked = true;
    }

    let totalDisLikes = await Dislike.find({ video: videoId });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isDisLiked, totalDisLikes: totalDisLikes.length },
                "DisLike toggled successfully"
            )
        );

})

const toggleCommentDisLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    //TODO: toggle like on comment
    if (!isValidObjectId(commentId)) throw new ApiError(400, "invalid commentId");

    const comment = await Comment.findById(commentId);
    if (!comment) throw new ApiError(400, "no Comments found");

    let isDisLiked = await Dislike.find({ comment: commentId, dislikedBy: req.user?._id });
    console.log("isDisLiked ->", isDisLiked)

    if (isDisLiked?.length > 0) {
        await Dislike.findByIdAndDelete(isDisLiked[0]._id);
        isDisLiked = false;
    } else {
        const disLike = await Dislike.create({ comment: commentId, dislikedBy: req.user?._id });
        if (!disLike) throw new ApiError(500, "error while toggling dislike");
        isDisLiked = true;
    }
    let totalDisLikes = await Dislike.find({ comment: commentId });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isDisLiked, totalDisLikes: totalDisLikes.length },
                "Comment dislike toggled successfully"
            )
        );

})

const toggleTweetDisLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    //TODO: toggle like on tweet

    if (!isValidObjectId(tweetId)) throw new ApiError(400, "invalid tweetId");
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) throw new ApiError(400, "no tweet found");

    let isDisLiked = await Dislike.find({ tweet: tweetId, dislikedBy: req.user?._id });

    if (isDisLiked?.length > 0) {
        await Dislike.findByIdAndDelete(isDisLiked[0]._id);
        isDisLiked = false;
    } else {
        const dislike = await Dislike.create({ tweet: tweetId, dislikedBy: req.user?._id });
        if (!dislike) throw new ApiError(500, "error while toggling like");
        isDisLiked = true;
    }

    let totalDisLikes = await Dislike.find({ tweet: tweetId });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isDisLiked, totalDisLikes: totalDisLikes.length },
                "Tweet dislike toggled successfully"
            )
        );

}
)

const getDisLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos

    let filters = {
        video: { $ne: null },  // Filter out documents where 'video' is null
        dislikedBy: new mongoose.Types.ObjectId(req.user?._id),  // Filter by the user who liked the video
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
                _id: "dislikedBy",  // Group by 'likedBy' field
                videos: { $push: "$video" },  // Push matched videos into an array
            },
        }
    )

    const dislikedVideos = await Dislike.aggregate(pipeline)
    const videos = dislikedVideos[0]?.videos || [];

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "videos sent successfully"));
})

const getDisLikedTweets = asyncHandler(async (req, res) => {
    //TODO: get all liked tweets
    let filters = {
        tweet: { $ne: null },  // Filter out documents where 'tweet' is null
        dislikedBy: new mongoose.Types.ObjectId(req.user?._id),  // Filter by the user who liked the tweet
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
                _id: "dislikedBy",  // Group by 'likedBy' field
                tweets: { $push: "$tweet" },  // Push matched tweets into an array
            },
        }
    )

    const dislikedTweets = await Dislike.aggregate(pipeline)
    const tweets = dislikedTweets[0]?.tweets || [];

    return res.status(200).json(new ApiResponse(200, tweets, "Tweets sent successfully"));
});

const getDisLikedComments = asyncHandler(async (req, res) => {
    //TODO: get all liked comments
    let filters = {
        comment: { $ne: null },  // Filter out documents where 'comment' is null
        dislikedBy: new mongoose.Types.ObjectId(req.user?._id),  // Filter by the user who liked the comment
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
                _id: "dislikedBy",  // Group by 'likedBy' field
                comments: { $push: "$comment" },  // Push matched comments into an array
            },
        }
    )

    const dislikedComments = await Dislike.aggregate(pipeline)
    const comments = dislikedComments[0]?.comments || [];

    return res.status(200).json(new ApiResponse(200, comments, "Comments sent successfully"));
});


export {
    toggleVideoDisLike,
    toggleCommentDisLike,
    toggleTweetDisLike,
    getDisLikedVideos,
    getDisLikedTweets,
    getDisLikedComments
}
import mongoose from "mongoose"
import { Video } from "../models/video.model.js"
import { Subscription } from "../models/subscription.model.js"
import { Like } from "../models/like.model.js"
import { Dislike } from "../models/dislike.model.js"
import { Comment } from "../models/comment.model.js"
import { Tweet } from "../models/tweet.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const channelStats = {};

    let videoFilters = {
        owner: req.user?._id,
    };

    let videoPipeline = [
        {
            $match: { ...videoFilters },
        },
        {
            $group: {
                _id: null,
                totalViews: { $sum: "$views" },
                totalVideos: { $count: {} },
            },
        },
    ];

    const videoStates = await Video.aggregate(videoPipeline);

    // New pipeline for total comments
    let commentPipeline = [
        {
            $match: {
                owner: req.user?._id, // Match comments owned by the user
            },
        },
        {
            $group: {
                _id: null,
                totalComments: { $count: {} }, // Count total comments
            },
        },
    ];

    const commentStats = await Comment.aggregate(commentPipeline);

    // New pipeline for total tweets
    let tweetPipeline = [
        {
            $match: {
                owner: req.user?._id, // Match tweets owned by the user
            },
        },
        {
            $group: {
                _id: null,
                totalTweets: { $count: {} }, // Count total tweets
            },
        },
    ];

    const tweetStats = await Tweet.aggregate(tweetPipeline);

    let subscriberFilters = {
        channel: req.user?._id,
    };

    let subscriberPipeline = [
        {
            $match: { ...subscriberFilters },
        },
        {
            $count: "totalSubscribers",
        },
    ];

    const subscriber = await Subscription.aggregate(subscriberPipeline);

    // Like Filters and Pipeline
    let likeFilters = {
        video: { $ne: null },
    };

    let likePipeline = [
        {
            $match: { ...likeFilters },
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "channelVideo",
                pipeline: [
                    {
                        $match: {
                            owner: req.user?._id,
                        },
                    },
                    {
                        $project: { _id: 1 },
                    },
                ],
            },
        },
        {
            $addFields: {
                channelVideo: { $first: "$channelVideo" },
            },
        },
        {
            $match: {
                channelVideo: { $ne: null },
            },
        },
        {
            $group: {
                _id: null,
                likeCount: { $sum: 1 },
            },
        },
    ];

    const totalVideoLikes = await Like.aggregate(likePipeline);

    let commentLikeFilters = {
        comment: { $ne: null },
    };

    let commentLikePipeline = [
        {
            $match: { ...commentLikeFilters },
        },
        {
            $lookup: {
                from: "comments",
                localField: "comment",
                foreignField: "_id",
                as: "likedComment",
                pipeline: [
                    {
                        $match: {
                            owner: req.user?._id,
                        },
                    },
                    {
                        $project: { _id: 1 },
                    },
                ],
            },
        },
        {
            $addFields: {
                likedComment: { $first: "$likedComment" },
            },
        },
        {
            $match: {
                likedComment: { $ne: null },
            },
        },
        {
            $group: {
                _id: null,
                likeCount: { $sum: 1 },
            },
        },
    ];

    const totalCommentLikes = await Like.aggregate(commentLikePipeline);

    let tweetLikeFilters = {
        tweet: { $ne: null },
    };

    let tweetLikePipeline = [
        {
            $match: { ...tweetLikeFilters },
        },
        {
            $lookup: {
                from: "tweets",
                localField: "tweet",
                foreignField: "_id",
                as: "likedTweet",
                pipeline: [
                    {
                        $match: {
                            owner: req.user?._id,
                        },
                    },
                    {
                        $project: { _id: 1 },
                    },
                ],
            },
        },
        {
            $addFields: {
                likedTweet: { $first: "$likedTweet" },
            },
        },
        {
            $match: {
                likedTweet: { $ne: null },
            },
        },
        {
            $group: {
                _id: null,
                likeCount: { $sum: 1 },
            },
        },
    ];

    const totalTweetLikes = await Like.aggregate(tweetLikePipeline);

    // Dislike Filters and Pipeline
    let dislikeFilters = {
        video: { $ne: null },
    };

    let dislikePipeline = [
        {
            $match: { ...dislikeFilters },
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "channelVideo",
                pipeline: [
                    {
                        $match: {
                            owner: req.user?._id,
                        },
                    },
                    {
                        $project: { _id: 1 },
                    },
                ],
            },
        },
        {
            $addFields: {
                channelVideo: { $first: "$channelVideo" },
            },
        },
        {
            $match: {
                channelVideo: { $ne: null },
            },
        },
        {
            $group: {
                _id: null,
                dislikeCount: { $sum: 1 },
            },
        },
    ];

    const totalVideoDislikes = await Dislike.aggregate(dislikePipeline);

    let commentDislikeFilters = {
        comment: { $ne: null },
    };

    let commentDislikePipeline = [
        {
            $match: { ...commentDislikeFilters },
        },
        {
            $lookup: {
                from: "comments",
                localField: "comment",
                foreignField: "_id",
                as: "dislikedComment",
                pipeline: [
                    {
                        $match: {
                            owner: req.user?._id,
                        },
                    },
                    {
                        $project: { _id: 1 },
                    },
                ],
            },
        },
        {
            $addFields: {
                dislikedComment: { $first: "$dislikedComment" },
            },
        },
        {
            $match: {
                dislikedComment: { $ne: null },
            },
        },
        {
            $group: {
                _id: null,
                dislikeCount: { $sum: 1 },
            },
        },
    ];

    const totalCommentDislikes = await Dislike.aggregate(commentDislikePipeline);

    let tweetDislikeFilters = {
        tweet: { $ne: null },
    };

    let tweetDislikePipeline = [
        {
            $match: { ...tweetDislikeFilters },
        },
        {
            $lookup: {
                from: "tweets",
                localField: "tweet",
                foreignField: "_id",
                as: "dislikedTweet",
                pipeline: [
                    {
                        $match: {
                            owner: req.user?._id,
                        },
                    },
                    {
                        $project: { _id: 1 },
                    },
                ],
            },
        },
        {
            $addFields: {
                dislikedTweet: { $first: "$dislikedTweet" },
            },
        },
        {
            $match: {
                dislikedTweet: { $ne: null },
            },
        },
        {
            $group: {
                _id: null,
                dislikeCount: { $sum: 1 },
            },
        },
    ];

    const totalTweetDislikes = await Dislike.aggregate(tweetDislikePipeline);

    channelStats.ownerName = req.user?.fullName;
    channelStats.totalViews = (videoStates && videoStates[0]?.totalViews) || 0;
    channelStats.totalVideos = (videoStates && videoStates[0]?.totalVideos) || 0;
    channelStats.totalSubscribers = (subscriber && subscriber[0]?.totalSubscribers) || 0;
    channelStats.totalComments = (commentStats && commentStats[0]?.totalComments) || 0; // New field
    channelStats.totalTweets = (tweetStats && tweetStats[0]?.totalTweets) || 0; // New field
    channelStats.totalVideoLikes = (totalVideoLikes && totalVideoLikes[0]?.likeCount) || 0;
    channelStats.totalVideoDislikes = (totalVideoDislikes && totalVideoDislikes[0]?.dislikeCount) || 0;
    channelStats.totalCommentLikes = (totalCommentLikes && totalCommentLikes[0]?.likeCount) || 0;
    channelStats.totalCommentDislikes = (totalCommentDislikes && totalCommentDislikes[0]?.dislikeCount) || 0;
    channelStats.totalTweetLikes = (totalTweetLikes && totalTweetLikes[0]?.likeCount) || 0;
    channelStats.totalTweetDislikes = (totalTweetDislikes && totalTweetDislikes[0]?.dislikeCount) || 0;

    return res
        .status(200)
        .json(
            new ApiResponse(200, channelStats, "Channel stats sent successfully")
        );
});

const getChannelVideos = asyncHandler(async (req, res) => {

    const allVideos = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(req.user?._id),
            },
        },
        {
            $sort:
            {
                createdAt: -1,
            },
        }, // lookup for likes 
        {
            $lookup:
            {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes",
            },
        }, // lookup for dislikes 
        {
            $lookup:
            {
                from: "dislikes",
                localField: "_id",
                foreignField: "video",
                as: "dislikes",
            },
        }, // lookup for comments 
        {
            $lookup:
            {
                from: "comments",
                localField: "_id",
                foreignField: "video",
                as: "comments",
            },
        },
        {
            $project:
            {
                title: 1,
                thumbnail: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
                description: 1,
                views: 1,
                likesCount: {
                    $size: "$likes",
                }, dislikesCount: {
                    $size: "$dislikes",
                }, commentsCount: {
                    $size: "$comments",
                },
            },
        },
    ]);


    return res.status(200).json(new ApiResponse(200, allVideos, "All videos fetched successfully"));
})

export {
    getChannelStats,
    getChannelVideos
}
import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadPhotoOnCloudinary, deleteImageFromCloudinary, extractPublicIdFromCloudinaryUrl } from "../utils/cloudinary.js"


const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet    
    const { content, tweet_photo } = req.body;
    if (!content) throw new ApiError(400, "Tweet content required");

    let tweetPhotoUrl = null;

    // Check if a photo is uploaded via multipart/form-data
    if (req.file) {
        const tweetLocalPath = req.file.path;

        // Upload the photo to Cloudinary
        const uploadResult = await uploadPhotoOnCloudinary(tweetLocalPath);
        if (uploadResult) {
            tweetPhotoUrl = uploadResult.secure_url;
        }
    }

    // Create the tweet with the content and photo URL
    const tweetRes = await Tweet.create({
        content,
        tweet_photo: tweetPhotoUrl,
        owner: req.user?._id
    });

    if (!tweetRes) throw new ApiError(500, "Error occurred while creating tweet");

    return res.status(201).json(new ApiResponse(201, tweetRes, "Tweet created successfully"));
})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const { userId } = req.params;

    if (!isValidObjectId(userId))
        throw new ApiError(400, "Invalid userId: " + userId);


    const filters = {
        owner: new mongoose.Types.ObjectId(userId),
    }

    let pipeline = [
        {
            $match: {
                ...filters,
            },
        },
    ]
    // Sort Tweets by Creation Date 
    pipeline.push(
        {
            $sort: {
                createdAt: -1,
            },
        }
    )

    // Lookup for Likes on Tweets
    pipeline.push({
        $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "tweet",
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

    // Lookup for Dislikes on Tweets
    pipeline.push({
        $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "tweet",
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

    // Reshape Likes and Dislikes Fields
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

    // Lookup for Owner Details
    pipeline.push({
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [
                {
                    $project: {
                        username: 1,
                        avatar: 1,
                        fullName: 1,
                    },
                },
            ],
        },
    },
        { $unwind: "$owner" }
    )

    // Project Final Fields
    pipeline.push({
        $project: {
            content: 1,
            createdAt: 1,
            updatedAt: 1,
            owner: 1,
            totalLikes: { $size: "$likes" },
            totalDisLikes: { $size: "$dislikes" },
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
        },
    })

    const allTweets = await Tweet.aggregate(pipeline)

    return res
        .status(200)
        .json(new ApiResponse(200, allTweets, "all tweets send successfully"));

})
const getAllTweets = asyncHandler(async (req, res) => {
    let pipeline = []
    // Sort Tweets by Creation Date 
    pipeline.push(
        {
            $sort: {
                createdAt: -1,
            },
        }
    )

    // Lookup for Likes on Tweets
    pipeline.push({
        $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "tweet",
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

    // Lookup for Dislikes on Tweets
    pipeline.push({
        $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "tweet",
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

    // Reshape Likes and Dislikes Fields
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

    // Lookup for Owner Details
    pipeline.push({
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [
                {
                    $project: {
                        username: 1,
                        avatar: 1,
                        fullName: 1,
                    },
                },
            ],
        },
    },
        { $unwind: "$owner" }
    )

    // Project Final Fields
    pipeline.push({
        $project: {
            content: 1,
            createdAt: 1,
            updatedAt: 1,
            owner: 1,
            totalLikes: { $size: "$likes" },
            totalDisLikes: { $size: "$dislikes" },
            isOwner: {

                $cond: {

                    if: { $eq: [req.user?._id, "$owner._id"] },

                    then: true,

                    else: false,

                },

            },
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
        },
    })

    const allTweets = await Tweet.aggregate(pipeline)

    return res
        .status(200)
        .json(new ApiResponse(200, allTweets, "all tweets send successfully"));

})

const getAllUserFeedTweets = asyncHandler(async (req, res) => {
    const subscriptions = await Subscription.find({ subscriber: req.user?._id });

    const subscribedChannels = subscriptions.map((item) => item.channel);

    const allTweets = await Tweet.aggregate([
        {
            $match: {
                owner: {
                    $in: subscribedChannels,
                },
            },
        },
        // sort by latest
        {
            $sort: {
                createdAt: -1,
            },
        },
        // fetch likes of tweet
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
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
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
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
        },
        // Reshape Likes and dislikes
        {
            $addFields: {
                likes: {
                    $cond: {
                        if: {
                            $gt: [{ $size: "$likes" }, 0],
                        },
                        then: { $first: "$likes.owners" },
                        else: [],
                    },
                },
                dislikes: {
                    $cond: {
                        if: {
                            $gt: [{ $size: "$dislikes" }, 0],
                        },
                        then: { $first: "$dislikes.owners" },
                        else: [],
                    },
                },
            },
        },
        // get owner details
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullName: 1,
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
                content: 1,
                createdAt: 1,
                updatedAt: 1,
                owner: 1,
                isOwner: {
                    $cond: {
                        if: { $eq: [req.user?._id, "$owner._id"] },
                        then: true,
                        else: false,
                    },
                },
                totalLikes: {
                    $size: "$likes",
                },
                totalDisLikes: {
                    $size: "$dislikes",
                },
                isLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$likes"],
                        },
                        then: true,
                        else: false,
                    },
                },
                isDisLiked: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$dislikes"],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, allTweets, "all tweets send successfully"));
});


const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const { tweetId } = req.params;
    const { content } = req.body;
    if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweetId");
    if (!content) throw new ApiError(400, "tweet content required");

    let newtTweetPhotoUrl = null;
    // Check if a new photo is uploaded via multipart/form-data
    if (req.file) {
        const tweetLocalPath = req.file.path;

        // Upload the new photo to Cloudinary
        const newUploadResult = await uploadPhotoOnCloudinary(tweetLocalPath);
        if (newUploadResult) {
            newtTweetPhotoUrl = newUploadResult.secure_url;
        }
    }

    const updateData = { content };
    if (newtTweetPhotoUrl) {
        updateData.tweet_photo = newtTweetPhotoUrl;
    }
    const tweet = await Tweet.findById(tweetId)
    const oldTweetPhoto = tweet.tweet_photo
    // console.log("oldTweetPhoto ->", oldTweetPhoto)

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        { $set: updateData },
        {
            new: true,
        }
    );
    if (!updatedTweet) throw new ApiError(500, "Error occurred while updating tweet");

    if (oldTweetPhoto) {
        // Extract public ID from the old URL for Cloudinary deletion
        const publicId = extractPublicIdFromCloudinaryUrl(oldTweetPhoto);
        await deleteImageFromCloudinary(publicId);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));

})


const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) throw new ApiError(400, "Invalid tweetId");

    const findRes = await Tweet.findByIdAndDelete(tweetId);

    if (!findRes) throw new ApiError(500, "tweet not found");

    // const deleteLikes = await Like.deleteMany({
    //     tweet: new mongoose.Types.ObjectId(tweetId),
    // });

    return res
        .status(200)
        .json(new ApiResponse(200, findRes, "tweet deleted successfully"));
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    getAllTweets,
    deleteTweet
}
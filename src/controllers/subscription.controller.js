import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params
    // TODO: toggle subscription
    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel id")
    }
    // Check if the logged-in user is trying to subscribe to their own channel
    console.log(channelId, req.user._id.toString())
    if (channelId === req.user._id.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel.")
    }

    const existingSubscription = await Subscription.findOne({
        channel: channelId,
        subscriber: req.user._id
    })

    if (existingSubscription) {
        await existingSubscription.deleteOne()
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    {},
                    "Unsubscribed successfully"
                )
            )

    } else {
        const newSubscription = await Subscription.create({
            channel: channelId,
            subscriber: req.user._id
        })
        return res
            .status(201)
            .json(
                new ApiResponse(
                    201,
                    newSubscription,
                    "Subscribed successfully"
                )
            )
    }

})

// controller to return subscriber list of a channel
const getChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel id")
    }


    const subscribers = await Subscription.find({
        channel: channelId,
    }).populate("subscriber", "fullName avatar username")

    const totalSubscribers = subscribers.length;

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    totalSubscribers,
                    subscribers,
                },
                "Subscribers fetched successfully"
            )
        )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    // const { subscriberId } = req.params
    if (!isValidObjectId(req.user._id)) {
        throw new ApiError(400, "Invalid user id")
    }

    // Get the subscribed channels for the subscriber
    const subscribedChannels = await Subscription.find({
        subscriber: req.user._id,
    }).populate("channel", "fullName avatar username");

    // Check if no channels were found
    if (!subscribedChannels.length) {
        throw new ApiError(404, "No channel subscriptions found");
    }
    const totalSubscribedChannels = subscribedChannels.length;


    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    totalSubscribedChannels,
                    subscribedChannels
                },
                "Subscribed channels fetched successfully"
            )
        );

})

export {
    toggleSubscription,
    getChannelSubscribers,
    getSubscribedChannels
}
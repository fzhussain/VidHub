import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { uploadOnCloudinary, extractPublicIdFromCloudinaryUrl, deleteFromCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshTokens = async (userID) => {
    try {
        const user = await User.findById(userID)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        // Adding refreshToken in database
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Refresh and Access Token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // Get user details from frontend

    const { userName, email, fullName, avatar, coverImage, password } = req.body
    // console.log("Request body ->", req.body)

    // Validation - not empty
    // if (fullName === "") {
    //     throw new ApiError(400, "Full name is required")
    // }
    if (
        [userName, email, fullName, avatar, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All Fields are compulsory")
    }

    // Check if user already exists  - username, email

    const exitingUser = await User.findOne({
        $or: [{ userName }, { email }]
    })

    if (exitingUser) {
        throw new ApiError(409, "User with username and email already exists")
    }

    // Check for images, avatar
    // console.log("Request files ->", req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }


    // Upload on cloudinary - avatar
    const avatarUpload = await uploadOnCloudinary(avatarLocalPath)
    const coverImageUpload = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatarUpload) {
        throw new ApiError(400, "Avatar image to upload on Cloudinary is required")
    }

    // Create user object and Create entry in Database
    const user = await User.create({
        userName: userName.toLowerCase(),
        email,
        fullName,
        avatar: avatarUpload.url,
        coverImage: coverImageUpload?.url || "",
        password
    })
    // Remove passoword and refresh token field from response   
    const createUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // Check for user creation
    if (!createUser) {
        throw new ApiError(500, "Something went wrong while creating a user")
    }
    // return res
    return res.status(201).json(
        new ApiResponse(200, createUser, "User registered successfully")
    )


})

const loginUser = asyncHandler(async (req, res) => {
    // get detailf from req.body
    const { email, userName, password } = req.body
    // Email based login or userName based login
    if (!email && !userName) {
        throw new ApiError(400, "Email and Username is required")
    }

    // Same logic as og above code
    // if (!(email || userName)) {
    //     throw new ApiError(400, "Email or Username is required");
    // }

    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    // Find user
    // Find user by email or username, and make it case insensitive for email
    const user = await User.findOne({
        $or: [
            { email },
            { userName }
        ]
    })

    if (!user) {
        throw new ApiError(400, "User doesn't exists! Please register")
    }

    // Check password
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid User Password")
    }

    // access and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
    // console.log("From Login User ->", refreshToken)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send cookies
    const cookieOption = {
        httpOnly: true,  // the cookie is only modifiable by the server, not by the client-side JavaScript. However, the client (browser) can still view and send the cookie back to the server during HTTP requests.
        secure: true,  // Only sent over HTTPS
    }


    return res.status(200)
        .cookie("accessToken", accessToken, cookieOption)
        .cookie("refreshToken", refreshToken, cookieOption)
        .json(new ApiResponse(200, {
            user: loggedInUser,
            accessToken,
            refreshToken
        }, "User loggedin successfully!"))
})

const logOutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )
    // send cookies
    const cookieOption = {
        httpOnly: true,
        secure: true,
    }

    return res
        .status(200)
        .clearCookie("accessToken", cookieOption)
        .clearCookie("refreshToken", cookieOption)
        .json(new ApiResponse(200, {}, "User logged out out successfully!"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request from refreshAccessToken controller")
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is expired or used")
        }

        const cookieOption = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOption)
            .cookie("refreshToken", newRefreshToken, cookieOption)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken,
                        refreshToken: newRefreshToken,

                    },
                    "Access token refreshed successfully!"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
    }

})

const changeUserPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body

    if (!(newPassword === confirmPassword)) {
        throw new ApiError(400, "New password and confirm password do not match")
    }

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password Changed Successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body
    // Ensure that at least one of fullName or email is provided
    if (!fullName && !email) {
        throw new ApiError(400, "Please provide either a new fullName or email.");
    }

    try {

        // Fetch the current user details
        const currentUser = await User.findById(req.user?._id).select("fullName email");

        if (!currentUser) {
            throw new ApiError(404, "User not found");
        }

        // Check if both fullName and email are provided and both are the same as the current values
        if (fullName === currentUser.fullName && email === currentUser.email) {
            return res.status(200).json(new ApiResponse(200, currentUser, "No changes were made. Both fullName and email are already the same."));
        }

        // Check if the provided fullName is the same as the current one
        if (fullName && fullName === currentUser.fullName) {
            return res.status(200).json(new ApiResponse(200, currentUser, "No changes were made. The fullName is already the same."));
        }

        // Check if the provided email is the same as the current one
        if (email && email === currentUser.email) {
            return res.status(200).json(new ApiResponse(200, currentUser, "No changes were made. The email is already the same."));
        }

        // Build the update object based on the provided fields
        const updateFields = {};
        if (fullName) updateFields.fullName = fullName;
        if (email) updateFields.email = email;

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            { $set: updateFields },
            { new: true }
        ).select("-password")

        return res
            .status(200)
            .json(new ApiResponse(200, user, "Account details updated successfully"))
    } catch (error) {
        // Check if the error is a Mongo duplicate key error
        if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
            throw new ApiError(400, "Email already in use. Please choose a different email.");
        }

        // If the error is something else, rethrow it to be handled by your asyncHandler middleware
        throw new ApiError(500, "An error occurred while updating account details");
    }


})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while updating avatar")
    }

    // Fetch the current user with the old avatar URL
    const currentUser = await User.findById(req.user?._id)

    // Store the old avatar URL (if any) to delete later
    const oldAvatarUrl = currentUser.avatar

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    // TODO: Delete old image
    if (oldAvatarUrl) {
        // Extract public ID from the old URL for Cloudinary deletion
        const publicId = extractPublicIdFromCloudinaryUrl(oldAvatarUrl);
        console.log("publicId ->", publicId)
        await deleteFromCloudinary(publicId);
    }

    return res.
        status(200)
        .json(
            new ApiResponse(200, user, "Cover Image updated successfully!")
        )

})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while updating Cover image")
    }

    // Fetch the current user with the old avatar URL
    const currentUser = await User.findById(req.user?._id)

    // Store the old avatar URL (if any) to delete later
    const oldCoverImageUrl = currentUser.coverImage

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    if (oldCoverImageUrl) {
        // Extract public ID from the old URL for Cloudinary deletion
        const publicId = extractPublicIdFromCloudinaryUrl(oldCoverImageUrl);
        console.log("publicId ->", publicId)
        await deleteFromCloudinary(publicId);
    }

    return res.
        status(200)
        .json(
            new ApiResponse(200, user, "Cover Image updated successfully!")
        )
})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { userName } = req.params

    if (!userName?.trim()) {
        throw new ApiError(400, "Username is missing!")
    }

    const channel = await User.aggregate([
        {
            $match: {
                userName: userName.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                userName: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel doesnot exists")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "User channel fetched successfully!")
        )

})

const toggleSubscription = asyncHandler(async (req, res) => {
    const { subscribe } = req.body
    const channelId = req.params.channelId // Get the channelId from the params

    // Check if subscribe field is provided in the request body
    if (subscribe === undefined) {
        throw new ApiError(400, "Please provide subscribe: true or subscribe: false in the body.")
    }

    // Check if the logged-in user is trying to subscribe to their own channel
    if (channelId === req.user.userName.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel.")
    }

    // Check if the channel exists
    const channel = await User.findOne({ userName: channelId })
    if (!channel) {
        throw new ApiError(404, "Channel not found.")
    }

    // Handle subscribe: true (Subscribe)
    if (subscribe === true) {
        // Check if the user is already subscribed
        const existingSubscription = await Subscription.findOne({
            subscriber: req.user._id,
            channel: channel._id
        });

        if (existingSubscription) {
            throw new ApiError(400, "You are already subscribed to this channel.");
        }

        // Create a new subscription
        const newSubscription = await Subscription.create({
            subscriber: req.user._id,
            channel: channel._id
        });

        return res.status(201).json(
            new ApiResponse(201, { subscription: newSubscription }, "Successfully subscribed to the channel!")
        );

    } else if (subscribe === false) {
        // Handle subscribe: false (Unsubscribe)
        const existingSubscription = await Subscription.findOne({
            subscriber: req.user._id,
            channel: channel._id
        });

        if (!existingSubscription) {
            throw new ApiError(400, "You are not subscribed to this channel.");
        }

        // Remove the subscription
        await existingSubscription.deleteOne();

        return res.status(200).json(
            new ApiResponse(200, {}, "Successfully unsubscribed from the channel.")
        );
    } else {
        throw new ApiError(400, "Invalid value for subscribe. Use true or false.");
    }
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
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
                                        userName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch History Fetched Successfully"
            )
        )
})

export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeUserPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    toggleSubscription,
    getWatchHistory
}
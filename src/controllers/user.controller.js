import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

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
            $set: {
                refreshToken: undefined
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

    user.passoword = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password Changed Successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(200, req.user, "Current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body
    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email,
            }
        },
        { new: true }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"))
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

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

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

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    return res.
        status(200)
        .json(
            new ApiResponse(200, user, "Cover Image updated successfully!")
        )
})

export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeUserPassword,
    getCurrentUser,
    updateUserAvatar,
    updateUserCoverImage
}
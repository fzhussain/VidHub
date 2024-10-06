import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

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


export { registerUser }
import { Router } from "express";
import { loginUser, logOutUser, registerUser, refreshAccessToken, changeUserPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ])
    , registerUser)

router.route("/login").post(loginUser)

router.get('/channel/:userName', getUserChannelProfile)

// Secured routes
router.route("/logout").post(verifyJWT, logOutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeUserPassword)
router.route("/get-user-details").get(verifyJWT, getCurrentUser)
router.route("/update-account-details").put(verifyJWT, updateAccountDetails)

// Route to update user avatar
router.route("/update-avatar").put(
    verifyJWT,
    upload.single('avatar'),
    updateUserAvatar
)

// Route to update user cover image
router.route("/update-cover-image").put(
    verifyJWT,
    upload.single('coverImage'),
    updateUserCoverImage
)

export default router
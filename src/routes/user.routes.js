import { Router } from "express";
import { loginUser, logOutUser, registerUser, refreshAccessToken, changeUserPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, toggleSubscription, getWatchHistory } from "../controllers/user.controller.js";
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
router.route("/update-account-details").patch(verifyJWT, updateAccountDetails)

// Route to update user avatar
router.route("/update-avatar").patch(
    verifyJWT,
    upload.single('avatar'),
    updateUserAvatar
)

// Route to update user cover image
router.route("/update-cover-image").patch(
    verifyJWT,
    upload.single('coverImage'),
    updateUserCoverImage
)

router.route("/channel/subscribe/:channelId").post(verifyJWT, toggleSubscription)
router.route("/watch-history").get(verifyJWT, getWatchHistory)


export default router
import { Router } from 'express';
import {
    getLikedVideos,
    getLikedTweets,
    getLikedComments,
    toggleCommentLike,
    toggleVideoLike,
    toggleTweetLike,
} from "../controllers/like.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/toggle/like/v/:videoId").post(toggleVideoLike);
router.route("/toggle/like/c/:commentId").post(toggleCommentLike);
router.route("/toggle/like/t/:tweetId").post(toggleTweetLike);
router.route("/liked/videos").get(getLikedVideos);
router.route("/liked/tweets").get(getLikedTweets);
router.route("/liked/comments").get(getLikedComments);

export default router
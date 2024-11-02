import { Router } from 'express';
import {
    toggleVideoDisLike,
    toggleCommentDisLike,
    toggleTweetDisLike,
    getDisLikedVideos,
    getDisLikedTweets,
    getDisLikedComments
} from "../controllers/disLike.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/toggle/disLike/v/:videoId").post(toggleVideoDisLike);
router.route("/toggle/disLike/c/:commentId").post(toggleCommentDisLike);
router.route("/toggle/disLike/t/:tweetId").post(toggleTweetDisLike);
router.route("/disLiked/videos").get(getDisLikedVideos);
router.route("/disLiked/tweets").get(getDisLikedTweets);
router.route("/disLiked/comments").get(getDisLikedComments);

export default router
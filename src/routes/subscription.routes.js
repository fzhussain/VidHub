import { Router } from 'express';
import {
    getSubscribedChannels,
    getChannelSubscribers,
    toggleSubscription,
} from "../controllers/subscription.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
    .route("/c/:channelId")
    .get(getChannelSubscribers)
    .post(toggleSubscription);

router.route("/subscribedChannels").get(getSubscribedChannels);

export default router
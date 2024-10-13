import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

const app = express()

app.use((req, res, next) => {
  const contentLength = req.get('Content-Length');
  console.log(`Incoming request size: ${contentLength} bytes`);
  next();
});

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}))

app.use(express.json({ limit: "16kb" }))

app.use(express.urlencoded({ extended: true, limit: "16kb" }))

app.use(express.static("public"))

app.use(cookieParser())


// Routes import
import userRouter from './routes/user.routes.js'
import healthcheckRouter from "./routes/healthcheck.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"


// Route declaration
app.use("/api/v1/healthcheck", healthcheckRouter)
app.use('/api/v1/users', userRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlist", playlistRouter)
app.use("/api/v1/dashboard", dashboardRouter)


export { app }



/* 
Checking the Incoming Data Size ->
app.use((req, res, next) => {
  const contentLength = req.get('Content-Length');
  console.log(`Incoming request size: ${contentLength} bytes`);
  next();
});

*/
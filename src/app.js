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
import userRouter from './routes/user.route.js'


// Route declaration

app.use('/api/v1/users', userRouter)


export { app }



/* 
Checking the Incoming Data Size ->
app.use((req, res, next) => {
  const contentLength = req.get('Content-Length');
  console.log(`Incoming request size: ${contentLength} bytes`);
  next();
});

*/
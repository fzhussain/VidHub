// require('dotenv').config({ path: './env' })
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: './env'
})

connectDB()
    .then(() => {
        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server is running on port: ${process.env.PORT}`)
        })
            .on("error", (error) => {
                console.log("ERROR ->", error)
                throw error
            })
    })
    .catch((error) => {
        console.log("MONGODB connection failed:", error)
    })








/*
import express from "express";

const app = express()

    ; (async () => {
        try {
            await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
            app.on("error", (error) => 
                console.log("ERROR ->", error)
                throw error
            })
            app.listen(process.env.PORT, () => {
                console.log(`App is listening on port ${process.env.PORT}`)
            })
        } catch (error) {
            console.error("Error ->", error)
            throw error
        }
    })()

*/








/* 
NOTES:
1. Whenever dealing with databases, always wrap them around TRY-CATCH or Promises as error in connection is a very probable case
2. Always think that database is kept in another continent and it can be time consuming -> Always use ASYNC AWAIT

3. 
;(async () => {
  // Your async code here 
})()

Meaning:  IIFE (Immediately Invoked Function Expression)
(async () => {}) -> This part defines an anonymous async arrow function. You can now use await inside this function.
()() ->This part invokes the function immediately after its declaration.
; -> The semicolon before the function is often used to ensure that if this code is placed after another statement (such as another function), it doesn’t cause issues. It prevents syntax errors when the previous line does not end in a semicolon. It's a defensive practice in JavaScript to avoid unintended issues with automatic semicolon insertion (ASI).
*/
import mongoose, { isValidObjectId } from "mongoose"
import { Playlist } from "../models/playlist.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body

    if (!name || !description) {
        throw new ApiError(400, "Name and description are required")
    }
    const existingPlaylist = await Playlist.findOne({ name, owner: req.user._id });
    if (existingPlaylist) {
        throw new ApiError(400, "A playlist with the same name already exists")
    }

    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user._id
    })

    if (!playlist) {
        throw new ApiError(500, "Failed to create playlist")
    }
    return res
        .status(201)
        .json(
            new ApiResponse(201, playlist, "Playlist created successfully")
        )
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params
    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user id")
    }

    const playlists = await Playlist.find({ owner: userId })
    if (!playlists) {
        throw new ApiError(404, "No playlists found")
    }
    return res
        .status(200)
        .json(
            new ApiResponse(200, playlists, "Playlists fetched successfully")
        )
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id")
    }

    const playlist = await Playlist.findById(playlistId)
    if (!playlist) {
        throw new ApiError(404, "No playlist found")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, playlist, "Playlist fetched successfully")
        )
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { videoId } = req.body

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const playlist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $addToSet: {
                videos: videoId,
            },
        },
        {
            new: true,
        }
    )

    if (!playlist)
        throw new ApiError(500, "Error while adding video to playlist");

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isAdded: true, playlist },
                "Video added to playlist successfully"
            )
        )

})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { videoId } = req.body

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "No playlist found")
    }
    if (!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not allowed to remove video from this playlist")
    }

    if (!playlist.videos.includes(videoId)) {
        throw new ApiError(404, "Video not found in playlist")
    }

    playlist.videos.pull(videoId)
    const checkSaved = await playlist.save()


    if (!checkSaved) {
        throw new ApiError(500, "Failed to remove video from playlist")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isSuccess: true, playlist: checkSaved },
                "Video removed from playlist successfully"
            )
        )
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistId")
    }

    const playlist = await Playlist.findById(playlistId)

    if (!playlist) {
        throw new ApiError(404, "No playlist found")
    }

    if (!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not allowed to delete this playlist")
    }

    const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId)

    if (!deletedPlaylist) {
        throw new ApiError(500, "Failed to delete playlist")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, "Playlist deleted successfully")
        )
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlistID")
    }

    if (!name && !description) {
        throw new ApiError(400, "Please provide either a new name or description.");
    }

    // Find the playlist by ID
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "No playlist found");
    }

    // Check if the requesting user is the owner of the playlist
    if (!playlist.owner.equals(req.user._id)) {
        throw new ApiError(403, "You are not allowed to update this playlist");
    }

    // Check if both name and description are the same as the current values
    if ((name && name === playlist.name) && (description && description === playlist.description)) {
        return res.status(200).json(new ApiResponse(200, playlist, "No changes were made. Both name and description are already the same."));
    }

    // Update only the fields that were provided
    if (name) playlist.name = name;
    if (description) playlist.description = description;

    // Save the updated playlist
    const checkUpdated = await playlist.save();
    if (!checkUpdated) {
        throw new ApiError(500, "Failed to update playlist");
    }

    return res.status(200).json(new ApiResponse(200, playlist, "Playlist updated successfully"));

})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
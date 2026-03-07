// backend/src/routes/posts.js
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authenticateToken } = require('../middleware/auth');

// Public routes (no auth required)
router.get('/', postController.getAllPosts);  // Allow public access to see posts
router.get('/search', postController.searchPosts);
router.get('/:id', postController.getPostById);

// Protected routes (require authentication)
router.post('/addpost', authenticateToken, postController.createPost);
router.put('/:id', authenticateToken, postController.updatePost);
router.delete('/:id', authenticateToken, postController.deletePost);

// Comments
router.post('/:id/comment', authenticateToken, postController.addComment);
router.delete('/:postId/comment/:commentId', authenticateToken, postController.deleteComment);
router.post('/:postId/comment/:commentId/like', authenticateToken, postController.toggleCommentLike);

// Likes
router.post('/:id/like', authenticateToken, postController.toggleLike);

// Pinning
router.post('/:id/pin', authenticateToken, postController.togglePinned);

// Event registration
router.post('/:id/register', authenticateToken, postController.registerForEvent);
router.delete('/:id/register', authenticateToken, postController.cancelEventRegistration);

module.exports = router;
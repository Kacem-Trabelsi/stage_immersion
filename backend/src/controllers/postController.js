const Post = require('../models/Post');

const ALLOWED_SOCIAL_ROLES = new Set(['STARTUP', 'EXPERT', 'S2T']);

const canUseSocialFeed = (req) => {
  const role = String(req?.user?.role || '').toUpperCase();
  return ALLOWED_SOCIAL_ROLES.has(role);
};

const getRequestUserId = (req) => String(req?.user?.userId || req?.user?._id || req?.user?.id || '');
const isAdminUser = (req) => String(req?.user?.role || '').toUpperCase() === 'ADMIN';

const rejectForbiddenRole = (res) =>
  res.status(403).json({
    success: false,
    message: 'Only STARTUP, EXPERT and S2T can use social feed actions'
  });

const deriveTitleFromContent = (title, content) => {
  const cleanTitle = String(title || '').trim();
  if (cleanTitle) return cleanTitle;
  const cleanContent = String(content || '').trim();
  if (!cleanContent) return 'Untitled Post';
  return cleanContent.length > 80 ? `${cleanContent.slice(0, 80)}...` : cleanContent;
};

const populatePostQuery = (query) =>
  query
    .populate('author', 'username firstName lastName role avatar profilePhoto')
    .populate('comments.user', 'username firstName lastName role avatar profilePhoto')
    .populate('comments.replies.user', 'username firstName lastName role avatar profilePhoto')
    .populate('eventDetails.registeredParticipants.user', 'username firstName lastName role');

// ➕ Créer un post
exports.createPost = async (req, res) => {
  try {
    if (!canUseSocialFeed(req)) {
      return rejectForbiddenRole(res);
    }

    console.log("req.user:", req.user); 
    console.log("req.user.userId:", req.user?.userId);
    
    const { 
      title, 
      content, 
      type, 
      category, 
      media, 
      tags, 
      eventDetails, 
      attachments,
      isPinned,
      isPrivate,
      targetAudience
    } = req.body;
    
    const normalizedContent = String(content || '').trim();
    if (!normalizedContent) {
      return res.status(400).json({ success: false, message: 'Post content is required' });
    }

    const post = new Post({
      author: req.user.userId,
      title: deriveTitleFromContent(title, normalizedContent),
      content: normalizedContent,
      type,
      category: category || getDefaultCategoryForType(type),
      media,
      tags,
      eventDetails,
      attachments,
      isPinned: isPinned || false,
      isPrivate: isPrivate || false,
      targetAudience: targetAudience || ['ALL']
    });
    
    await post.save();
    const populatedPost = await populatePostQuery(Post.findById(post._id));
    res.status(201).json({ success: true, data: populatedPost });
  } catch (err) {
    console.error("Error creating post:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper to get default category based on type
function getDefaultCategoryForType(type) {
  switch(type) {
    case 'OPPORTUNITY': return 'FUNDING';
    case 'SUCCESS': return 'STARTUP_SUCCESS';
    case 'EVENT': return 'WORKSHOP';
    case 'DISCUSSION':
    default: return 'GENERAL';
  }
}

// 📥 Récupérer tous les posts (fil d'actualité)
exports.getAllPosts = async (req, res) => {
  try {
    const { 
      type, 
      category, 
      author, 
      tag, 
      limit = 20, 
      page = 1, 
      sortBy = 'createdAt',
      sortOrder = -1,
      pinned
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (author) filter.author = author;
    if (tag) filter.tags = { $in: [tag] };

    // Handle pinned posts separately
    let pinnedFilter = {};
    if (pinned === 'true') {
      pinnedFilter.isPinned = true;
    }
    
    // Add audience targeting if we're not showing all posts
    if (req.user && req.user.role) {
      // Only show posts that are either public or targeted to the user's role
      // This is a simplified version - you might want to implement more complex audience targeting
      filter.$or = [
        { targetAudience: 'ALL' },
        { targetAudience: req.user.role.toUpperCase() }
      ];
    }
    
    // Don't show private posts unless they're for the current user
    if (req.user && req.user.userId) {
      filter.$or = filter.$or || [];
      filter.$or.push({ isPrivate: false });
      filter.$or.push({ author: req.user.userId, isPrivate: true });
    } else {
      filter.isPrivate = false;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = parseInt(sortOrder);

    // First get pinned posts
    const pinnedPosts =
      pinned === 'only'
        ? []
        : await populatePostQuery(Post.find({ ...filter, isPinned: true }).sort({ createdAt: -1 }));

    // Then get regular posts
    let regularPosts = [];
    if (pinned !== 'only') {
      regularPosts = await populatePostQuery(
        Post.find({ ...filter, isPinned: false }).skip(skip).limit(parseInt(limit)).sort(sort)
      );
    }

    // Combine pinned and regular posts
    const posts = [...pinnedPosts, ...regularPosts];
    
    // Get total count for pagination
    const total = await Post.countDocuments(filter);
    
    // Increment view count for each post
    // In a real app, you'd probably want to track unique views instead
    for (const post of posts) {
      post.views = (post.views || 0) + 1;
      await post.save();
    }
    
    res.json({ 
      success: true, 
      data: posts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🔍 Search posts
exports.searchPosts = async (req, res) => {
  try {
    const { query, type, category, limit = 20, page = 1 } = req.query;
    
    const filter = {};
    if (query) {
      filter.$text = { $search: query };
    }
    if (type) filter.type = type;
    if (category) filter.category = category;
    
    // Add audience targeting
    if (req.user && req.user.role) {
      filter.$or = [
        { targetAudience: 'ALL' },
        { targetAudience: req.user.role.toUpperCase() }
      ];
    }
    
    // Don't show private posts unless they're for the current user
    if (req.user && req.user.userId) {
      filter.$or = filter.$or || [];
      filter.$or.push({ isPrivate: false });
      filter.$or.push({ author: req.user.userId, isPrivate: true });
    } else {
      filter.isPrivate = false;
    }
    
    const skip = (page - 1) * limit;
    
    const posts = await populatePostQuery(
      Post.find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .sort(query ? { score: { $meta: "textScore" } } : { createdAt: -1 })
    );
      
    const total = await Post.countDocuments(filter);
    
    res.json({ 
      success: true, 
      data: posts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Error searching posts:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📄 Get single post by ID
exports.getPostById = async (req, res) => {
  try {
    const post = await populatePostQuery(Post.findById(req.params.id));
      
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    
    // Increment view count
    post.views = (post.views || 0) + 1;
    await post.save();
    
    res.json({ success: true, data: post });
  } catch (err) {
    console.error("Error fetching post:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✏️ Update post
exports.updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    
    // Check if the user is authorized to update this post
    const requestUserId = getRequestUserId(req);
    if (post.author.toString() !== requestUserId && !isAdminUser(req)) {
      return res.status(403).json({ success: false, message: "Not authorized to update this post" });
    }
    
    const {
      title,
      content,
      type,
      category,
      media,
      tags,
      eventDetails,
      attachments,
      isPinned,
      isPrivate,
      targetAudience
    } = req.body;
    
    // Only update fields that are present in the request
    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    if (type !== undefined) post.type = type;
    if (category !== undefined) post.category = category;
    if (media !== undefined) post.media = media;
    if (tags !== undefined) post.tags = tags;
    if (eventDetails !== undefined) post.eventDetails = eventDetails;
    if (attachments !== undefined) post.attachments = attachments;
    if (isPinned !== undefined) post.isPinned = isPinned;
    if (isPrivate !== undefined) post.isPrivate = isPrivate;
    if (targetAudience !== undefined) post.targetAudience = targetAudience;
    
    await post.save();
    
    res.json({ success: true, data: post });
  } catch (err) {
    console.error("Error updating post:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🗑️ Delete post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    
    // Check if the user is authorized to delete this post
    const requestUserId = getRequestUserId(req);
    if (post.author.toString() !== requestUserId && !isAdminUser(req)) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this post" });
    }
    
    await Post.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 💬 Ajouter un commentaire
exports.addComment = async (req, res) => {
  try {
    if (!canUseSocialFeed(req)) {
      return rejectForbiddenRole(res);
    }

    const { text } = req.body;
    const normalizedText = String(text || '').trim();
    if (!normalizedText) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    
    const newComment = {
      user: req.user.userId,
      text: normalizedText,
      likes: [],
      replies: []
    };
    
    post.comments.push(newComment);
    await post.save();
    
    // Populate the newly added comment with user details for the response
    const populatedPost = await populatePostQuery(Post.findById(post._id));
    
    res.json({ success: true, data: populatedPost });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 🗑️ Delete comment
exports.deleteComment = async (req, res) => {
  try {
    if (!canUseSocialFeed(req)) {
      return rejectForbiddenRole(res);
    }

    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    
    const comment = post.comments.id(commentId);
    
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }
    
    // Check if the user is authorized to delete this comment
    const requestUserId = getRequestUserId(req);
    if (comment.user.toString() !== requestUserId && !isAdminUser(req)) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this comment" });
    }
    
    comment.deleteOne();
    await post.save();
    
    const populatedPost = await populatePostQuery(Post.findById(post._id));
    res.json({ success: true, data: populatedPost });
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ❤️ Liker/unliker un post
exports.toggleLike = async (req, res) => {
  try {
    if (!canUseSocialFeed(req)) {
      return rejectForbiddenRole(res);
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const userId = getRequestUserId(req);
    if (post.likes.some((id) => id.toString() === userId)) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(userId);
    }
    await post.save();
    const populatedPost = await populatePostQuery(Post.findById(post._id));
    res.json({ success: true, data: populatedPost });
  } catch (err) {
    console.error("Error toggling like:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ❤️ Like/unlike a comment
exports.toggleCommentLike = async (req, res) => {
  try {
    if (!canUseSocialFeed(req)) {
      return rejectForbiddenRole(res);
    }

    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    
    const comment = post.comments.id(commentId);
    
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }
    
    const userId = getRequestUserId(req);
    if (comment.likes && comment.likes.some((id) => id.toString() === userId)) {
      comment.likes = comment.likes.filter((id) => id.toString() !== userId);
    } else {
      if (!comment.likes) comment.likes = [];
      comment.likes.push(userId);
    }
    
    await post.save();
    const populatedPost = await populatePostQuery(Post.findById(post._id));
    res.json({ success: true, data: populatedPost });
  } catch (err) {
    console.error("Error toggling comment like:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 💬 Reply to a comment
exports.addReply = async (req, res) => {
  try {
    if (!canUseSocialFeed(req)) {
      return rejectForbiddenRole(res);
    }

    const { postId, commentId } = req.params;
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ success: false, message: 'Reply text is required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    comment.replies.push({
      user: req.user.userId,
      text,
      likes: []
    });
    await post.save();

    const populatedPost = await populatePostQuery(Post.findById(post._id));
    return res.json({ success: true, data: populatedPost });
  } catch (err) {
    console.error('Error adding reply:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 🗑️ Delete reply
exports.deleteReply = async (req, res) => {
  try {
    if (!canUseSocialFeed(req)) {
      return rejectForbiddenRole(res);
    }

    const { postId, commentId, replyId } = req.params;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }

    const requestUserId = getRequestUserId(req);
    if (reply.user.toString() !== requestUserId && !isAdminUser(req)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this reply' });
    }

    reply.deleteOne();
    await post.save();

    const populatedPost = await populatePostQuery(Post.findById(post._id));
    return res.json({ success: true, data: populatedPost });
  } catch (err) {
    console.error('Error deleting reply:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ❤️ Like/unlike reply
exports.toggleReplyLike = async (req, res) => {
  try {
    if (!canUseSocialFeed(req)) {
      return rejectForbiddenRole(res);
    }

    const { postId, commentId, replyId } = req.params;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }

    const userId = getRequestUserId(req);
    if (reply.likes && reply.likes.some((id) => id.toString() === userId)) {
      reply.likes = reply.likes.filter((id) => id.toString() !== userId);
    } else {
      if (!reply.likes) reply.likes = [];
      reply.likes.push(userId);
    }

    await post.save();
    const populatedPost = await populatePostQuery(Post.findById(post._id));
    return res.json({ success: true, data: populatedPost });
  } catch (err) {
    console.error('Error toggling reply like:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 📌 Toggle pin status
exports.togglePinned = async (req, res) => {
  try {
    // Only admins can pin posts
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Only admins can pin posts" });
    }
    
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    
    post.isPinned = !post.isPinned;
    await post.save();
    
    res.json({ success: true, data: post });
  } catch (err) {
    console.error("Error toggling pin status:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📅 Event Registration
exports.registerForEvent = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    
    // Check if this is an event post
    if (post.type !== 'EVENT') {
      return res.status(400).json({ success: false, message: "This post is not an event" });
    }
    
    // Check if the event has registration capacity
    if (post.eventDetails && 
        post.eventDetails.maxParticipants && 
        post.eventDetails.registeredParticipants.length >= post.eventDetails.maxParticipants) {
      return res.status(400).json({ success: false, message: "Event is at full capacity" });
    }
    
    // Check if user is already registered
    const userId = req.user.userId;
    if (post.eventDetails && 
        post.eventDetails.registeredParticipants && 
        post.eventDetails.registeredParticipants.some(p => {
          // Check both forms - p.user might be ObjectId or string
          const participantUserId = typeof p.user === 'object' ? p.user.toString() : p.user;
          const requestUserId = userId.toString();
          return participantUserId === requestUserId;
        })) {
      return res.status(400).json({ success: false, message: "You are already registered for this event" });
    }
    
    // Initialize eventDetails if it doesn't exist
    if (!post.eventDetails) {
      post.eventDetails = {
        registeredParticipants: []
      };
    }
    
    // Initialize registeredParticipants if it doesn't exist
    if (!post.eventDetails.registeredParticipants) {
      post.eventDetails.registeredParticipants = [];
    }
    
    // Register the user
    post.eventDetails.registeredParticipants.push({
      user: userId,
      registrationDate: new Date()
    });
    
    await post.save();
    
    // Populate for response
    const populatedPost = await Post.findById(post._id)
      .populate('author', 'username firstName lastName role')
      .populate('eventDetails.registeredParticipants.user', 'username firstName lastName');
    
    res.json({ success: true, data: populatedPost });
  } catch (err) {
    console.error("Error registering for event:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// 📅 Cancel Event Registration
exports.cancelEventRegistration = async (req, res) => {
  try {
    console.log("Cancel Registration: Post ID received:", req.params.id);
    console.log("Cancel Registration: User making request:", req.user);

    const post = await Post.findById(req.params.id);
    
    if (!post) {
      console.log("Cancel Registration Error: Post not found");
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    
    console.log("Cancel Registration: Post found:", { 
      id: post._id, 
      type: post.type,
      title: post.title,
      eventDetails: post.eventDetails ? {
        hasParticipants: !!post.eventDetails.registeredParticipants,
        participantsCount: post.eventDetails.registeredParticipants ? 
          post.eventDetails.registeredParticipants.length : 0
      } : 'No event details'
    });
    
    // Check if this is an event post
    if (post.type !== 'EVENT') {
      console.log(`Cancel Registration Error: Post type is ${post.type}, not EVENT`);
      return res.status(400).json({ success: false, message: "This post is not an event" });
    }
    
    // Check if user is registered
    const userId = req.user.userId;
    console.log(`Cancel Registration: Checking if user ${userId} is registered`);
    
    // Debug all registered participants before cancellation
    console.log("BEFORE CANCELLATION - Post ID:", post._id);
    console.log("BEFORE CANCELLATION - Post title:", post.title);
    
    if (post.eventDetails && post.eventDetails.registeredParticipants) {
      console.log("BEFORE CANCELLATION - All participants:", post.eventDetails.registeredParticipants);
      console.log("Registered participants:", post.eventDetails.registeredParticipants.map(p => ({
        user: typeof p.user === 'object' ? p.user.toString() : p.user,
        userId: userId,
        match: (typeof p.user === 'object' ? p.user.toString() : p.user) === userId.toString()
      })));
    }
    
    if (!post.eventDetails || 
        !post.eventDetails.registeredParticipants || 
        !post.eventDetails.registeredParticipants.some(p => {
          // Check both forms - p.user might be ObjectId or string
          const participantUserId = typeof p.user === 'object' ? p.user.toString() : p.user;
          const requestUserId = userId.toString();
          return participantUserId === requestUserId;
        })) {
      console.log("Cancel Registration Error: User not registered for this event");
      return res.status(400).json({ success: false, message: "You are not registered for this event" });
    }
    
    // Remove registration
    console.log("Cancel Registration: Removing user registration");
    
    // Log before the filter operation for debugging
    console.log("Before filtering participants:", post.eventDetails.registeredParticipants.length);
    
    // Create a new array with the filtered participants
    const filteredParticipants = post.eventDetails.registeredParticipants.filter(p => {
      // Convert both to strings for comparison to handle different object types
      const participantId = typeof p.user === 'object' ? p.user.toString() : p.user;
      const currentUserId = userId.toString();
      const shouldKeep = participantId !== currentUserId;
      
      // Log each comparison to understand what's happening
      console.log(`Comparing participant ${participantId} with user ${currentUserId}: keep=${shouldKeep}`);
      
      return shouldKeep;
    });
    
    // Log the results of the filtering
    console.log(`Filtering reduced participants from ${post.eventDetails.registeredParticipants.length} to ${filteredParticipants.length}`);
    
    // Replace the array with the filtered version
    post.eventDetails.registeredParticipants = filteredParticipants;
    
    // Use findByIdAndUpdate to ensure it gets updated in the database
    await Post.findByIdAndUpdate(
      post._id,
      { 'eventDetails.registeredParticipants': post.eventDetails.registeredParticipants },
      { new: true }
    );
    console.log("Cancel Registration: Registration removed successfully");
    
    // Explicitly reload the post to ensure we have the latest data
    const updatedPost = await Post.findById(req.params.id).lean();
    console.log("AFTER CANCELLATION - Participants count:", 
      updatedPost.eventDetails?.registeredParticipants?.length || 0);
    console.log("AFTER CANCELLATION - Participants:", 
      JSON.stringify(updatedPost.eventDetails?.registeredParticipants || []));
    console.log("VERIFICATION - User ID removed:", userId);
    
    // Populate for response
    const populatedPost = await Post.findById(post._id)
      .populate('author', 'username firstName lastName role')
      .populate('eventDetails.registeredParticipants.user', 'username firstName lastName');
    
    // Add debugging info to response
    res.json({ 
      success: true, 
      data: populatedPost,
      debug: {
        userId: userId,
        originalParticipantCount: updatedPost.eventDetails?.registeredParticipants?.length || 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error("Error cancelling event registration:", err);
    console.error("Full error object:", JSON.stringify(err, null, 2));
    res.status(500).json({ success: false, message: err.message || "Failed to cancel registration" });
  }
};
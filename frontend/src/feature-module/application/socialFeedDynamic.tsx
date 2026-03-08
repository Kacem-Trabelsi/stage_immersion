import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { all_routes } from "../router/all_routes";
import { API_BASE_URL } from "../../services/apiService";
import { useAuth } from "../../contexts/AuthContext";
import companyProfileService from "../../services/companyProfileService";
import { uploadFiles } from "../../services/uploadService";
import {
  addComment,
  addReply,
  createPost,
  deleteComment,
  deletePost,
  deleteReply,
  getAllPosts,
  updatePost,
  toggleCommentLike,
  toggleLike,
  toggleReplyLike,
} from "../../services/posteservice";

type AllowedRole = "STARTUP" | "EXPERT" | "S2T";

type FeedUser = {
  _id?: string;
  id?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  role?: string;
  avatar?: string;
  profilePhoto?: string;
};

type FeedReply = {
  _id: string;
  user?: FeedUser;
  text: string;
  createdAt?: string;
  likes?: string[];
};

type FeedComment = {
  _id: string;
  user?: FeedUser;
  text: string;
  createdAt?: string;
  likes?: string[];
  replies?: FeedReply[];
};

type FeedPost = {
  _id: string;
  author?: FeedUser;
  title?: string;
  content?: string;
  createdAt?: string;
  likes?: string[];
  comments?: FeedComment[];
  isPrivate?: boolean;
  media?: string[];
  attachments?: Array<{
    name?: string;
    fileUrl?: string;
    fileType?: string;
    fileSize?: number;
  }>;
};

type StartupProfileMeta = {
  userId: string;
  companyName?: string;
  logo?: string;
};

const SocialFeedDynamic = () => {
  const routes = all_routes;
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [creatingPost, setCreatingPost] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [startupProfiles, setStartupProfiles] = useState<Record<string, StartupProfileMeta>>({});
  const [editingPostId, setEditingPostId] = useState("");
  const [editPostTitle, setEditPostTitle] = useState("");
  const [editPostContent, setEditPostContent] = useState("");
  const [editPostPrivate, setEditPostPrivate] = useState(false);
  const [savingPostId, setSavingPostId] = useState("");
  const [deletingPostId, setDeletingPostId] = useState("");
  const [actionMenuPostId, setActionMenuPostId] = useState("");

  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostPrivate, setNewPostPrivate] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<Array<{ src: string }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const allowed = useMemo(() => {
    return user?.role === "STARTUP" || user?.role === "EXPERT" || user?.role === "S2T";
  }, [user?.role]);

  const currentUserId = String((user as any)?._id || (user as any)?.id || (user as any)?.userId || "");

  const getEntityId = (value: any) =>
    String(value?._id || value?.id || value?.userId || value || "");

  const getStartupMeta = (u?: FeedUser) => {
    const uid = getEntityId(u);
    if (!uid) return null;
    return startupProfiles[uid] || null;
  };

  const resolveAvatar = (u?: FeedUser) => {
    const startup = getStartupMeta(u);
    const raw = String(startup?.logo || u?.avatar || u?.profilePhoto || "").trim();
    if (!raw) return "/assets/img/users/user-49.jpg";
    if (raw.startsWith("/data:image/")) return raw.slice(1);
    if (raw.startsWith("data:")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return encodeURI(raw);
    if (raw.startsWith("/uploads/")) return encodeURI(`${API_BASE_URL}${raw}`);
    if (raw.startsWith("uploads/")) return encodeURI(`${API_BASE_URL}/${raw}`);
    if (raw.startsWith("assets/")) return `/${raw}`;
    return encodeURI(raw);
  };

  const displayName = (u?: FeedUser) => {
    const startup = getStartupMeta(u);
    if (startup?.companyName) return startup.companyName;
    if (!u) return "Unknown";
    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
    return fullName || u.username || u.email || "Unknown";
  };

  const formatTime = (dateLike?: string) => {
    if (!dateLike) return "";
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toAbsoluteUrl = (pathLike?: string) => {
    const value = String(pathLike || "").trim();
    if (!value) return "";
    return value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `${API_BASE_URL}${value}`;
  };

  const isMediaFile = (fileType?: string, fileUrl?: string) => {
    const type = String(fileType || "").toLowerCase();
    const url = String(fileUrl || "").toLowerCase();
    return (
      type.startsWith("image/") ||
      type.startsWith("video/") ||
      [".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".webm", ".mov", ".m4v"].some((ext) =>
        url.includes(ext)
      )
    );
  };

  const isVideoFile = (fileType?: string, fileUrl?: string) => {
    const type = String(fileType || "").toLowerCase();
    const url = String(fileUrl || "").toLowerCase();
    return (
      type.startsWith("video/") ||
      [".mp4", ".webm", ".mov", ".m4v"].some((ext) => url.includes(ext))
    );
  };

  const normalizeFileName = (name?: string) => {
    let result = String(name || "Attachment").trim();
    try {
      result = decodeURIComponent(result);
    } catch {
      // ignore invalid URI sequences
    }
    if (/[ÃÄÂÅ]/.test(result)) {
      try {
        const bytes = Uint8Array.from(Array.from(result).map((ch) => ch.charCodeAt(0)));
        const repaired = new TextDecoder("utf-8").decode(bytes);
        if (repaired && !/[ÃÄÂÅ]/.test(repaired)) {
          result = repaired;
        }
      } catch {
        // keep original
      }
    }
    return result;
  };

  const getFileIcon = (fileType?: string, fileUrl?: string) => {
    const type = String(fileType || "").toLowerCase();
    const url = String(fileUrl || "").toLowerCase();
    if (type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".webp"].some((e) => url.includes(e))) {
      return "ti ti-photo";
    }
    if (type.startsWith("video/") || [".mp4", ".webm", ".mov", ".m4v"].some((e) => url.includes(e))) {
      return "ti ti-video";
    }
    if (type.includes("pdf") || url.includes(".pdf")) {
      return "ti ti-file-type-pdf";
    }
    if (type.includes("word") || [".doc", ".docx"].some((e) => url.includes(e))) {
      return "ti ti-file-type-doc";
    }
    if (type.includes("excel") || [".xls", ".xlsx"].some((e) => url.includes(e))) {
      return "ti ti-file-type-xls";
    }
    return "ti ti-paperclip";
  };

  const formatFileSize = (size?: number) => {
    const bytes = Number(size || 0);
    if (!bytes || Number.isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const updatePostInState = (updatedPost?: FeedPost) => {
    if (!updatedPost?._id) return;
    setPosts((prev) => prev.map((post) => (post._id === updatedPost._id ? updatedPost : post)));
  };

  const loadStartupProfiles = async () => {
    try {
      const res = await companyProfileService.getAllCompanyProfiles();
      const list = Array.isArray(res?.data) ? res.data : [];
      const map: Record<string, StartupProfileMeta> = {};
      list.forEach((profile: any) => {
        const uid = getEntityId(profile?.userId);
        if (!uid) return;
        map[uid] = {
          userId: uid,
          companyName: profile?.companyName || "",
          logo: profile?.logo || "",
        };
      });
      setStartupProfiles(map);
    } catch {
      setStartupProfiles({});
    }
  };

  const loadPosts = async () => {
    setLoadingPosts(true);
    setError("");
    try {
      const res = await getAllPosts({ limit: 50, page: 1 });
      setPosts(Array.isArray(res?.data) ? res.data : []);
    } catch (e: any) {
      setPosts([]);
      setError(e?.message || "Failed to load feed");
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    loadStartupProfiles();
    loadPosts();
  }, [allowed]);

  useEffect(() => {
    if (!actionMenuPostId) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".sf-post-actions")) {
        setActionMenuPostId("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [actionMenuPostId]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newPostContent.trim();
    const selectedFiles = [...imageFiles, ...videoFiles, ...docFiles];
    if (!content && selectedFiles.length === 0) return;
    setCreatingPost(true);
    setActionError("");
    try {
      let uploadedFiles: Array<{
        fileUrl?: string;
        fileName?: string;
        fileType?: string;
        fileSize?: number;
      }> = [];

      if (selectedFiles.length > 0) {
        const uploadRes = await uploadFiles(selectedFiles, "posts");
        uploadedFiles = Array.isArray(uploadRes?.data?.files) ? uploadRes.data.files : [];
      }

      const media = uploadedFiles
        .filter((f) => String(f?.fileType || "").startsWith("image/") || String(f?.fileType || "").startsWith("video/"))
        .map((f) => String(f?.fileUrl || ""))
        .filter(Boolean);

      const attachments = uploadedFiles
        .map((f) => ({
          name: f?.fileName || "Attachment",
          fileUrl: f?.fileUrl || "",
          fileType: f?.fileType || "",
          fileSize: Number(f?.fileSize || 0),
        }))
        .filter((f) => !!f.fileUrl);

      const payload = {
        title: newPostTitle.trim(),
        content: content || "Shared attachments",
        type: "DISCUSSION",
        category: "GENERAL",
        isPrivate: newPostPrivate,
        targetAudience: ["ALL"],
        media,
        attachments,
      };
      const res = await createPost(payload);
      if (res?.data?._id) {
        setPosts((prev) => [res.data, ...prev]);
        setNewPostTitle("");
        setNewPostContent("");
        setNewPostPrivate(false);
        setImageFiles([]);
        setVideoFiles([]);
        setDocFiles([]);
      } else {
        await loadPosts();
      }
    } catch (e: any) {
      setActionError(e?.message || "Failed to publish post");
    } finally {
      setCreatingPost(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    setActionError("");
    try {
      const res = await toggleLike(postId);
      updatePostInState(res?.data);
    } catch (e: any) {
      setActionError(e?.message || "Failed to react to post");
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = String(commentDrafts[postId] || "").trim();
    if (!text) return;
    setActionError("");
    try {
      const res = await addComment(postId, { text });
      updatePostInState(res?.data);
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    } catch (e: any) {
      setActionError(e?.message || "Failed to add comment");
    }
  };

  const handleToggleCommentLike = async (postId: string, commentId: string) => {
    setActionError("");
    try {
      const res = await toggleCommentLike(postId, commentId);
      updatePostInState(res?.data);
    } catch (e: any) {
      setActionError(e?.message || "Failed to react to comment");
    }
  };

  const handleAddReply = async (postId: string, commentId: string) => {
    const key = `${postId}:${commentId}`;
    const text = String(replyDrafts[key] || "").trim();
    if (!text) return;
    setActionError("");
    try {
      const res = await addReply(postId, commentId, { text });
      updatePostInState(res?.data);
      setReplyDrafts((prev) => ({ ...prev, [key]: "" }));
      setReplyOpen((prev) => ({ ...prev, [key]: false }));
    } catch (e: any) {
      setActionError(e?.message || "Failed to add reply");
    }
  };

  const handleToggleReplyLike = async (postId: string, commentId: string, replyId: string) => {
    setActionError("");
    try {
      const res = await toggleReplyLike(postId, commentId, replyId);
      updatePostInState(res?.data);
    } catch (e: any) {
      setActionError(e?.message || "Failed to react to reply");
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    setActionError("");
    try {
      const res = await deleteComment(postId, commentId);
      updatePostInState(res?.data);
    } catch (e: any) {
      setActionError(e?.message || "Failed to delete comment");
    }
  };

  const handleDeleteReply = async (postId: string, commentId: string, replyId: string) => {
    setActionError("");
    try {
      const res = await deleteReply(postId, commentId, replyId);
      updatePostInState(res?.data);
    } catch (e: any) {
      setActionError(e?.message || "Failed to delete reply");
    }
  };

  const handleStartEditPost = (post: FeedPost) => {
    setActionError("");
    setEditingPostId(post._id);
    setEditPostTitle(String(post.title || ""));
    setEditPostContent(String(post.content || ""));
    setEditPostPrivate(!!post.isPrivate);
  };

  const handleCancelEditPost = () => {
    setEditingPostId("");
    setEditPostTitle("");
    setEditPostContent("");
    setEditPostPrivate(false);
  };

  const handleSavePostEdit = async (postId: string) => {
    const nextContent = editPostContent.trim();
    if (!nextContent) {
      setActionError("Post content is required");
      return;
    }
    setActionError("");
    setSavingPostId(postId);
    try {
      await updatePost(postId, {
        title: editPostTitle.trim(),
        content: nextContent,
        isPrivate: editPostPrivate,
      });
      handleCancelEditPost();
      await loadPosts();
    } catch (e: any) {
      setActionError(e?.message || "Failed to update post");
    } finally {
      setSavingPostId("");
    }
  };

  const handleDeletePost = async (postId: string) => {
    const shouldDelete = window.confirm("Delete this post?");
    if (!shouldDelete) return;
    setActionError("");
    setDeletingPostId(postId);
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((post) => post._id !== postId));
      if (editingPostId === postId) {
        handleCancelEditPost();
      }
    } catch (e: any) {
      setActionError(e?.message || "Failed to delete post");
    } finally {
      setDeletingPostId("");
    }
  };

  const togglePostMenu = (postId: string) => {
    setActionMenuPostId((prev) => (prev === postId ? "" : postId));
  };

  if (loading) return null;
  if (!allowed) return <Navigate to={routes.unauthorized} replace />;

  return (
    <div className="page-wrapper">
      <div className="content">
        <style>{`
          .sf-header {
            background: linear-gradient(135deg, #f8fbff 0%, #f3f7ff 45%, #eef3ff 100%);
            border: 1px solid #e8eefc;
            border-radius: 12px;
            padding: 14px 16px;
          }
          .sf-composer-card {
            border: 1px solid #eceff5;
            border-radius: 14px;
            box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
          }
          .sf-post-card {
            border: 1px solid #eceff5;
            border-radius: 14px;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
            transition: transform 0.18s ease, box-shadow 0.18s ease;
          }
          .sf-post-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
          }
          .sf-meta-dot {
            width: 4px;
            height: 4px;
            border-radius: 999px;
            background: #94a3b8;
            display: inline-block;
            margin: 0 6px;
          }
          .sf-action-pill {
            border: 1px solid #e5e7eb;
            background: #fff;
            border-radius: 999px;
            padding: 5px 12px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #334155;
            font-size: 12px;
            font-weight: 500;
          }
          .sf-comment-box {
            border: 1px solid #e5e7eb;
            border-radius: 999px;
            padding-left: 14px;
            padding-right: 14px;
            height: 40px;
          }
          .sf-section-title {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 6px;
            font-weight: 600;
          }
          .sf-media-card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #f8fafc;
            overflow: hidden;
            height: 340px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .sf-media-card-single {
            height: 420px;
          }
          .sf-media-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            display: block;
          }
          .sf-media-card video {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #0f172a;
            display: block;
          }
          .sf-post-actions {
            position: relative;
          }
          .sf-post-actions-menu {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            min-width: 160px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
            padding: 6px;
            z-index: 30;
          }
          .sf-post-actions-menu button {
            width: 100%;
            text-align: left;
            border: 0;
            background: transparent;
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 13px;
            color: #334155;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .sf-post-actions-menu button:hover {
            background: #f8fafc;
          }
          .sf-post-actions-menu .danger {
            color: #dc2626;
          }
        `}</style>
        <Lightbox open={lightboxOpen} close={() => setLightboxOpen(false)} slides={lightboxSlides} index={lightboxIndex} />
        <div className="sf-header d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="mb-0">Social Feed</h4>
            <p className="mb-0 text-muted fs-13">Share updates, react, comment and reply in real time.</p>
          </div>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={loadPosts}>
            Refresh
          </button>
        </div>

        <div className="card mb-4 sf-composer-card">
          <div className="card-body">
            <form onSubmit={handleCreatePost}>
              <div className="mb-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Post title (optional)"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                />
              </div>
              <div className="mb-2">
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Share an update with STARTUP / EXPERT / S2T..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                />
              </div>
              <div className="row g-2 mb-2">
                <div className="col-md-4">
                  <label className="sf-section-title">Photos</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    multiple
                    onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                  />
                  {imageFiles.length > 0 && (
                    <small className="text-muted d-block mt-1">{imageFiles.length} image(s) selected</small>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="sf-section-title">Videos</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="video/*"
                    multiple
                    onChange={(e) => setVideoFiles(Array.from(e.target.files || []))}
                  />
                  {videoFiles.length > 0 && (
                    <small className="text-muted d-block mt-1">{videoFiles.length} video(s) selected</small>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="sf-section-title">Files</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    multiple
                    onChange={(e) => setDocFiles(Array.from(e.target.files || []))}
                  />
                  {docFiles.length > 0 && (
                    <small className="text-muted d-block mt-1">{docFiles.length} file(s) selected</small>
                  )}
                </div>
              </div>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <label className="d-inline-flex align-items-center gap-2 mb-0">
                  <input
                    type="checkbox"
                    checked={newPostPrivate}
                    onChange={(e) => setNewPostPrivate(e.target.checked)}
                  />
                  Private post
                </label>
                <button type="submit" className="btn btn-primary" disabled={creatingPost}>
                  {creatingPost ? "Publishing..." : "Publish Post"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {actionError && (
          <div className="alert alert-danger py-2 mb-3" role="alert">
            {actionError}
          </div>
        )}

        {loadingPosts && <div className="text-muted">Loading posts...</div>}
        {!loadingPosts && error && <div className="alert alert-danger py-2">{error}</div>}
        {!loadingPosts && !error && posts.length === 0 && (
          <div className="text-muted">No posts yet. Be the first to publish.</div>
        )}

        {!loadingPosts &&
          !error &&
          posts.map((post) => {
            const postLiked = Array.isArray(post.likes) && post.likes.some((id) => String(id) === currentUserId);
            const canManagePost = getEntityId(post.author) === currentUserId;
            const isEditingThisPost = editingPostId === post._id;
            const comments = Array.isArray(post.comments) ? post.comments : [];
            const attachments = Array.isArray(post.attachments) ? post.attachments : [];
            const mediaFromPost = Array.isArray(post.media) ? post.media.filter(Boolean) : [];
            const mediaFromAttachments = attachments
              .filter((f) => isMediaFile(f?.fileType, f?.fileUrl))
              .map((f) => String(f?.fileUrl || ""))
              .filter(Boolean);
            const mediaUrls = Array.from(new Set([...mediaFromPost, ...mediaFromAttachments]));
            const imageUrls = mediaUrls.filter((u) => !isVideoFile(undefined, u));
            const nonMediaAttachments = attachments.filter((f) => !isMediaFile(f?.fileType, f?.fileUrl));
            return (
              <div className="card mb-3 sf-post-card" key={post._id}>
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div className="d-flex align-items-center">
                      <span className="avatar avatar-md me-2">
                        <img
                          src={resolveAvatar(post.author)}
                          alt="author"
                          className="rounded-circle w-100 h-100 object-fit-cover"
                          onError={(ev) => {
                            ev.currentTarget.src = "/assets/img/users/user-49.jpg";
                          }}
                        />
                      </span>
                      <div>
                        <h6 className="mb-0">{displayName(post.author)}</h6>
                        <small className="text-muted d-flex align-items-center">
                          {formatTime(post.createdAt)}
                          {post?.author?.role && (
                            <>
                              <span className="sf-meta-dot" />
                              {post.author.role}
                            </>
                          )}
                        </small>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {post.isPrivate && <span className="badge bg-warning-transparent">Private</span>}
                      {canManagePost && !isEditingThisPost && (
                        <div className="sf-post-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-light rounded-circle"
                            onClick={() => togglePostMenu(post._id)}
                            aria-label="Post actions"
                          >
                            <i className="ti ti-dots-vertical" />
                          </button>
                          {actionMenuPostId === post._id && (
                            <div className="sf-post-actions-menu">
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuPostId("");
                                  handleStartEditPost(post);
                                }}
                              >
                                <i className="ti ti-edit" />
                                Edit post
                              </button>
                              <button
                                type="button"
                                className="danger"
                                disabled={deletingPostId === post._id}
                                onClick={() => {
                                  setActionMenuPostId("");
                                  handleDeletePost(post._id);
                                }}
                              >
                                <i className="ti ti-trash" />
                                {deletingPostId === post._id ? "Deleting..." : "Delete post"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditingThisPost ? (
                    <div className="mb-3 border rounded p-3 bg-light">
                      <div className="mb-2">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Post title (optional)"
                          value={editPostTitle}
                          onChange={(e) => setEditPostTitle(e.target.value)}
                        />
                      </div>
                      <div className="mb-2">
                        <textarea
                          className="form-control"
                          rows={3}
                          placeholder="Update your post..."
                          value={editPostContent}
                          onChange={(e) => setEditPostContent(e.target.value)}
                        />
                      </div>
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <label className="d-inline-flex align-items-center gap-2 mb-0">
                          <input
                            type="checkbox"
                            checked={editPostPrivate}
                            onChange={(e) => setEditPostPrivate(e.target.checked)}
                          />
                          Private post
                        </label>
                        <div className="d-flex align-items-center gap-2">
                          <button type="button" className="btn btn-sm btn-light" onClick={handleCancelEditPost}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={savingPostId === post._id}
                            onClick={() => handleSavePostEdit(post._id)}
                          >
                            {savingPostId === post._id ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.title && <h6 className="mb-1">{post.title}</h6>}
                      <p className="mb-2 text-dark">{post.content}</p>
                    </>
                  )}

                  {mediaUrls.length > 0 && (
                    <div className="mb-3">
                      <div className="row g-2">
                        {mediaUrls.map((url, idx) => {
                          const mediaUrl = String(url || "");
                          const fullUrl = toAbsoluteUrl(mediaUrl);
                          const isVideo = isVideoFile(undefined, mediaUrl);
                          return (
                            <div
                              className={mediaUrls.length === 1 ? "col-md-12" : "col-md-6"}
                              key={`${post._id}-media-${idx}`}
                            >
                              {isVideo ? (
                                <div className={`sf-media-card ${mediaUrls.length === 1 ? "sf-media-card-single" : ""}`}>
                                  <video controls preload="metadata">
                                    <source src={fullUrl} />
                                  </video>
                                </div>
                              ) : (
                                <div className={`sf-media-card ${mediaUrls.length === 1 ? "sf-media-card-single" : ""}`}>
                                  <img
                                    src={fullUrl}
                                    alt="post-media"
                                    style={{ cursor: "zoom-in" }}
                                    onClick={() => {
                                      const slides = imageUrls.map((img) => ({ src: toAbsoluteUrl(img) }));
                                      const clickedIndex = imageUrls.findIndex((img) => img === mediaUrl);
                                      setLightboxSlides(slides);
                                      setLightboxIndex(clickedIndex >= 0 ? clickedIndex : 0);
                                      setLightboxOpen(true);
                                    }}
                                    onError={(ev) => {
                                      ev.currentTarget.style.display = "none";
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {nonMediaAttachments.length > 0 && (
                    <div className="mb-3">
                      <h6 className="fs-13 mb-2">Attachments</h6>
                      <div className="d-flex flex-column gap-2">
                        {nonMediaAttachments.map((file, idx) => {
                          const fileUrl = String(file?.fileUrl || "");
                          if (!fileUrl) return null;
                          const fullUrl = toAbsoluteUrl(fileUrl);
                          return (
                            <a
                              key={`${post._id}-attachment-${idx}`}
                              href={fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="border rounded p-2 d-flex align-items-center text-dark"
                            >
                              <i className={`${getFileIcon(file?.fileType, file?.fileUrl)} fs-16 me-2 text-primary`} />
                              <div className="d-flex align-items-center justify-content-between w-100 gap-2">
                                <span className="text-truncate">{normalizeFileName(file?.name || `Attachment ${idx + 1}`)}</span>
                                <small className="text-muted flex-shrink-0">{formatFileSize(file?.fileSize)}</small>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                    <button
                      type="button"
                      className={`btn btn-sm ${postLiked ? "btn-primary" : "btn-light"} rounded-pill px-3`}
                      onClick={() => handleToggleLike(post._id)}
                    >
                      <i className="ti ti-heart me-1" />
                      {Array.isArray(post.likes) ? post.likes.length : 0}
                    </button>
                    <span className="sf-action-pill">
                      <i className="ti ti-message me-1" />
                      {comments.length} comments
                    </span>
                    {mediaUrls.length > 0 && (
                      <span className="sf-action-pill">
                        <i className="ti ti-photo me-1" />
                        {mediaUrls.length} media
                      </span>
                    )}
                    {nonMediaAttachments.length > 0 && (
                      <span className="sf-action-pill">
                        <i className="ti ti-paperclip me-1" />
                        {nonMediaAttachments.length} files
                      </span>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        className="form-control sf-comment-box"
                        placeholder="Write a comment..."
                        value={commentDrafts[post._id] || ""}
                        onChange={(e) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [post._id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary rounded-pill px-3"
                        onClick={() => handleAddComment(post._id)}
                      >
                        Comment
                      </button>
                    </div>
                  </div>

                  {comments.map((comment) => {
                    const commentLiked =
                      Array.isArray(comment.likes) &&
                      comment.likes.some((id) => String(id) === currentUserId);
                    const canDeleteComment = getEntityId(comment.user) === currentUserId;
                    const commentKey = `${post._id}:${comment._id}`;
                    const replies = Array.isArray(comment.replies) ? comment.replies : [];
                    return (
                      <div className="border rounded p-2 mb-2" key={comment._id}>
                        <div className="d-flex align-items-start justify-content-between">
                          <div className="d-flex">
                            <span className="avatar avatar-sm me-2">
                              <img
                                src={resolveAvatar(comment.user)}
                                alt="comment-user"
                                className="rounded-circle w-100 h-100 object-fit-cover"
                                onError={(ev) => {
                                  ev.currentTarget.src = "/assets/img/users/user-49.jpg";
                                }}
                              />
                            </span>
                            <div>
                              <h6 className="mb-0 fs-14">{displayName(comment.user)}</h6>
                              <small className="text-muted">{formatTime(comment.createdAt)}</small>
                              <p className="mb-1 mt-1">{comment.text}</p>
                              <div className="d-flex align-items-center gap-2">
                                <button
                                  type="button"
                                  className={`btn btn-xs ${commentLiked ? "btn-primary" : "btn-light"}`}
                                  onClick={() => handleToggleCommentLike(post._id, comment._id)}
                                >
                                  Like ({Array.isArray(comment.likes) ? comment.likes.length : 0})
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-light"
                                  onClick={() =>
                                    setReplyOpen((prev) => ({ ...prev, [commentKey]: !prev[commentKey] }))
                                  }
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          </div>
                          {canDeleteComment && (
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-danger"
                              onClick={() => handleDeleteComment(post._id, comment._id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        {replyOpen[commentKey] && (
                          <div className="d-flex align-items-center gap-2 mt-2 ms-5">
                            <input
                              className="form-control form-control-sm"
                              placeholder="Write a reply..."
                              value={replyDrafts[commentKey] || ""}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [commentKey]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleAddReply(post._id, comment._id)}
                            >
                              Send
                            </button>
                          </div>
                        )}

                        {replies.length > 0 && (
                          <div className="mt-2 ms-5">
                            {replies.map((reply) => {
                              const replyLiked =
                                Array.isArray(reply.likes) &&
                                reply.likes.some((id) => String(id) === currentUserId);
                              const canDeleteReply = getEntityId(reply.user) === currentUserId;
                              return (
                                <div className="border rounded p-2 mb-2 bg-light" key={reply._id}>
                                  <div className="d-flex align-items-start justify-content-between">
                                    <div>
                                      <h6 className="mb-0 fs-13">{displayName(reply.user)}</h6>
                                      <small className="text-muted">{formatTime(reply.createdAt)}</small>
                                      <p className="mb-1 mt-1">{reply.text}</p>
                                      <button
                                        type="button"
                                        className={`btn btn-xs ${replyLiked ? "btn-primary" : "btn-light"}`}
                                        onClick={() => handleToggleReplyLike(post._id, comment._id, reply._id)}
                                      >
                                        Like ({Array.isArray(reply.likes) ? reply.likes.length : 0})
                                      </button>
                                    </div>
                                    {canDeleteReply && (
                                      <button
                                        type="button"
                                        className="btn btn-xs btn-outline-danger"
                                        onClick={() => handleDeleteReply(post._id, comment._id, reply._id)}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        <div className="text-center mt-3">
          <Link to="#" className="text-muted">
            End of feed
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SocialFeedDynamic;

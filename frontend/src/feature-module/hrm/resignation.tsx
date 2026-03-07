import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPost, getAllPosts, addComment, toggleLike } from "../../services/posteservice";
import { all_routes } from "../router/all_routes";

interface User {
  id: string;
  username: string;
}

interface Comment {
  _id: string;
  text: string;
  user: User;
  createdAt: string;
}

interface Post {
  _id: string;
  title: string;
  content: string;
  type: "DISCUSSION" | "OPPORTUNITY" | "SUCCESS" | "EVENT";
  author: User;
  media?: string[];
  likes: string[];
  comments: Comment[];
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface NewPost {
  title: string;
  content: string;
  type: "DISCUSSION" | "OPPORTUNITY" | "SUCCESS" | "EVENT";
}

const Resignation: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState<NewPost>({ title: "", content: "", type: "DISCUSSION" });
  const [comments, setComments] = useState<{ [postId: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getUserFromStorage = (): User | null => {
    // Try different possible storage locations for user data
    const userData = localStorage.getItem("user") || localStorage.getItem("userData") || sessionStorage.getItem("user");
    
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch (e) {
        console.error("Error parsing user data:", e);
        return null;
      }
    }
    
    // If no user data found, check if we can extract from token
    const token = localStorage.getItem("token");
    if (token) {
      try {
        // Simple extraction from JWT token (without full validation)
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
          id: payload.userId || payload.id,
          username: payload.username
        };
      } catch (e) {
        console.error("Error extracting user from token:", e);
      }
    }
    
    return null;
  };

  const currentUser: User | null = getUserFromStorage();
  console.log("Current user:", currentUser);
  console.log("Token exists:", !!localStorage.getItem("token"));
  console.log("Available localStorage keys:", Object.keys(localStorage));

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response: ApiResponse<Post[]> = await getAllPosts();
      if (response.success) {
        setPosts(response.data);
      } else {
        setError(response.message || "Échec du chargement des publications");
      }
    } catch (err: any) {
      console.error("Error fetching posts:", err);
      setError(err.message || "Échec du chargement des publications");
    } finally {
      setLoading(false);
    }
  };

const handleCreatePost = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!currentUser) {
    setError("Veuillez vous connecter pour créer une publication");
    return;
  }

  setCreatingPost(true);
  try {
    // Try sending the author ID explicitly
    const postData = {
      title: newPost.title,
      content: newPost.content,
      type: newPost.type,
      author: currentUser.id // Send author ID explicitly
    };
    
    const response: ApiResponse<Post> = await createPost(postData);
    if (response.success) {
      setPosts([response.data, ...posts]);
      setNewPost({ title: "", content: "", type: "DISCUSSION" });
      setSuccess("Publication créée avec succès !");
      setError(null);
    } else {
      setError(response.message || "Échec de la création de la publication");
    }
  } catch (err: any) {
    setError(err.message || "Échec de la création de la publication");
  } finally {
    setCreatingPost(false);
  }
};

  const handleAddComment = async (postId: string) => {
    const commentText = comments[postId]?.trim();
    if (!currentUser) {
      setError("Veuillez vous connecter pour ajouter un commentaire");
      return;
    }
    if (!commentText) return;

    try {
      const response: ApiResponse<Post> = await addComment(postId, { text: commentText });
      if (response.success) {
        setPosts(posts.map((post) => (post._id === postId ? response.data : post)));
        setComments((prev) => ({ ...prev, [postId]: "" }));
        setSuccess("Commentaire ajouté avec succès !");
        setError(null);
      } else {
        setError(response.message || "Échec de l'ajout du commentaire");
      }
    } catch (err: any) {
      console.error("Error adding comment:", err);
      setError(err.message || "Échec de l'ajout du commentaire");
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!currentUser) {
      setError("Veuillez vous connecter pour aimer les publications");
      return;
    }

    try {
      const response: ApiResponse<Post> = await toggleLike(postId);
      if (response.success) {
        setPosts(posts.map((post) => (post._id === postId ? response.data : post)));
        setSuccess("J'aime mis à jour avec succès !");
        setError(null);
      } else {
        setError(response.message || "Échec de la mise à jour du j'aime");
      }
    } catch (err: any) {
      console.error("Error toggling like:", err);
      setError(err.message || "Échec de la mise à jour du j'aime");
    }
  };

  const getPostTypeIcon = (type: Post["type"]): string => {
    switch (type) {
      case "OPPORTUNITY":
        return "ti ti-briefcase";
      case "SUCCESS":
        return "ti ti-trophy";
      case "EVENT":
        return "ti ti-calendar-event";
      case "DISCUSSION":
      default:
        return "ti ti-message-circle";
    }
  };

  const getPostTypeColor = (type: Post["type"]): string => {
    switch (type) {
      case "OPPORTUNITY":
        return "badge-info";
      case "SUCCESS":
        return "badge-success";
      case "EVENT":
        return "badge-warning";
      case "DISCUSSION":
      default:
        return "badge-primary";
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Breadcrumb */}
        <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
          <div className="my-auto mb-2">
            <h2 className="mb-1">Publications & Fil d'actualités</h2>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={all_routes.adminDashboard}>
                    <i className="ti ti-smart-home" />
                  </Link>
                </li>
                <li className="breadcrumb-item">Application</li>
                <li className="breadcrumb-item active" aria-current="page">
                  Publications
                </li>
              </ol>
            </nav>
          </div>
        </div>

        {/* Create Post */}
        <div className="row">
          <div className="col-xl-12">
            <div className="card">
              <div className="card-header">
                <h4 className="card-title">Créer une nouvelle publication</h4>
              </div>
              <div className="card-body">
                {success && (
                  <div className="alert alert-success alert-dismissible fade show" role="alert">
                    <i className="ti ti-check-circle me-2"></i>
                    {success}
                    <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
                  </div>
                )}
                {error && (
                  <div className="alert alert-danger alert-dismissible fade show" role="alert">
                    <i className="ti ti-alert-circle me-2"></i>
                    {error}
                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                  </div>
                )}
                <form onSubmit={handleCreatePost}>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Type de publication</label>
                      <select
                        className="form-select"
                        value={newPost.type}
                        onChange={(e) => setNewPost({ ...newPost, type: e.target.value as NewPost["type"] })}
                        disabled={creatingPost}
                      >
                        <option value="DISCUSSION">Discussion</option>
                        <option value="OPPORTUNITY">Opportunité</option>
                        <option value="SUCCESS">Succès</option>
                        <option value="EVENT">Événement</option>
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Titre de la publication</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newPost.title}
                        onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                        placeholder="Saisissez le titre de la publication"
                        required
                        disabled={creatingPost}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Contenu</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={newPost.content}
                      onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                      placeholder="Rédigez le contenu de votre publication ici..."
                      required
                      disabled={creatingPost}
                    />
                  </div>
                  <div className="d-flex justify-content-end">
                    <button type="submit" className="btn btn-primary" disabled={creatingPost || !currentUser}>
                      {creatingPost ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Création en cours...
                        </>
                      ) : (
                        <>
                          <i className="ti ti-plus me-2"></i>Créer une publication
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Posts List */}
          <div className="col-xl-12">
            <div className="card">
              <div className="card-header">
                <h4 className="card-title">Publications récentes</h4>
              </div>
              <div className="card-body">
                {loading && posts.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Chargement...</span>
                    </div>
                    <p className="mt-2">Chargement des publications...</p>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-4">
                    <i className="ti ti-message-circle fs-1 text-muted mb-3"></i>
                    <h5 className="text-muted">Aucune publication pour le moment</h5>
                    <p className="text-muted">Soyez le premier à créer une publication !</p>
                  </div>
                ) : (
                  <div className="row">
                    {posts.map((post) => (
                      <div key={post._id} className="col-xl-12 mb-3">
                        <div className="card post-card">
                          <div className="card-body">
                            {/* Post Header */}
                            <div className="d-flex align-items-start mb-3">
                              <div className="avatar avatar-md me-3">
                                <div className="avatar-initial bg-primary rounded-circle">
                                  <i className="ti ti-user"></i>
                                </div>
                              </div>
                              <div className="flex-fill">
                                <div className="d-flex align-items-center mb-2">
                                  <h6 className="mb-0 me-2">{post.author?.username || "Anonyme"}</h6>
                                  <span className={`badge ${getPostTypeColor(post.type)} badge-xs`}>
                                    <i className={`${getPostTypeIcon(post.type)} me-1`}></i>
                                    {post.type}
                                  </span>
                                </div>
                                <p className="text-muted mb-1">
                                  {new Date(post.createdAt).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>

                            {/* Post Content */}
                            <h5 className="card-title mb-2">{post.title}</h5>
                            <p className="card-text mb-3">{post.content}</p>

                            {/* Post Media */}
                            {post.media?.length ? (
                              <div className="mb-3">
                                <div className="row g-2">
                                  {(post.media || []).map((url, idx) => (
                                    <div key={idx} className="col-md-4">
                                      <img
                                        src={`http://localhost:5000${url}`}
                                        alt="Post media"
                                        className="img-fluid rounded"
                                        style={{ maxHeight: "200px", objectFit: "cover" }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {/* Like Button */}
                            <div className="d-flex align-items-center justify-content-between mb-3">
                              <div className="d-flex align-items-center">
                                <button
                                  className={`btn btn-sm me-2 ${
                                    currentUser && post.likes?.includes(currentUser.id)
                                      ? "btn-danger"
                                      : "btn-outline-primary"
                                  }`}
                                  onClick={() => handleToggleLike(post._id)}
                                  disabled={!currentUser || loading}
                                >
                                  <i className="ti ti-heart me-1"></i>
                                  {post.likes?.length || 0}
                                </button>
                                <span className="text-muted">{post.likes?.length === 1 ? "J'aime" : "J'aime"}</span>
                              </div>
                            </div>

                            {/* Comments */}
                            <div className="mt-3 pt-3 border-top">
                              <h6 className="mb-3">Commentaires ({post.comments?.length || 0})</h6>

                              {post.comments?.length > 0 ? (
                                <div className="comments-list mb-3">
                                  {post.comments.slice(0, 3).map((c) => (
                                    <div key={c._id} className="d-flex mb-2">
                                      <div className="avatar avatar-sm me-2">
                                        <div className="avatar-initial bg-secondary rounded-circle">
                                          <i className="ti ti-user fs-12"></i>
                                        </div>
                                      </div>
                                      <div className="flex-fill">
                                        <div className="bg-light rounded p-2">
                                          <p className="mb-1 fw-semibold fs-13">
                                            {c.user?.username || "Anonyme"}
                                          </p>
                                          <p className="mb-0 fs-13">{c.text}</p>
                                        </div>
                                        <small className="text-muted">
                                          {new Date(c.createdAt).toLocaleDateString()}
                                        </small>
                                      </div>
                                    </div>
                                  ))}
                                  {post.comments.length > 3 && (
                                    <p className="text-muted fs-12">
                                      Et {post.comments.length - 3} autres commentaires...
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-muted fs-13 mb-3">Aucun commentaire pour le moment</p>
                              )}

                              {currentUser && (
                                <div className="d-flex">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm me-2"
                                    placeholder="Écrire un commentaire..."
                                    value={comments[post._id] || ""}
                                    onChange={(e) =>
                                      setComments((prev) => ({ ...prev, [post._id]: e.target.value }))
                                    }
                                    disabled={loading}
                                  />
                                  <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleAddComment(post._id)}
                                    disabled={!comments[post._id]?.trim() || loading}
                                  >
                                    <i className="ti ti-send"></i>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Resignation;
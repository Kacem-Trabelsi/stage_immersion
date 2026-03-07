import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { all_routes } from "../../router/all_routes";
import { useAuth } from "../../../contexts/AuthContext";
import { API_BASE_URL } from "../../../services/apiService";

type ExpertUser = {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  avatar?: string;
  profilePhoto?: string;
  country?: string;
  phone?: string;
  position?: string;
  createdAt?: string;
};

const ExpertProfile = () => {
  const routes = all_routes;
  const { expertId } = useParams();
  const { user, loading } = useAuth();
  const [expert, setExpert] = React.useState<ExpertUser | null>(null);
  const [loadingProfile, setLoadingProfile] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!expertId) {
        setError("Invalid expert id");
        setLoadingProfile(false);
        return;
      }

      try {
        setLoadingProfile(true);
        const res = await fetch(`${API_BASE_URL}/api/user/${expertId}`);
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.message || payload?.error || "Failed to load expert profile");
        }

        const data = payload?.data ? payload.data : payload;
        if (!data || data.role !== "EXPERT") {
          throw new Error("This profile is not an expert profile");
        }
        setExpert(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load expert profile");
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [expertId]);

  const getAvatarUrl = (profile: ExpertUser | null) => {
    const image = profile?.avatar || profile?.profilePhoto || "";
    if (!image) return "/assets/img/users/user-49.jpg";
    if (image.startsWith("/data:image/")) return image.substring(1);
    if (image.startsWith("data:") || image.startsWith("http")) return image;
    if (image.startsWith("/uploads") || image.startsWith("uploads/")) {
      const normalized = image.startsWith("/") ? image : `/${image}`;
      return `${API_BASE_URL}${normalized}`;
    }
    if (image.startsWith("assets/")) return `/${image}`;
    return image;
  };

  const displayName = expert
    ? `${expert.firstName || ""} ${expert.lastName || ""}`.trim() || expert.email?.split("@")[0]
    : "";

  if (loading) return null;
  if (user?.role !== "STARTUP") {
    return <Navigate to={routes.unauthorized} replace />;
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
          <div className="my-auto mb-2">
            <h2 className="mb-1">Expert Profile</h2>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.employeeDashboard}>
                    <i className="ti ti-smart-home" />
                  </Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to={routes.expertsList}>Experts</Link>
                </li>
                <li className="breadcrumb-item active">Profile</li>
              </ol>
            </nav>
          </div>
          <div className="head-icons ms-2">
            <CollapseHeader />
          </div>
        </div>

        {loadingProfile && (
          <div className="card">
            <div className="card-body text-center">Loading profile...</div>
          </div>
        )}

        {!loadingProfile && error && (
          <div className="card">
            <div className="card-body text-center text-danger">{error}</div>
          </div>
        )}

        {!loadingProfile && !error && expert && (
          <div className="card">
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col-md-4 text-center mb-3 mb-md-0">
                  <div className="avatar avatar-xxl border p-1 border-primary rounded-circle">
                    <img
                      src={getAvatarUrl(expert)}
                      alt="expert"
                      className="img-fluid rounded-circle w-100 h-100 object-fit-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/assets/img/users/user-49.jpg";
                      }}
                    />
                  </div>
                  <h4 className="mt-3 mb-1">{displayName}</h4>
                  <span className="badge bg-info-transparent">EXPERT</span>
                </div>
                <div className="col-md-8">
                  <table className="table table-borderless mb-0">
                    <tbody>
                      <tr>
                        <td>
                          <strong>Email:</strong>
                        </td>
                        <td>{expert.email || "-"}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Phone:</strong>
                        </td>
                        <td>{expert.phone || "-"}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Country:</strong>
                        </td>
                        <td>{expert.country || "-"}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Position:</strong>
                        </td>
                        <td>{expert.position || "Expert"}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Created At:</strong>
                        </td>
                        <td>{expert.createdAt ? new Date(expert.createdAt).toLocaleString() : "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3">
                    <Link to={routes.expertsList} className="btn btn-outline-primary btn-sm">
                      Back to Experts
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpertProfile;

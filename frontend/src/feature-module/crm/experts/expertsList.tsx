import React from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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
};

const ExpertsList = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [experts, setExperts] = React.useState<ExpertUser[]>([]);
  const [loadingExperts, setLoadingExperts] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    const fetchExperts = async () => {
      try {
        setLoadingExperts(true);
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/api/chat/users?role=EXPERT`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
        });

        const payload = await response.json();
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.message || "Failed to fetch experts");
        }

        const list = Array.isArray(payload?.data) ? payload.data : [];
        setExperts(list);
      } catch (e: any) {
        setError(e?.message || "Failed to fetch experts");
      } finally {
        setLoadingExperts(false);
      }
    };

    fetchExperts();
  }, []);

  const getAvatarUrl = (expert: ExpertUser) => {
    const image = expert?.avatar || expert?.profilePhoto || "";
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

  const getDisplayName = (expert: ExpertUser) => {
    if (expert?.firstName || expert?.lastName) {
      return `${expert?.firstName || ""} ${expert?.lastName || ""}`.trim();
    }
    return expert?.email?.split("@")[0] || "Expert";
  };

  const openProfile = (expertId: string) => {
    navigate(routes.expertProfile.replace(":expertId", expertId));
  };

  if (loading) return null;
  if (user?.role !== "STARTUP") {
    return <Navigate to={routes.unauthorized} replace />;
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
          <div className="my-auto mb-2">
            <h2 className="mb-1">Experts</h2>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.employeeDashboard}>
                    <i className="ti ti-smart-home" />
                  </Link>
                </li>
                <li className="breadcrumb-item">CRM</li>
                <li className="breadcrumb-item active" aria-current="page">
                  Experts List
                </li>
              </ol>
            </nav>
          </div>
          <div className="head-icons ms-2">
            <CollapseHeader />
          </div>
        </div>

        {loadingExperts && (
          <div className="card">
            <div className="card-body text-center">Loading experts...</div>
          </div>
        )}
        {!loadingExperts && error && (
          <div className="card">
            <div className="card-body text-danger text-center">{error}</div>
          </div>
        )}
        {!loadingExperts && !error && experts.length === 0 && (
          <div className="card">
            <div className="card-body text-center">No experts available.</div>
          </div>
        )}

        <div className="row">
          {!loadingExperts &&
            !error &&
            experts.map((expert) => (
              <div className="col-xl-3 col-lg-4 col-md-6" key={expert._id}>
                <div className="card">
                  <div className="card-body">
                    <div className="text-center mb-3">
                      <div className="avatar avatar-xl avatar-rounded border p-1 border-primary rounded-circle mb-2">
                        <img
                          src={getAvatarUrl(expert)}
                          alt="expert"
                          className="img-fluid rounded-circle w-100 h-100 object-fit-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/assets/img/users/user-49.jpg";
                          }}
                        />
                      </div>
                      <h6 className="mb-1">{getDisplayName(expert)}</h6>
                      <span className="badge bg-info-transparent fs-10 fw-medium">EXPERT</span>
                    </div>

                    <div className="d-flex flex-column">
                      <p className="text-dark d-inline-flex align-items-center mb-2">
                        <i className="ti ti-mail me-2 text-gray-6" />
                        {expert.email}
                      </p>
                      {expert.position && (
                        <p className="text-dark d-inline-flex align-items-center mb-2">
                          <i className="ti ti-briefcase me-2 text-gray-6" />
                          {expert.position}
                        </p>
                      )}
                      {expert.country && (
                        <p className="text-dark d-inline-flex align-items-center mb-0">
                          <i className="ti ti-map-pin me-2 text-gray-6" />
                          {expert.country}
                        </p>
                      )}
                    </div>

                    <div className="border-top pt-3 mt-3 d-flex justify-content-between">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => openProfile(expert._id)}
                      >
                        View Profile
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          sessionStorage.setItem("selectedChatUser", JSON.stringify(expert));
                          navigate(routes.chat);
                        }}
                      >
                        Chat
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ExpertsList;

import React, { useEffect, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link, useNavigate } from "react-router-dom";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { userAPI } from "../../../services/apiService";
import { useAuth } from "../../../contexts/AuthContext";

type PasswordField = "current" | "new" | "confirm" | "emailPassword" | "deletePassword";

interface SecurityOverview {
  email: string;
  emailVerified: boolean;
  passwordLastChangedAt: string | null;
  lastLogin: string | null;
}

interface DeviceSession {
  id: string;
  device: string;
  location: string;
  ipAddress: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

const Securitysettings = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const { signout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [passwordPopupError, setPasswordPopupError] = useState("");
  const [passwordPopupSuccess, setPasswordPopupSuccess] = useState("");
  const [emailPopupError, setEmailPopupError] = useState("");
  const [emailPopupSuccess, setEmailPopupSuccess] = useState("");
  const [deletePopupError, setDeletePopupError] = useState("");

  const [overview, setOverview] = useState<SecurityOverview>({
    email: "",
    emailVerified: true,
    passwordLastChangedAt: null,
    lastLogin: null,
  });
  const [devices, setDevices] = useState<DeviceSession[]>([]);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    password: "",
  });
  const [deleteForm, setDeleteForm] = useState({
    password: "",
    confirmation: "",
  });

  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    new: false,
    confirm: false,
    emailPassword: false,
    deletePassword: false,
  });

  const togglePasswordVisibility = (field: PasswordField) => {
    setPasswordVisibility((prevState) => ({
      ...prevState,
      [field]: !prevState[field],
    }));
  };

  const closeModal = (id: string) => {
    const bootstrap = (window as any)?.bootstrap;
    const element = document.getElementById(id);
    if (!element) return;

    if (bootstrap?.Modal) {
      const instance = bootstrap.Modal.getInstance(element) || new bootstrap.Modal(element);
      instance.hide();
      return;
    }

    // Fallback close when bootstrap runtime is not exposed on window
    element.classList.remove("show");
    (element as HTMLElement).style.display = "none";
    element.setAttribute("aria-hidden", "true");
    element.removeAttribute("aria-modal");
    element.removeAttribute("role");

    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("padding-right");

    const backdrops = document.querySelectorAll(".modal-backdrop");
    backdrops.forEach((backdrop) => backdrop.remove());
  };

  const formatDate = (dateValue: string | null) => {
    if (!dateValue) return "N/A";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const loadSecurityData = async () => {
    setLoading(true);
    setPageError("");
    try {
      const [overviewRes, devicesRes] = await Promise.all([
        userAPI.getSecurityOverview(),
        userAPI.getDevices(),
      ]);

      if (overviewRes?.data?.success) {
        setOverview(overviewRes.data.data);
      }
      if (devicesRes?.data?.success) {
        setDevices(devicesRes.data.data || []);
      }
    } catch (err: any) {
      setPageError(err?.response?.data?.message || "Failed to load security settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError("");
    setPasswordPopupError("");
    setPasswordPopupSuccess("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordPopupError("Please fill all password fields");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordPopupError("New password and confirmation do not match");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordPopupError("New password must contain at least 6 characters");
      return;
    }

    try {
      setActionLoading("password");
      const response = await userAPI.changePassword(passwordForm);
      if (response?.data?.success) {
        setPasswordPopupSuccess("Password changed successfully");
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setPasswordPopupError("");
        closeModal("change-password");
        await loadSecurityData();
      } else {
        setPasswordPopupError(response?.data?.message || "Failed to change password");
      }
    } catch (err: any) {
      setPasswordPopupError(err?.response?.data?.message || "Failed to change password");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError("");
    setEmailPopupError("");
    setEmailPopupSuccess("");

    if (!emailForm.newEmail || !emailForm.password) {
      setEmailPopupError("Please provide new email and your password");
      return;
    }

    try {
      setActionLoading("email");
      const response = await userAPI.changeEmail(emailForm);
      if (response?.data?.success) {
        setEmailPopupSuccess("Email changed successfully");
        setEmailPopupError("");
        setEmailForm({ newEmail: "", password: "" });
        closeModal("change-email");
        await loadSecurityData();
      } else {
        setEmailPopupError(response?.data?.message || "Failed to change email");
      }
    } catch (err: any) {
      setEmailPopupError(err?.response?.data?.message || "Failed to change email");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setPageError("");
    setDeletePopupError("");

    if (!deleteForm.password) {
      setDeletePopupError("Please enter your password");
      return;
    }
    if (deleteForm.confirmation !== "DELETE") {
      setDeletePopupError('Type "DELETE" to confirm');
      return;
    }

    try {
      setActionLoading("delete");
      const response = await userAPI.deleteAccount(deleteForm.password);
      if (response?.data?.success) {
        await signout();
        navigate(routes.login, { replace: true });
        return;
      }
      setDeletePopupError(response?.data?.message || "Failed to delete account");
    } catch (err: any) {
      setDeletePopupError(err?.response?.data?.message || "Failed to delete account");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Settings</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Administration</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Settings
                  </li>
                </ol>
              </nav>
            </div>
            <div className="head-icons ms-2">
              <CollapseHeader />
            </div>
          </div>

          <ul className="nav nav-tabs nav-tabs-solid bg-transparent border-bottom mb-3">
            <li className="nav-item">
              <Link className="nav-link active" to={routes.profilesettings}>
                <i className="ti ti-settings me-2" />
                General Settings
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to={routes.bussinessSettings}>
                <i className="ti ti-world-cog me-2" />
                Website Settings
              </Link>
            </li>
          </ul>

          {!!pageError && <div className="alert alert-danger">{pageError}</div>}

          <div className="row">
            <div className="col-xl-3 theiaStickySidebar">
              <div className="card">
                <div className="card-body">
                  <div className="d-flex flex-column list-group settings-list">
                    <Link to={routes.securitysettings} className="d-inline-flex align-items-center rounded active py-2 px-3">
                      <i className="ti ti-arrow-badge-right me-2" />
                      Security Settings
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-9">
              <div className="card">
                <div className="card-body">
                  <div className="border-bottom mb-3 pb-3">
                    <h4>Security Settings</h4>
                  </div>

                  {loading ? (
                    <p className="text-muted mb-0">Loading security information...</p>
                  ) : (
                    <div>
                      <div className="d-flex justify-content-between align-items-center flex-wrap border-bottom mb-3">
                        <div className="mb-3">
                          <h5 className="fw-medium mb-1">Password</h5>
                          <div className="d-flex align-items-center">
                            <p className="mb-0 me-2 pe-2 border-end">Set a unique password to protect the account</p>
                            <p>Last Changed {formatDate(overview.passwordLastChangedAt)}</p>
                          </div>
                        </div>
                        <div className="mb-3">
                          <button
                            className="btn btn-dark btn-sm"
                            data-bs-toggle="modal"
                            data-bs-target="#change-password"
                            type="button"
                            onClick={() => {
                              setPasswordPopupError("");
                              setPasswordPopupSuccess("");
                            }}
                          >
                            Change Password
                          </button>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between align-items-center flex-wrap border-bottom mb-3">
                        <div className="mb-3">
                          <h5 className="fw-medium d-flex align-items-center mb-1">
                            Email Verification
                            <span>
                              <i
                                className={`ti ms-2 ${overview.emailVerified ? "ti-discount-check-filled text-success" : "ti-alert-triangle text-warning"}`}
                              />
                            </span>
                          </h5>
                          <div className="d-flex align-items-center">
                            <p className="mb-0 me-2 pe-2 border-end">The email address associated with the account</p>
                            <p>Verified Email : {overview.email || "N/A"}</p>
                          </div>
                        </div>
                        <div className="mb-3">
                          <button
                            className="btn btn-dark btn-sm"
                            data-bs-toggle="modal"
                            data-bs-target="#change-email"
                            type="button"
                            onClick={() => {
                              setEmailPopupError("");
                              setEmailPopupSuccess("");
                            }}
                          >
                            Change
                          </button>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between align-items-center flex-wrap border-bottom mb-3">
                        <div className="mb-3">
                          <h5 className="fw-medium mb-1">Device Management</h5>
                          <p>{devices.length} active device session(s)</p>
                        </div>
                        <div className="mb-3">
                          <button className="btn btn-dark btn-sm" data-bs-toggle="modal" data-bs-target="#device_management" type="button">
                            Manage
                          </button>
                        </div>
                      </div>

                      <div className="d-flex justify-content-between align-items-center flex-wrap row-gap-3">
                        <div>
                          <h5 className="fw-medium mb-1">Delete Account</h5>
                          <p>Your account will be permanently deleted</p>
                        </div>
                        <div>
                          <button
                            className="btn btn-dark btn-sm"
                            data-bs-toggle="modal"
                            data-bs-target="#del-account"
                            type="button"
                            onClick={() => setDeletePopupError("")}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer d-sm-flex align-items-center justify-content-between border-top bg-white p-3">
          <p className="mb-0">2014 - 2025 © SmartHR.</p>
          <p>
            Designed &amp; Developed By{" "}
            <Link to="#" className="text-primary">
              Dreams
            </Link>
          </p>
        </div>
      </div>

      <div className="modal fade custom-modal" id="change-password">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content doctor-profile">
            <div className="modal-header d-flex align-items-center justify-content-between border-bottom">
              <h5 className="modal-title">Change Password</h5>
              <button className="btn p-0" data-bs-dismiss="modal" aria-label="Close" type="button">
                <i className="ti ti-circle-x-filled fs-20" />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit}>
              <div className="modal-body p-4">
                {!!passwordPopupError && <div className="alert alert-danger">{passwordPopupError}</div>}
                {!!passwordPopupSuccess && <div className="alert alert-success">{passwordPopupSuccess}</div>}
                <div className="mb-3">
                  <label className="form-label">
                    Current Password <span className="text-danger">*</span>
                  </label>
                  <div className="pass-group">
                    <input
                      type={passwordVisibility.current ? "text" : "password"}
                      className="pass-input form-control"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    />
                    <span
                      className={`ti toggle-passwords ${passwordVisibility.current ? "ti-eye" : "ti-eye-off"}`}
                      onClick={() => togglePasswordVisibility("current")}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    New Password <span className="text-danger">*</span>
                  </label>
                  <div className="pass-group">
                    <input
                      type={passwordVisibility.new ? "text" : "password"}
                      className="pass-input form-control"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    />
                    <span
                      className={`ti toggle-passwords ${passwordVisibility.new ? "ti-eye" : "ti-eye-off"}`}
                      onClick={() => togglePasswordVisibility("new")}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Confirm New Password <span className="text-danger">*</span>
                  </label>
                  <div className="pass-group">
                    <input
                      type={passwordVisibility.confirm ? "text" : "password"}
                      className="pass-input form-control"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    />
                    <span
                      className={`ti toggle-passwords ${passwordVisibility.confirm ? "ti-eye" : "ti-eye-off"}`}
                      onClick={() => togglePasswordVisibility("confirm")}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top">
                <button className="btn btn-light me-2" data-bs-dismiss="modal" type="button">
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={actionLoading === "password"}>
                  {actionLoading === "password" ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade custom-modal" id="change-email">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content doctor-profile">
            <div className="modal-header d-flex align-items-center justify-content-between border-bottom">
              <h5 className="modal-title">Change Email</h5>
              <button className="btn p-0" data-bs-dismiss="modal" aria-label="Close" type="button">
                <i className="ti ti-circle-x-filled fs-20" />
              </button>
            </div>
            <form onSubmit={handleEmailSubmit}>
              <div className="modal-body p-4">
                {!!emailPopupError && <div className="alert alert-danger">{emailPopupError}</div>}
                {!!emailPopupSuccess && <div className="alert alert-success">{emailPopupSuccess}</div>}
                <div className="mb-3">
                  <label className="form-label">Current Email Address</label>
                  <input type="email" className="form-control" value={overview.email} readOnly />
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    New Email Address <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Confirm Password <span className="text-danger">*</span>
                  </label>
                  <div className="pass-group">
                    <input
                      type={passwordVisibility.emailPassword ? "text" : "password"}
                      className="pass-input form-control"
                      value={emailForm.password}
                      onChange={(e) => setEmailForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                    <span
                      className={`ti toggle-passwords ${passwordVisibility.emailPassword ? "ti-eye" : "ti-eye-off"}`}
                      onClick={() => togglePasswordVisibility("emailPassword")}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top">
                <button className="btn btn-light me-2" data-bs-dismiss="modal" type="button">
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={actionLoading === "email"}>
                  {actionLoading === "email" ? "Saving..." : "Save Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal fade custom-modal" id="device_management">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header d-flex align-items-center justify-content-between border-bottom">
              <h5 className="modal-title">Device Management</h5>
              <button className="btn p-0" data-bs-dismiss="modal" aria-label="Close" type="button">
                <i className="ti ti-circle-x-filled fs-20" />
              </button>
            </div>
            <div className="modal-body">
              <div className="table-responsive">
                <table className="table">
                  <thead className="thead-light">
                    <tr>
                      <th>Device</th>
                      <th>Last Active</th>
                      <th>Location</th>
                      <th>IP Address</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-4">
                          No devices found
                        </td>
                      </tr>
                    ) : (
                      devices.map((device) => (
                        <tr key={device.id}>
                          <td>{device.device}</td>
                          <td>{formatDate(device.lastActiveAt)}</td>
                          <td>{device.location}</td>
                          <td>{device.ipAddress}</td>
                          <td>
                            {device.isCurrent ? (
                              <span className="badge badge-sm badge-success">
                                <i className="ti ti-point-filled me-1" />
                                current
                              </span>
                            ) : (
                              <span className="badge badge-sm badge-light">inactive</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade custom-modal" id="del-account">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content doctor-profile">
            <div className="modal-header d-flex align-items-center justify-content-between border-bottom">
              <h5 className="modal-title">Delete Account</h5>
              <button className="btn p-0" data-bs-dismiss="modal" aria-label="Close" type="button">
                <i className="ti ti-circle-x-filled fs-20" />
              </button>
            </div>
            <form onSubmit={handleDeleteAccount}>
              <div className="modal-body p-4">
                {!!deletePopupError && <div className="alert alert-danger">{deletePopupError}</div>}
                <div className="alert alert-warning">
                  This action is permanent. Your account and data will be deleted.
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Password <span className="text-danger">*</span>
                  </label>
                  <div className="pass-group">
                    <input
                      type={passwordVisibility.deletePassword ? "text" : "password"}
                      className="pass-input form-control"
                      value={deleteForm.password}
                      onChange={(e) => setDeleteForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                    <span
                      className={`ti toggle-passwords ${passwordVisibility.deletePassword ? "ti-eye" : "ti-eye-off"}`}
                      onClick={() => togglePasswordVisibility("deletePassword")}
                    />
                  </div>
                </div>
                <div className="mb-0">
                  <label className="form-label">
                    Type <code>DELETE</code> to confirm
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={deleteForm.confirmation}
                    onChange={(e) => setDeleteForm((prev) => ({ ...prev, confirmation: e.target.value }))}
                  />
                </div>
              </div>
              <div className="modal-footer border-top">
                <button className="btn btn-light me-2" data-bs-dismiss="modal" type="button">
                  Cancel
                </button>
                <button className="btn btn-danger" type="submit" disabled={actionLoading === "delete"}>
                  {actionLoading === "delete" ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Securitysettings;


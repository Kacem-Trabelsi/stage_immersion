import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useAuth } from "../../../contexts/AuthContext"; // ⬅️ Import useAuth

type PasswordField = "password" | "confirmPassword";

interface RegisterFormData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  role: string;
}

const Register2 = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const { signup, loading } = useAuth();

  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    role: 'STARTUP'
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordVisibility, setPasswordVisibility] = useState({
    password: false,
    confirmPassword: false,
  });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const togglePasswordVisibility = (field: PasswordField) => {
    setPasswordVisibility((prevState) => ({
      ...prevState,
      [field]: !prevState[field],
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };

  // Handle OAuth registration
  const handleOAuthRegister = (provider: 'github' | 'google') => {
    const oauthUrl = `${API_URL}/api/auth/${provider}`;
    window.location.href = oauthUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    setSuccess('');

    // Basic validations
    if (
      !formData.username ||
      !formData.email ||
      !formData.password ||
      !formData.confirmPassword ||
      !formData.firstName
    ) {
      setError("Please fill all required fields");
      setFormLoading(false);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setFormLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      setFormLoading(false);
      return;
    }

    try {
      const result = await signup({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role
      });
      if (result.success) {
        setSuccess('Account created! Redirecting...');
        setTimeout(() => {
          // Redirect based on user role
          if (formData.role === 'S2T') {
            navigate(routes.adminDashboard);
          } else if (formData.role === 'STARTUP') {
            navigate(routes.employeeDashboard);
          } else if (formData.role === 'EXPERT') {
            navigate(routes.dealsDashboard);
          } else {
            navigate(routes.login2); // fallback
          }
        }, 1000);
      } else {
        setError(result.message || "Registration failed");
      }
    } catch (err) {
      setError("Server error");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="container-fuild">
      <div className="w-100 overflow-hidden position-relative flex-wrap d-block vh-100">
        <div className="row">
          <div className="col-lg-5">
            <div className="d-lg-flex align-items-center justify-content-center d-none flex-wrap vh-100 bg-primary-transparent">
              <div>
                <ImageWithBasePath src="assets/img/bg/authentication-bg-02.svg" alt="Img" />
              </div>
            </div>
          </div>
          <div className="col-lg-7 col-md-12 col-sm-12">
            <div className="row justify-content-center align-items-center vh-100 overflow-auto flex-wrap ">
              <div className="col-md-7 mx-auto vh-100">
                <form className="vh-100" onSubmit={handleSubmit}>
                  <div className="vh-100 d-flex flex-column justify-content-between p-4 pb-0">
                    <div className="mx-auto mb-5 text-center">
                      <ImageWithBasePath
                        src="assets/img/logo.svg"
                        className="img-fluid"
                        alt="Logo"
                      />
                    </div>
                    <div>
                      <div className="text-center mb-3">
                        <h2 className="mb-2">Sign Up</h2>
                        <p className="mb-0">Please enter your details to sign up</p>
                      </div>
                      {error && (
                        <div className="alert alert-danger mb-3" role="alert">
                          {error}
                        </div>
                      )}
                      {success && (
                        <div className="alert alert-success mb-3" role="alert">
                          {success}
                        </div>
                      )}
                      <div className="mb-3">
                        <label className="form-label">Username</label>
                        <div className="input-group">
                          <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            className="form-control border-end-0"
                            required
                          />
                          <span className="input-group-text border-start-0">
                            <i className="ti ti-user" />
                          </span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Email Address</label>
                        <div className="input-group">
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="form-control border-end-0"
                            required
                          />
                          <span className="input-group-text border-start-0">
                            <i className="ti ti-mail" />
                          </span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">First Name</label>
                        <div className="input-group">
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            className="form-control border-end-0"
                            required
                          />
                          <span className="input-group-text border-start-0">
                            <i className="ti ti-user" />
                          </span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Last Name</label>
                        <div className="input-group">
                          <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            className="form-control border-end-0"
                          />
                          <span className="input-group-text border-start-0">
                            <i className="ti ti-user" />
                          </span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Password</label>
                        <div className="pass-group">
                          <input
                            type={passwordVisibility.password ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            className="pass-input form-control"
                            required
                          />
                          <span
                            className={`ti toggle-passwords ${passwordVisibility.password ? "ti-eye" : "ti-eye-off"}`}
                            onClick={() => togglePasswordVisibility("password")}
                          ></span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Confirm Password</label>
                        <div className="pass-group">
                          <input
                            type={passwordVisibility.confirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            className="pass-input form-control"
                            required
                          />
                          <span
                            className={`ti toggle-passwords ${passwordVisibility.confirmPassword ? "ti-eye" : "ti-eye-off"}`}
                            onClick={() => togglePasswordVisibility("confirmPassword")}
                          ></span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Role</label>
                        <select
                          name="role"
                          value={formData.role}
                          onChange={handleInputChange}
                          className="form-control"
                          required
                        >
                          <option value="STARTUP">STARTUP</option>
                          <option value="EXPERT">EXPERT</option>
                          <option value="S2T">S2T</option>
                        </select>
                      </div>
                      <div className="mb-3">
                        <button type="submit" className="btn btn-primary w-100" disabled={formLoading || loading}>
                          {formLoading || loading ? "Signing Up..." : "Sign Up"}
                        </button>
                      </div>
                      <div className="text-center">
                        <h6 className="fw-normal text-dark mb-0">
                          Already have an account?
                          <Link to={all_routes.login2} className="hover-a ms-1">
                            Sign In
                          </Link>
                        </h6>
                      </div>
                      <div className="login-or">
                        <span className="span-or">Or</span>
                      </div>
                      <div className="mt-2">
                        <div className="d-flex align-items-center justify-content-center flex-wrap gap-2">
                          <div className="text-center flex-fill">
                            <button
                              type="button"
                              onClick={() => handleOAuthRegister('github')}
                              className="br-10 p-2 btn btn-dark w-100 d-flex align-items-center justify-content-center"
                              disabled={formLoading}
                            >
                              <ImageWithBasePath
                                className="img-fluid m-1"
                                src="assets/img/icons/github-logo.svg"
                                alt="GitHub"
                              />
                              <span className="ms-1">GitHub</span>
                            </button>
                          </div>
                          <div className="text-center flex-fill">
                            <button
                              type="button"
                              onClick={() => handleOAuthRegister('google')}
                              className="br-10 p-2 btn btn-outline-light border w-100 d-flex align-items-center justify-content-center"
                              disabled={formLoading}
                            >
                              <ImageWithBasePath
                                className="img-fluid m-1"
                                src="assets/img/icons/google-logo.svg"
                                alt="Google"
                              />
                              <span className="ms-1">Google</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 pb-4 text-center">
                      <p className="mb-0 text-gray-9">Copyright © 2024 - SynergyPark</p>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register2;

import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { authAPI } from "../../../services/apiService";

type PasswordField = "password" | "confirmPassword";

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

const ResetPassword = () => {
  const routes = all_routes;
  const navigation = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: '',
    confirmPassword: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenValid, setTokenValid] = useState(false);

  const [passwordVisibility, setPasswordVisibility] = useState({
    password: false,
    confirmPassword: false,
  });

  const [passwordStrength, setPasswordStrength] = useState({
    text: "Use 8 or more characters with a mix of letters, numbers, and symbols.",
    key: "",
  });

  const [manualToken, setManualToken] = useState('');

  const validateToken = useCallback(async () => {
    try {
      const response = await authAPI.verifyResetToken(token!);
      if (response.data.success) {
        setTokenValid(true);
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.');
      }
    } catch (err: any) {
      setError('Invalid or expired reset link. Please request a new password reset.');
    }
  }, [token]);

  // Check if token is valid on component mount
  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }
    validateToken();
  }, [token, validateToken]);

  const togglePasswordVisibility = (field: PasswordField) => {
    setPasswordVisibility((prevState) => ({
      ...prevState,
      [field]: !prevState[field],
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    setError('');
    setSuccess('');

    // Password strength validation
    if (name === 'password') {
      validatePasswordStrength(value);
    }
  };

  const validatePasswordStrength = (password: string) => {
    if (password.match(/^$|\s+/)) {
      setPasswordStrength({
        text: "Use 8 or more characters with a mix of letters, numbers & symbols",
        key: "",
      });
    } else if (password.length === 0) {
      setPasswordStrength({
        text: "",
        key: "",
      });
    } else if (password.length < 8) {
      setPasswordStrength({
        text: "Weak. Must contain at least 8 characters",
        key: "0",
      });
    } else if (
      password.search(/[a-z]/) < 0 ||
      password.search(/[A-Z]/) < 0 ||
      password.search(/[0-9]/) < 0
    ) {
      setPasswordStrength({
        text: "Average. Must contain at least 1 upper case and number",
        key: "1",
      });
    } else if (password.search(/(?=.*?[#?!@$%^&*-])/) < 0) {
      setPasswordStrength({
        text: "Almost. Must contain a special symbol",
        key: "2",
      });
    } else {
      setPasswordStrength({
        text: "Awesome! You have a secure password.",
        key: "3",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    setSuccess('');

    // Basic validations
    if (!formData.password || !formData.confirmPassword) {
      setError('Please fill all fields');
      setFormLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setFormLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setFormLoading(false);
      return;
    }

    if (!token) {
      setError('Invalid reset link');
      setFormLoading(false);
      return;
    }

    try {
      const response = await authAPI.resetPassword(token, formData.password);
      if (response.data.success) {
        setSuccess('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          navigation(routes.login);
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to reset password');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
      console.error('Reset password error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  if (!token) {
    const handleManualTokenSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (manualToken) {
        navigation(`${routes.resetPassword}?token=${manualToken}`);
      }
    };
    return (
      <div className="container-fuild">
        <div className="w-100 overflow-hidden position-relative flex-wrap d-block vh-100">
          <div className="row justify-content-center align-items-center vh-100">
            <div className="col-md-6 text-center">
              <div className="alert alert-danger">
                <h4>Invalid Reset Link</h4>
                <p>Please request a new password reset link.</p>
                <form onSubmit={handleManualTokenSubmit} className="mb-3">
                  <label htmlFor="manualToken">Paste your reset token here:</label>
                  <input
                    id="manualToken"
                    type="text"
                    className="form-control my-2"
                    value={manualToken}
                    onChange={e => setManualToken(e.target.value)}
                    placeholder="Enter reset token"
                  />
                  <button type="submit" className="btn btn-primary">Continue</button>
                </form>
                <Link to={routes.forgotPassword} className="btn btn-secondary">
                  Request New Reset Link
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fuild">
      <div className="w-100 overflow-hidden position-relative flex-wrap d-block vh-100">
        <div className="row">
          <div className="col-lg-5">
            <div className="login-background position-relative d-lg-flex align-items-center justify-content-center d-none flex-wrap vh-100">
              <div className="bg-overlay-img">
                <ImageWithBasePath src="assets/img/bg/bg-01.png" className="bg-1" alt="Img" />
                <ImageWithBasePath src="assets/img/bg/bg-02.png" className="bg-2" alt="Img" />
                <ImageWithBasePath src="assets/img/bg/bg-03.png" className="bg-3" alt="Img" />
              </div>
              <div className="authentication-card w-100">
                <div className="authen-overlay-item border w-100">
                  <h1 className="text-white display-1">
                    Empowering people <br /> through seamless HR <br /> management.
                  </h1>
                  <div className="my-4 mx-auto authen-overlay-img">
                    <ImageWithBasePath src="assets/img/bg/authentication-bg-01.png" alt="Img" />
                  </div>
                  <div>
                    <p className="text-white fs-20 fw-semibold text-center">
                      Efficiently manage your workforce, streamline <br />{" "}
                      operations effortlessly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-7 col-md-12 col-sm-12">
            <div className="row justify-content-center align-items-center vh-100 overflow-auto flex-wrap">
              <div className="col-md-7 mx-auto vh-100">
                <form className="vh-100" onSubmit={handleSubmit}>
                  <div className="vh-100 d-flex flex-column justify-content-between p-4 pb-0">
                    <div className=" mx-auto mb-5 text-center">
                      <ImageWithBasePath
                        src="assets/img/logo.svg"
                        className="img-fluid"
                        alt="Logo"
                      />
                    </div>
                    <div className="">
                      <div className="text-center mb-3">
                        <h2 className="mb-2">Reset Password</h2>
                        <p className="mb-0">
                          Your new password must be different from previous used
                          passwords.
                        </p>
                      </div>

                      {/* Error Message */}
                      {error && (
                        <div className="alert alert-danger mb-3" role="alert">
                          <i className="ti ti-alert-circle me-2"></i>
                          {error}
                        </div>
                      )}

                      {/* Success Message */}
                      {success && (
                        <div className="alert alert-success mb-3" role="alert">
                          <i className="ti ti-check-circle me-2"></i>
                          {success}
                        </div>
                      )}

                      <div>
                        <div className="input-block mb-3">
                          <div className="mb-3">
                            <label className="form-label">New Password</label>
                            <div className="pass-group" id="passwordInput">
                              <input
                                type={passwordVisibility.password ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                className="form-control pass-input"
                                placeholder="Enter your new password"
                                disabled={formLoading || !tokenValid}
                                required
                              />
                              <span
                                className={`ti toggle-passwords ${passwordVisibility.password ? "ti-eye" : "ti-eye-off"}`}
                                onClick={() => togglePasswordVisibility("password")}
                                style={{ cursor: "pointer" }}
                              ></span>
                            </div>
                          </div>
                          <div
                            className={`password-strength d-flex ${passwordStrength.key === "0"
                                ? "poor-active"
                                : passwordStrength.key === "1"
                                  ? "avg-active"
                                  : passwordStrength.key === "2"
                                    ? "strong-active"
                                    : passwordStrength.key === "3"
                                      ? "heavy-active"
                                      : ""
                              }`}
                            id="passwordStrength"
                          >
                            <span id="poor" className="active" />
                            <span id="weak" className="active" />
                            <span id="strong" className="active" />
                            <span id="heavy" className="active" />
                          </div>
                        </div>
                        <p className="fs-12">{passwordStrength.text}</p>
                        <div className="mb-3">
                          <label className="form-label">Confirm New Password</label>
                          <div className="pass-group">
                           <input
                            type={passwordVisibility.confirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            className="pass-input form-control"
                            placeholder="Confirm your new password"
                            disabled={formLoading || !tokenValid}
                            required
                          />
                          <span
                            className={`ti toggle-passwords ${passwordVisibility.confirmPassword ? "ti-eye" : "ti-eye-off"}`}
                            onClick={() => togglePasswordVisibility("confirmPassword")}
                          ></span>
                          </div>
                        </div>
                        <div className="mb-3">
                          <button 
                            type="submit" 
                            className="btn btn-primary w-100"
                            disabled={formLoading || !tokenValid || !formData.password || !formData.confirmPassword}
                          >
                            {formLoading ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Resetting Password...
                              </>
                            ) : (
                              'Reset Password'
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="text-center">
                        <h6 className="fw-normal text-dark mb-0">
                          Remember your password?
                          <Link to={routes.login} className="hover-a ms-1">
                            Sign In
                          </Link>
                        </h6>
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

export default ResetPassword;

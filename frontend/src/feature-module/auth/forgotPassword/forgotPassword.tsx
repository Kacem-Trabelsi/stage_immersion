import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { authAPI } from "../../../services/apiService";

interface ForgotPasswordFormData {
  email: string;
}

const ForgotPassword = () => {
  const routes = all_routes;
  const navigation = useNavigate();
  const [formData, setFormData] = useState<ForgotPasswordFormData>({
    email: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    setSuccess('');

    // Basic validation
    if (!formData.email) {
      setError('Please enter your email address');
      setFormLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      setFormLoading(false);
      return;
    }

    try {
      const response = await authAPI.forgotPassword(formData.email);
      if (response.data.success) {
        setSuccess('Password reset instructions have been sent to your email. Please check your inbox.');
        setTimeout(() => {
          navigation(routes.resetPassword);
        }, 3000);
      } else {
        setError(response.data.message || 'Failed to send reset email');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset email');
      console.error('Forgot password error:', err);
    } finally {
      setFormLoading(false);
    }
  };

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
                        <h2 className="mb-2">Forgot Password?</h2>
                        <p className="mb-0">
                          If you forgot your password, well, then we'll email you
                          instructions to reset your password.
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

                      <div className="mb-3">
                        <label className="form-label">Email Address</label>
                        <div className="input-group">
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="form-control border-end-0"
                            placeholder="Enter your email address"
                            disabled={formLoading}
                            required
                          />
                          <span className="input-group-text border-start-0">
                            <i className="ti ti-mail" />
                          </span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <button 
                          type="submit" 
                          className="btn btn-primary w-100"
                          disabled={formLoading || !formData.email}
                        >
                          {formLoading ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                              Sending...
                            </>
                          ) : (
                            'Send Reset Instructions'
                          )}
                        </button>
                      </div>
                      <div className="text-center">
                        <h6 className="fw-normal text-dark mb-0">
                          Remember your password?
                          <Link to={all_routes.login} className="hover-a ms-1">
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

export default ForgotPassword;

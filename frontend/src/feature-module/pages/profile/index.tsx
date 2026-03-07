import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import CommonSelect from "../../../core/common/commonSelect";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { useAuth } from "../../../contexts/AuthContext";
import StartupProfileForm from "./StartupProfileForm";
import { userAPI } from "../../../services/apiService";
import { API_BASE_URL } from "../../../services/apiService";

type PasswordField =
  | "oldPassword"
  | "newPassword"
  | "confirmPassword"
  | "currentPassword";

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postalCode: string;
  department: string;
  position: string;
  hireDate: string;
  salary: string;
  avatar: string;
  cv: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const Profile = () => {
  const route = all_routes;
  const { user, signout, updateUser } = useAuth();
  const navigate = useNavigate();
  
  const [profileData, setProfileData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    country: '',
    state: '',
    city: '',
    postalCode: '',
    department: '',
    position: '',
    hireDate: '',
    salary: '',
    avatar: '',
    cv: ''
  });
  const [cvUploading, setCvUploading] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState({
    name: '',
    phone: '',
    relationship: ''
  });
  const [skillsText, setSkillsText] = useState('');
  
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [passwordVisibility, setPasswordVisibility] = useState({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
    currentPassword: false,
  });

  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Load user profile data on component mount
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        country: user.country || '',
        state: user.state || '',
        city: user.city || '',
        postalCode: user.postalCode || '',
        department: user.department || '',
        position: user.position || '',
        hireDate: user.hireDate ? String(user.hireDate).substring(0,10) : '',
        salary: user.salary != null ? String(user.salary) : '',
        avatar: user.avatar || '',
        cv: user.cv || ''
      });
      setEmergencyContact({
        name: user.emergencyContact?.name || '',
        phone: user.emergencyContact?.phone || '',
        relationship: user.emergencyContact?.relationship || ''
      });
      setSkillsText(Array.isArray(user.skills) ? user.skills.join(', ') : '');
    }
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getProfile();
      if (response.data.success) {
        const profile = response.data.data;
        setProfileData({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: profile.email || '',
          phone: profile.phone || '',
          address: profile.address || '',
          country: profile.country || '',
          state: profile.state || '',
          city: profile.city || '',
          postalCode: profile.postalCode || '',
          department: profile.department || '',
          position: profile.position || '',
          hireDate: profile.hireDate ? String(profile.hireDate).substring(0,10) : '',
          salary: profile.salary != null ? String(profile.salary) : '',
          avatar: profile.avatar || profile.profilePhoto || '',
          cv: profile.cv || ''
        });
        setEmergencyContact({
          name: profile.emergencyContact?.name || '',
          phone: profile.emergencyContact?.phone || '',
          relationship: profile.emergencyContact?.relationship || ''
        });
        setSkillsText(Array.isArray(profile.skills) ? profile.skills.join(', ') : '');
      }
    } catch (err: any) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileError('');
      setProfileSuccess('');
      setCvUploading(true);
      try {
        if (user?.id) {
          const res = await userAPI.uploadCv(user.id, file);
          if (res.data?.success && res.data?.data?.cv) {
            setProfileData((prev) => ({ ...prev, cv: res.data.data.cv }));
            setProfileSuccess('CV uploaded successfully');
          } else {
            setProfileError(res.data?.message || 'Failed to upload CV');
          }
        }
      } catch (err: any) {
        setProfileError(err.response?.data?.message || 'Failed to upload CV');
      } finally {
        setCvUploading(false);
      }
    }
  };

  const togglePasswordVisibility = (field: PasswordField) => {
    setPasswordVisibility((prevState) => ({
      ...prevState,
      [field]: !prevState[field],
    }));
  };

  const handleProfileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prevState => ({
      ...prevState,
      [name]: value
    }));
    setProfileError('');
    setProfileSuccess('');
  };
  
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePhoto(file);
      setProfileError('');
      setProfileSuccess('');

      // Preview
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          setPhotoPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);

      // Immediate upload as avatar
      try {
        if (user?.id) {
          const res = await userAPI.uploadAvatar(user.id, file);
          if (res.data?.success && res.data?.data?.avatar) {
            // reflect avatar in UI
            setProfileData((prev) => ({ ...prev, avatar: res.data.data.avatar }));
            updateUser({ ...user, avatar: res.data.data.avatar });
            setProfileSuccess('Photo uploaded successfully');
          }
        }
      } catch (err: any) {
        setProfileError(err.response?.data?.message || 'Failed to upload photo');
      }
    }
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prevState => ({
      ...prevState,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      // Create FormData to handle file upload
      const formData = new FormData();
      
      // Add all profile data fields
      Object.entries(profileData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Add profile photo if selected
      if (profilePhoto) {
        formData.append('profilePhoto', profilePhoto);
      }
      // Add emergency contact
      formData.append('emergencyContact.name', emergencyContact.name);
      formData.append('emergencyContact.phone', emergencyContact.phone);
      formData.append('emergencyContact.relationship', emergencyContact.relationship);
      // Add skills (comma-separated -> array)
      const skillsArr = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      skillsArr.forEach((s) => formData.append('skills', s));
      // Normalize number/date
      if (profileData.salary) {
        formData.set('salary', String(Number(profileData.salary)));
      }
      if (profileData.hireDate) {
        formData.set('hireDate', profileData.hireDate);
      }
      
      const response = await userAPI.updateProfileWithPhoto(formData);
      if (response.data.success) {
        setProfileSuccess('Profile updated successfully!');
        
        // Update auth context with the updated user data
        if (response.data.data) {
          updateUser(response.data.data);
        }
      } else {
        setProfileError(response.data.message || 'Failed to update profile');
      }
    } catch (err: any) {
      setProfileError(err.response?.data?.message || 'Failed to update profile');
      console.error('Update profile error:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setError('');
    setSuccess('');

    // Basic validations
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('Please fill all password fields');
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await userAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword
      });
      if (response.data.success) {
        setSuccess('Password changed successfully!');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setError(response.data.message || 'Failed to change password');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
      console.error('Change password error:', err);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signout();
    navigate(route.login, { replace: true });
  };

  const countryChoose = [
    { value: "Select", label: "Select" },
    { value: "Tunisia", label: "Tunisia" },
  ];
  const stateChoose = [
    { value: "Select", label: "Select" },
    { value: "Tunis", label: "Tunis" },
    { value: "Ariana", label: "Ariana" },
    { value: "Ben Arous", label: "Ben Arous" },
    { value: "Manouba", label: "Manouba" },
    { value: "Nabeul", label: "Nabeul" },
    { value: "Zaghouan", label: "Zaghouan" },
    { value: "Bizerte", label: "Bizerte" },
    { value: "Béja", label: "Béja" },
    { value: "Jendouba", label: "Jendouba" },
    { value: "Le Kef", label: "Le Kef" },
    { value: "Siliana", label: "Siliana" },
    { value: "Sousse", label: "Sousse" },
    { value: "Monastir", label: "Monastir" },
    { value: "Mahdia", label: "Mahdia" },
    { value: "Sfax", label: "Sfax" },
    { value: "Kairouan", label: "Kairouan" },
    { value: "Kasserine", label: "Kasserine" },
    { value: "Sidi Bouzid", label: "Sidi Bouzid" },
    { value: "Gabès", label: "Gabès" },
    { value: "Médenine", label: "Médenine" },
    { value: "Tataouine", label: "Tataouine" },
    { value: "Gafsa", label: "Gafsa" },
    { value: "Tozeur", label: "Tozeur" },
    { value: "Kébili", label: "Kébili" },
  ];
  const cityChoose = [
    { value: "Select", label: "Select" },
    { value: "Tunis", label: "Tunis" },
    { value: "Sfax", label: "Sfax" },
    { value: "Sousse", label: "Sousse" },
    { value: "Kairouan", label: "Kairouan" },
    { value: "Bizerte", label: "Bizerte" },
    { value: "Gabès", label: "Gabès" },
    { value: "Gafsa", label: "Gafsa" },
    { value: "Monastir", label: "Monastir" },
    { value: "Nabeul", label: "Nabeul" },
    { value: "Mahdia", label: "Mahdia" },
    { value: "Kasserine", label: "Kasserine" },
    { value: "Kébili", label: "Kébili" },
    { value: "Tozeur", label: "Tozeur" },
    { value: "Médenine", label: "Médenine" },
    { value: "Tataouine", label: "Tataouine" },
  ];

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {user?.role === 'STARTUP' ? (
            <>
              {/* Breadcrumb */}
              <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
                <div className="my-auto mb-2">
                  <h2 className="mb-1">Profil STARTUP</h2>
                  <nav>
                    <ol className="breadcrumb mb-0">
                      <li className="breadcrumb-item">
                        <Link to={route.adminDashboard}>
                          <i className="ti ti-smart-home" />
                        </Link>
                      </li>
                      <li className="breadcrumb-item">Pages</li>
                      <li className="breadcrumb-item active" aria-current="page">
                        Profil STARTUP
                      </li>
                    </ol>
                  </nav>
                </div>
                <div className="head-icons ms-2">
                  <CollapseHeader />
                </div>
              </div>
              {/* /Breadcrumb */}

              <StartupProfileForm />
            </>
          ) : (
            <>
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Profile </h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={route.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Pages</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Profile{" "}
                  </li>
                </ol>
              </nav>
            </div>
            <div className="head-icons ms-2">
              <CollapseHeader />
            </div>
          </div>
          {/* /Breadcrumb */}

          {/* Success/Error Messages */}
          {profileSuccess && (
            <div className="alert alert-success mb-3" role="alert">
              <i className="ti ti-check-circle me-2"></i>
              {profileSuccess}
            </div>
          )}
          {profileError && (
            <div className="alert alert-danger mb-3" role="alert">
              <i className="ti ti-alert-circle me-2"></i>
              {profileError}
            </div>
          )}

          <div className="card">
            <div className="card-body">
              <div className="border-bottom mb-3 pb-3">
                <h4>Profile </h4>
              </div>
              <form onSubmit={handleProfileSubmit}>
                <div className="border-bottom mb-3">
                  <div className="row">
                    <div className="col-md-12">
                      <div>
                        <h6 className="mb-3">Basic Information</h6>
                        <div className="d-flex align-items-center flex-wrap row-gap-3 bg-light w-100 rounded p-3 mb-4">
                          <div className="d-flex align-items-center justify-content-center avatar avatar-xxl rounded-circle border border-dashed me-2 flex-shrink-0 text-dark frames">
                            {photoPreview ? (
                              <img 
                                src={photoPreview} 
                                alt="Profile Preview" 
                                className="rounded-circle w-100 h-100 object-fit-cover" 
                              />
                            ) : profileData.avatar ? (
                              <img 
                                src={profileData.avatar?.startsWith('http') ? profileData.avatar : `${API_BASE_URL}${profileData.avatar}`} 
                                alt="Avatar" 
                                className="rounded-circle w-100 h-100 object-fit-cover" 
                              />
                            ) : user?.profilePhoto ? (
                              <img 
                                src={user.profilePhoto?.startsWith('http') ? user.profilePhoto : `${API_BASE_URL}${user.profilePhoto}`} 
                                alt="Current Profile" 
                                className="rounded-circle w-100 h-100 object-fit-cover" 
                              />
                            ) : (
                              <i className="ti ti-photo text-gray-3 fs-16" />
                            )}
                          </div>
                          <div className="profile-upload">
                            <div className="mb-2">
                              <h6 className="mb-1">Profile Photo</h6>
                              <p className="fs-12">
                                Recommended image size is 40px x 40px
                              </p>
                            </div>
                            <div className="profile-uploader d-flex align-items-center">
                              <div className="drag-upload-btn btn btn-sm btn-primary me-2">
                                Upload
                                <input
                                  type="file"
                                  className="form-control image-sign"
                                  accept="image/*"
                                  onChange={handlePhotoUpload}
                                />
                              </div>
                              <Link
                                to="#"
                                className="btn btn-light btn-sm"
                              >
                                Cancel
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">First Name</label>
                        </div>
                        <div className="col-md-8">
                          <input 
                            type="text" 
                            name="firstName"
                            value={profileData.firstName}
                            onChange={handleProfileInputChange}
                            className="form-control" 
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Last Name</label>
                        </div>
                        <div className="col-md-8">
                          <input 
                            type="text" 
                            name="lastName"
                            value={profileData.lastName}
                            onChange={handleProfileInputChange}
                            className="form-control" 
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Email</label>
                        </div>
                        <div className="col-md-8">
                          <input 
                            type="email" 
                            name="email"
                            value={profileData.email}
                            onChange={handleProfileInputChange}
                            className="form-control" 
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Phone</label>
                        </div>
                        <div className="col-md-8">
                          <input 
                            type="text" 
                            name="phone"
                            value={profileData.phone}
                            onChange={handleProfileInputChange}
                            className="form-control" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-bottom mb-3">
                  <h6 className="mb-3">Address Information</h6>
                  <div className="row">
                    <div className="col-md-12">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-2">
                          <label className="form-label mb-md-0">Address</label>
                        </div>
                        <div className="col-md-10">
                          <input 
                            type="text" 
                            name="address"
                            value={profileData.address}
                            onChange={handleProfileInputChange}
                            className="form-control" 
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Country</label>
                        </div>
                        <div className="col-md-8">
                          <CommonSelect
                            className="select"
                            options={countryChoose}
                            defaultValue={countryChoose.find(c => c.value === profileData.country) || countryChoose[0]}
                            onChange={(selectedOption: any) => {
                              setProfileData(prevState => ({
                                ...prevState,
                                country: selectedOption.value
                              }));
                              setProfileError('');
                              setProfileSuccess('');
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">State</label>
                        </div>
                        <div className="col-md-8">
                          <div>
                            <CommonSelect
                              className="select"
                              options={stateChoose}
                              defaultValue={stateChoose.find(s => s.value === profileData.state) || stateChoose[0]}
                              onChange={(selectedOption: any) => {
                                setProfileData(prevState => ({
                                  ...prevState,
                                  state: selectedOption.value
                                }));
                                setProfileError('');
                                setProfileSuccess('');
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">City</label>
                        </div>
                        <div className="col-md-8">
                          <div>
                            <CommonSelect
                              className="select"
                              options={cityChoose}
                              defaultValue={cityChoose.find(c => c.value === profileData.city) || cityChoose[0]}
                              onChange={(selectedOption: any) => {
                                setProfileData(prevState => ({
                                  ...prevState,
                                  city: selectedOption.value
                                }));
                                setProfileError('');
                                setProfileSuccess('');
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Postal Code</label>
                        </div>
                        <div className="col-md-8">
                          <input 
                            type="text" 
                            name="postalCode"
                            value={profileData.postalCode}
                            onChange={handleProfileInputChange}
                            className="form-control" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-bottom mb-3">
                  <h6 className="mb-3">Job Details</h6>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Department</label>
                        </div>
                        <div className="col-md-8">
                          <input
                            type="text"
                            name="department"
                            value={profileData.department}
                            onChange={handleProfileInputChange}
                            className="form-control"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Position</label>
                        </div>
                        <div className="col-md-8">
                          <input
                            type="text"
                            name="position"
                            value={profileData.position}
                            onChange={handleProfileInputChange}
                            className="form-control"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Hire Date</label>
                        </div>
                        <div className="col-md-8">
                          <input
                            type="date"
                            name="hireDate"
                            value={profileData.hireDate}
                            onChange={handleProfileInputChange}
                            className="form-control"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Salary</label>
                        </div>
                        <div className="col-md-8">
                          <input
                            type="number"
                            name="salary"
                            value={profileData.salary}
                            onChange={handleProfileInputChange}
                            className="form-control"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-bottom mb-3">
                  <h6 className="mb-3">CV</h6>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Upload CV (PDF)</label>
                        </div>
                        <div className="col-md-8">
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={handleCvUpload}
                            className="form-control"
                            disabled={cvUploading}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      {profileData.cv ? (
                        <div className="d-flex align-items-center">
                          <a
                            href={profileData.cv.startsWith('http') ? profileData.cv : `${API_BASE_URL}${profileData.cv}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline-primary me-2"
                          >
                            View CV
                          </a>
                          <span className="text-muted small">PDF</span>
                        </div>
                      ) : (
                        <span className="text-muted">No CV uploaded</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-bottom mb-3">
                  <h6 className="mb-3">Emergency Contact</h6>
                  <div className="row">
                    <div className="col-md-4">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-5">
                          <label className="form-label mb-md-0">Name</label>
                        </div>
                        <div className="col-md-7">
                          <input
                            type="text"
                            value={emergencyContact.name}
                            onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })}
                            className="form-control"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-5">
                          <label className="form-label mb-md-0">Phone</label>
                        </div>
                        <div className="col-md-7">
                          <input
                            type="text"
                            value={emergencyContact.phone}
                            onChange={(e) => setEmergencyContact({ ...emergencyContact, phone: e.target.value })}
                            className="form-control"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-5">
                          <label className="form-label mb-md-0">Relationship</label>
                        </div>
                        <div className="col-md-7">
                          <input
                            type="text"
                            value={emergencyContact.relationship}
                            onChange={(e) => setEmergencyContact({ ...emergencyContact, relationship: e.target.value })}
                            className="form-control"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-bottom mb-3">
                  <h6 className="mb-3">Additional</h6>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Avatar (URL)</label>
                        </div>
                        <div className="col-md-8">
                          <input
                            type="text"
                            name="avatar"
                            value={profileData.avatar}
                            onChange={handleProfileInputChange}
                            className="form-control"
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="row align-items-center mb-3">
                        <div className="col-md-4">
                          <label className="form-label mb-md-0">Skills (comma-separated)</label>
                        </div>
                        <div className="col-md-8">
                          <input
                            type="text"
                            value={skillsText}
                            onChange={(e) => setSkillsText(e.target.value)}
                            className="form-control"
                            placeholder="e.g. React, Node.js, MongoDB"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-end">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="btn btn-outline-danger border me-3"
                  >
                    Sign Out
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={profileLoading}>
                    {profileLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      'Save Profile'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="card mt-4">
            <div className="card-body">
              <div className="border-bottom mb-3 pb-3">
                <h4>Change Password</h4>
              </div>

              {/* Password Success/Error Messages */}
              {success && (
                <div className="alert alert-success mb-3" role="alert">
                  <i className="ti ti-check-circle me-2"></i>
                  {success}
                </div>
              )}
              {error && (
                <div className="alert alert-danger mb-3" role="alert">
                  <i className="ti ti-alert-circle me-2"></i>
                  {error}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit}>
                <div className="row">
                  <div className="col-md-4">
                    <div className="row align-items-center mb-3">
                      <div className="col-md-5">
                        <label className="form-label mb-md-0">
                          Current Password
                        </label>
                      </div>
                      <div className="col-md-7">
                        <div className="pass-group">
                          <input
                            type={passwordVisibility.currentPassword ? "text" : "password"}
                            name="currentPassword"
                            value={passwordData.currentPassword}
                            onChange={handlePasswordInputChange}
                            className="pass-input form-control"
                            required
                          />
                          <span
                            className={`ti toggle-passwords ${passwordVisibility.currentPassword ? "ti-eye" : "ti-eye-off"}`}
                            onClick={() => togglePasswordVisibility("currentPassword")}
                          ></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="row align-items-center mb-3">
                      <div className="col-md-5">
                        <label className="form-label mb-md-0">New Password</label>
                      </div>
                      <div className="col-md-7">
                        <div className="pass-group">
                          <input
                            type={passwordVisibility.newPassword ? "text" : "password"}
                            name="newPassword"
                            value={passwordData.newPassword}
                            onChange={handlePasswordInputChange}
                            className="pass-input form-control"
                            required
                          />
                          <span
                            className={`ti toggle-passwords ${passwordVisibility.newPassword ? "ti-eye" : "ti-eye-off"}`}
                            onClick={() => togglePasswordVisibility("newPassword")}
                          ></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="row align-items-center mb-3">
                      <div className="col-md-5">
                        <label className="form-label mb-md-0">
                          Confirm Password
                        </label>
                      </div>
                      <div className="col-md-7">
                        <div className="pass-group">
                          <input
                            type={passwordVisibility.confirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordInputChange}
                            className="pass-input form-control"
                            required
                          />
                          <span
                            className={`ti toggle-passwords ${passwordVisibility.confirmPassword ? "ti-eye" : "ti-eye-off"}`}
                            onClick={() => togglePasswordVisibility("confirmPassword")}
                          ></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-end">
                  <button type="submit" className="btn btn-primary" disabled={passwordLoading}>
                    {passwordLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Changing Password...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
            </>
          )}
        </div>
        <div className="footer d-sm-flex align-items-center justify-content-between border-top bg-white p-3">
          <p className="mb-0">2014 - 2025 © SynergyPark.</p>
          <p>
            Designed &amp; Developed By{" "}
            <Link to="#" className="text-primary">
              Dreams
            </Link>
          </p>
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default Profile;

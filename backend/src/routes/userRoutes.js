const express = require('express');
// Use Express's Router explicitly
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { User } = require('../models/User');
// Fix the auth import to use the correct property
const { authenticateToken } = require('../middleware/auth');
const fileUpload = require('express-fileupload');

const safeString = (value) => {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
};

const parseSkills = (skillsValue) => {
  if (skillsValue === undefined || skillsValue === null) return undefined;
  if (Array.isArray(skillsValue)) {
    return skillsValue
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  const raw = String(skillsValue).trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildProfileUpdateData = (body) => {
  const updateData = {};

  const fields = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'address',
    'country',
    'state',
    'city',
    'postalCode',
    'department',
    'position',
    'avatar'
  ];

  fields.forEach((field) => {
    const parsed = safeString(body[field]);
    if (parsed !== undefined) {
      updateData[field] = parsed;
    }
  });

  if (body.hireDate !== undefined) {
    const parsedDate = safeString(body.hireDate);
    if (!parsedDate) {
      updateData.hireDate = null;
    } else {
      const dateObject = new Date(parsedDate);
      updateData.hireDate = Number.isNaN(dateObject.getTime()) ? null : dateObject;
    }
  }

  if (body.salary !== undefined) {
    const parsedSalary = Number(body.salary);
    updateData.salary = Number.isNaN(parsedSalary) ? 0 : parsedSalary;
  }

  const emergencyName = safeString(body['emergencyContact.name']);
  const emergencyPhone = safeString(body['emergencyContact.phone']);
  const emergencyRelationship = safeString(body['emergencyContact.relationship']);
  if (
    emergencyName !== undefined ||
    emergencyPhone !== undefined ||
    emergencyRelationship !== undefined
  ) {
    updateData.emergencyContact = {
      name: emergencyName || '',
      phone: emergencyPhone || '',
      relationship: emergencyRelationship || ''
    };
  }

  if (body.emergencyContact && typeof body.emergencyContact === 'object') {
    updateData.emergencyContact = {
      name: safeString(body.emergencyContact.name) || '',
      phone: safeString(body.emergencyContact.phone) || '',
      relationship: safeString(body.emergencyContact.relationship) || ''
    };
  }

  const parsedSkills = parseSkills(body.skills);
  if (parsedSkills !== undefined) {
    updateData.skills = parsedSkills;
  }

  return updateData;
};

// ✅ CREATE
router.post('/', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ READ ALL
router.get('/', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// ✅ Get User Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar || user.profilePhoto,
        phone: user.phone,
        address: user.address,
        country: user.country,
        state: user.state,
        city: user.city,
        postalCode: user.postalCode,
        department: user.department,
        position: user.position,
        hireDate: user.hireDate,
        salary: user.salary,
        cv: user.cv,
        emergencyContact: user.emergencyContact,
        skills: user.skills,
        education: user.education,
        experience: user.experience,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✅ Update User Profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updateData = buildProfileUpdateData(req.body);

    // Validate email format
    if (updateData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if email already exists (if email is being changed)
    if (updateData.email) {
      const existingUser = await User.findOne({ 
        email: updateData.email,
        _id: { $ne: req.user.userId } // Exclude current user
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    // Handle profile photo upload
    if (req.files && req.files.profilePhoto) {
      const profilePhoto = req.files.profilePhoto;
      const fileName = `${Date.now()}-${profilePhoto.name}`;
      const uploadPath = path.join(__dirname, '../../uploads/profiles', fileName);
      
      // Ensure directory exists
      if (!fs.existsSync(path.dirname(uploadPath))) {
        fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
      }
      
      // Move the uploaded file
      await profilePhoto.mv(uploadPath);
      
      // Keep both fields in sync for frontend compatibility
      updateData.profilePhoto = `/uploads/profiles/${fileName}`;
      updateData.avatar = `/uploads/profiles/${fileName}`;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✅ Security overview
router.get('/security/overview', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email passwordChangedAt lastLogin createdAt');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: {
        email: user.email,
        emailVerified: true,
        passwordLastChangedAt: user.passwordChangedAt || user.createdAt || null,
        lastLogin: user.lastLogin || null
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✅ Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All password fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    user.password = newPassword;
    await user.save();

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✅ Change email
router.put('/change-email', authenticateToken, async (req, res) => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'New email and password are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    const normalizedNewEmail = String(newEmail).trim().toLowerCase();
    const currentEmail = String(user.email || '').trim().toLowerCase();
    if (normalizedNewEmail === currentEmail) {
      return res.status(400).json({
        success: false,
        message: 'New email must be different from current email'
      });
    }

    const existingUser = await User.findOne({
      email: normalizedNewEmail,
      _id: { $ne: user._id }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use'
      });
    }

    user.email = normalizedNewEmail;
    await user.save();

    return res.json({
      success: true,
      message: 'Email changed successfully',
      data: {
        email: user.email,
        emailVerified: true
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✅ Device sessions (current session only)
router.get('/devices', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('lastLogin');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userAgent = req.get('user-agent') || 'Unknown device';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown IP';

    return res.json({
      success: true,
      data: [
        {
          id: 'current-session',
          device: userAgent,
          location: 'Current session',
          ipAddress,
          lastActiveAt: user.lastLogin || new Date(),
          isCurrent: true
        }
      ]
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✅ Delete own account
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    await User.findByIdAndDelete(user._id);

    return res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✅ READ ONE
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ UPDATE
router.put('/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ DELETE
router.delete('/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Upload Avatar
router.post('/:id/avatar', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own avatar'
      });
    }
    
    if (!req.files || !req.files.avatar) {
      return res.status(400).json({
        success: false,
        message: 'No avatar file uploaded'
      });
    }

    const avatar = req.files.avatar;
    const fileName = `${Date.now()}-${avatar.name}`;
    const uploadPath = path.join(__dirname, '../../uploads/profiles', fileName);
    
    // Ensure directory exists
    if (!fs.existsSync(path.dirname(uploadPath))) {
      fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
    }
    
    // Move the uploaded file
    await avatar.mv(uploadPath);
    
    // Update user with new avatar
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { avatar: `/uploads/profiles/${fileName}` },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatar: updatedUser.avatar,
        profilePhoto: updatedUser.profilePhoto
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✅ Upload CV
router.post('/:id/cv', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own CV'
      });
    }

    if (!req.files || !req.files.cv) {
      return res.status(400).json({
        success: false,
        message: 'No CV file uploaded'
      });
    }

    const cv = req.files.cv;
    const fileName = `${Date.now()}-${cv.name}`;
    const uploadPath = path.join(__dirname, '../../uploads/cv', fileName);

    if (!fs.existsSync(path.dirname(uploadPath))) {
      fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
    }

    await cv.mv(uploadPath);

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { cv: `/uploads/cv/${fileName}` },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'CV uploaded successfully',
      data: {
        cv: updatedUser.cv
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ✅ Get User Stats
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // For now, return mock stats. In a real application, you would calculate these from actual data
    const mockStats = {
      totalProjects: 12,
      completedProjects: 8,
      totalHours: 240,
      averageRating: 4.5,
      leavesTaken: 10,
      leavesRemaining: 6,
      attendanceRate: 95,
      performanceScore: 87
    };

    res.json({
      success: true,
      data: mockStats
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
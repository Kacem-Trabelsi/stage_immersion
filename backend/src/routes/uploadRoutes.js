const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get the folder from request or default to 'posts'
    const folder = req.body.folder || 'posts';
    const uploadPath = path.join(__dirname, '../../uploads', folder);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  }
});

// File filter to restrict file types
const fileFilter = (req, file, cb) => {
  // Accept images, videos, PDFs, docs, etc.
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, videos, PDFs, and office documents are allowed.'), false);
  }
};

// Set up multer with limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
    files: 10 // Maximum 10 files per upload
  }
});

// Default upload route (root path)
router.post('/', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Get file path relative to the uploads directory
    const relativePath = path.relative(
      path.join(__dirname, '../../uploads'),
      req.file.path
    ).replace(/\\/g, '/'); // Convert Windows backslashes to forward slashes
    
    // Return the file URL for client use
    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileUrl: '/uploads/' + relativePath,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      }
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({
      success: false,
      message: 'Error uploading file: ' + err.message
    });
  }
});

// Upload single file
router.post('/single', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Get file path relative to the uploads directory
    const relativePath = path.relative(
      path.join(__dirname, '../../uploads'),
      req.file.path
    ).replace(/\\/g, '/'); // Convert Windows backslashes to forward slashes
    
    // Return the file URL for client use
    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileUrl: '/uploads/' + relativePath,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      }
    });
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({
      success: false,
      message: 'Error uploading file: ' + err.message
    });
  }
});

// Upload multiple files
router.post('/multiple', authenticateToken, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    // Process all files and get their URLs
    const filesData = req.files.map(file => {
      const relativePath = path.relative(
        path.join(__dirname, '../../uploads'),
        file.path
      ).replace(/\\/g, '/'); // Convert Windows backslashes to forward slashes
      
      return {
        fileUrl: '/uploads/' + relativePath,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size
      };
    });
    
    // Return all file URLs for client use
    res.status(200).json({
      success: true,
      message: `${req.files.length} files uploaded successfully`,
      data: {
        files: filesData,
        fileUrls: filesData.map(file => file.fileUrl)
      }
    });
  } catch (err) {
    console.error('Error uploading files:', err);
    res.status(500).json({
      success: false,
      message: 'Error uploading files: ' + err.message
    });
  }
});

// Delete a file
router.delete('/', authenticateToken, (req, res) => {
  try {
    const { fileUrl } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'File URL is required'
      });
    }
    
    // Extract the file path from URL
    const filePath = path.join(__dirname, '../..', fileUrl);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting file: ' + err.message
    });
  }
});

// Get file metadata
router.get('/metadata', authenticateToken, (req, res) => {
  try {
    const { fileUrl } = req.query;
    
    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: 'File URL is required'
      });
    }
    
    // Extract the file path from URL
    const filePath = path.join(__dirname, '../..', fileUrl);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const extension = path.extname(fileName);
    
    res.status(200).json({
      success: true,
      data: {
        fileName: fileName,
        fileSize: stats.size,
        fileType: extension,
        created: stats.birthtime,
        modified: stats.mtime
      }
    });
  } catch (err) {
    console.error('Error getting file metadata:', err);
    res.status(500).json({
      success: false,
      message: 'Error getting file metadata: ' + err.message
    });
  }
});

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 10 files allowed'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  }
  next(err);
});

module.exports = router;

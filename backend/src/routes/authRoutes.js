const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Route to initiate GitHub OAuth
router.get('/github', authController.redirectToGithub);

// GitHub OAuth callback route
router.get('/github/callback', authController.handleCallback);

// Success landing page
router.get('/success', authController.renderSuccessPage);

// Error landing page
router.get('/error', authController.renderErrorPage);

module.exports = router;

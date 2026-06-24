const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const authRoutes = require('./routes/authRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Configure CORS to allow the chrome extension to talk to it (optionally)
app.use(cors());

// Parse JSON and urlencoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route - Welcome and setup helper
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LeetCelebrate Backend</title>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Outfit', sans-serif;
          background-color: #0d1117;
          color: #c9d1d9;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          text-align: center;
        }
        .card {
          background-color: #161b22;
          border: 1px solid #30363d;
          border-radius: 16px;
          padding: 40px;
          max-width: 500px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        h1 {
          color: #58a6ff;
          margin-bottom: 20px;
          font-weight: 800;
        }
        p {
          font-size: 16px;
          color: #8b949e;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .btn {
          display: inline-block;
          background-color: #21262d;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          transition: 0.2s ease;
        }
        .btn:hover {
          background-color: #30363d;
          border-color: #8b949e;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>LeetCelebrate Backend</h1>
        <p>This server facilitates secure OAuth token exchanges for the LeetCelebrate Chrome Extension.</p>
        <a href="/auth/github" class="btn">Connect GitHub Account</a>
      </div>
    </body>
    </html>
  `);
});

// Register auth routes under /auth
app.use('/auth', authRoutes);

// Register global error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`[SERVER] LeetCelebrate Backend running in ${config.nodeEnv} mode on port ${config.port}`);
  console.log(`[SERVER] GitHub Redirect URI configured as: ${config.githubRedirectUri}`);
});

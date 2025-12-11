const express = require('express');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config(); // For local development

const app = express();
const port = process.env.PORT || 8080;

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://ipapi.co"],
      },
    },
  })
);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ================== MAIN APP ==================
(async () => {
  try {
    // Use DATABASE_URL directly from env (set in app.yaml)
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set.');
    }

    // Sequelize connection
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
    });

    // Visit model
    const Visit = sequelize.define('Visit', {
      ip: { type: DataTypes.STRING },
      user_agent: { type: DataTypes.TEXT },
      city: { type: DataTypes.STRING },
      region: { type: DataTypes.STRING },
      country: { type: DataTypes.STRING },
      latitude: { type: DataTypes.STRING },
      longitude: { type: DataTypes.STRING },
      visited_at: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    });

    // Test DB + sync
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    await Visit.sync();

    // ---------- Routes ----------

    // Root
    app.get('/', (req, res) => {
      res.send('App is running and connected to the database.');
    });

    // Custom About route (your modification)
    app.get('/about', (req, res) => {
      res.send('This is a custom About page added by Aaron.');
    });

    // Healthcheck for GCP
    app.get('/_health', async (_req, res) => {
      try {
        await sequelize.authenticate();
        res.status(200).json({
          status: 'ok',
          database: 'connected',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(503).json({
          status: 'error',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Favicon
    app.get('/favicon.ico', (_req, res) => {
      res.status(204).end();
    });

    // Log client info
    app.get('/api/client-info', apiLimiter, async (req, res) => {
      let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      if (ip === '::1' || ip === '127.0.0.1') {
        ip = 'localhost';
      }

      let locationData = {
        city: 'N/A',
        region: 'N/A',
        country: 'N/A',
        latitude: 'N/A',
        longitude: 'N/A',
      };

      if (ip !== 'localhost' && ip !== 'Unknown') {
        try {
          const response = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 3000 });
          locationData = {
            city: response.data.city || 'N/A',
            region: response.data.region || 'N/A',
            country: response.data.country_name || 'N/A',
            latitude: response.data.latitude || 'N/A',
            longitude: response.data.longitude || 'N/A',
          };
        } catch (error) {
          console.log('Geolocation API request failed:', error.message);
        }
      }

      try {
        await Visit.create({
          ip,
          user_agent: userAgent,
          city: locationData.city,
          region: locationData.region,
          country: locationData.country,
          latitude: locationData.latitude.toString(),
          longitude: locationData.longitude.toString(),
        });
      } catch (error) {
        console.error('Database error:', error.message);
      }

      res.json({
        ip,
        userAgent,
        locationData,
      });
    });

    // Paginated logs
    app.get('/api/logs', apiLimiter, async (req, res) => {
      const { page = 1, limit = 10 } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: 'Invalid page number. Must be a positive integer.' });
      }

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({ error: 'Invalid limit. Must be between 1 and 100.' });
      }

      const offset = (pageNum - 1) * limitNum;

      try {
        const { count, rows } = await Visit.findAndCountAll({
          offset,
          limit: limitNum,
          order: [['visited_at', 'DESC']],
        });

        res.json({
          totalRecords: count,
          currentPage: pageNum,
          totalPages: Math.ceil(count / limitNum),
          logs: rows,
        });
      } catch (error) {
        console.error('Error fetching logs:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Logs page
    app.get('/logs', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'logs.html'));
    });

    // Start server
    const server = app.listen(port, () => {
      console.log(`App running at http://localhost:${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(async () => {
        console.log('HTTP server closed');
        try {
          await sequelize.close();
          console.log('Database connection closed');
          process.exit(0);
        } catch (error) {
          console.error('Error closing database connection:', error.message);
          process.exit(1);
        }
      });
    });
  } catch (error) {
    console.error('Failed to initialize application:', error.message);
    process.exit(1);
  }
})();

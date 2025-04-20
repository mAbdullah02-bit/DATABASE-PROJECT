const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db'); // Assuming you created db.js for DB connection

const app = express();
const port = 5000;

// Middleware to parse incoming requests
app.use(express.json());
app.use(cors()); // Allow cross-origin requests from frontend

// Example API route (Login)
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Query database to find user with matching email and password
  db.query(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (results.length > 0) {
        res.json({ message: 'Login successful', user: results[0] });
      } else {
        res.status(400).json({ message: 'Invalid email or password' });
      }
    }
  );
});


// Example API route (Signup)
app.post('/signup', (req, res) => {
    const { firstName, lastName, email, password } = req.body;
  
    db.query(
      'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
      [firstName, lastName, email, password],
      (err, results) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Database error' });
        }
        res.json({ message: 'Signup successful' });
      }
    );
  });

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

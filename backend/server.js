const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db'); // DB connection

const app = express();
const port = 5000;

app.use(express.json());
app.use(cors());

// -------------------------
// Signup Route
// -------------------------
app.post('/signup', (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    // Hash the password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).json({ message: 'Error processing request' });
        }

        // Default role: 'customer'
        db.query(
            'INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [firstName, lastName, email, hashedPassword, 'customer'],
            (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: 'Database error' });
                }
                res.json({ message: 'Signup successful' });
            }
        );
    });
});

// -------------------------
// Login Route
// -------------------------
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // First fetch the user by email
    db.query(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Database error' });
            }

            if (results.length === 0) {
                return res.status(400).json({ message: 'Invalid email or password' });
            }

            const user = results[0];

            // Compare hashed password
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing passwords:', err);
                    return res.status(500).json({ message: 'Error processing request' });
                }

                if (isMatch) {
                    res.json({
                        message: 'Login successful',
                        user: {
                            id: user.id,
                            firstName: user.first_name,
                            lastName: user.last_name,
                            email: user.email,
                            role: user.role  // 🔥 KEY: we return the role!
                        }
                    });
                } else {
                    res.status(400).json({ message: 'Invalid email or password' });
                }
            });
        }
    );
});

// -------------------------
// Start Server
// -------------------------
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

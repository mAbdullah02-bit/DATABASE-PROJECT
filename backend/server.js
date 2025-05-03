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

  db.query(
    'SELECT * FROM users WHERE email = ?',
    [email],
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      if (results.length > 0) {
        const user = results[0];
        // Compare passwords
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (isMatch) {
            res.json({ message: 'Login successful', user });
          } else {
            res.status(400).json({ message: 'Invalid credentials' });
          }
        });
      } else {
        res.status(400).json({ message: 'Invalid email' });
      }
    }
  );
});
app.post('/admin/add-game', (req, res) => {
  const { title, description, price, genre, platform, stock_quantity,imageURL } = req.body;
  
  const insertGame = 'INSERT INTO games (title, description, price, genre, platform, imageURL) VALUES (?, ?, ?, ?, ?, ?)';

  
  db.query(insertGame, [title, description, price, genre, platform,imageURL || null], (err, result) => {
    if (err) {
      console.error('Error adding game:', err);
      return res.status(500).json({ message: 'Error adding game' });
    }
    
    const gameId = result.insertId;
    
    const insertInventory = 'INSERT INTO inventory (game_id, stock_quantity) VALUES (?, ?)';
    db.query(insertInventory, [gameId, stock_quantity], (err2) => {
      if (err2) {
        console.error('Error adding inventory:', err2);
        return res.status(500).json({ message: 'Error adding inventory' });
      }
      
      res.json({ message: 'Game and inventory added successfully', newGame: { game_id: gameId, title, description, price, genre, platform, stock_quantity } });
    });
  });
});

// Get all games (JOIN with inventory)
app.get('/admin/games', (req, res) => {
  const sql = `
    SELECT g.*, i.stock_quantity
    FROM games g
    LEFT JOIN inventory i ON g.game_id = i.game_id
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching games:', err);
      return res.status(500).json({ message: 'Error fetching games' });
    }
    res.json(results);
  });
});

// Edit game
app.put('/admin/edit-game/:game_id', (req, res) => {
  const gameId = req.params.game_id;
  const { title, description, price, genre, platform, stock_quantity,imageURL } = req.body;
  
  const updateGame = `
    UPDATE games
    SET title = ?, description = ?, price = ?, genre = ?, platform = ?,imageURL = ?
    WHERE game_id = ?
  `;
  
  db.query(updateGame, [title, description, price, genre, platform , imageURL|| null, gameId], (err) => {
    if (err) {
      console.error('Error updating game:', err);
      return res.status(500).json({ message: 'Error updating game' });
    }
    
    const updateInventory = `
      UPDATE inventory
      SET stock_quantity = ?
      WHERE game_id = ?
    `;
    
    db.query(updateInventory, [stock_quantity, gameId], (err2) => {
      if (err2) {
        console.error('Error updating inventory:', err2);
        return res.status(500).json({ message: 'Error updating inventory' });
      }
      
      res.json({ message: 'Game and inventory updated successfully' });
    });
  });
});

// Delete game (also delete inventory)
app.delete('/admin/delete-game/:game_id', (req, res) => {
  const gameId = req.params.game_id;
  
  const deleteInventory = 'DELETE FROM inventory WHERE game_id = ?';
  const deleteGame = 'DELETE FROM games WHERE game_id = ?';
  
  db.query(deleteInventory, [gameId], (err) => {
    if (err) {
      console.error('Error deleting inventory:', err);
      return res.status(500).json({ message: 'Error deleting inventory' });
    }
    
    db.query(deleteGame, [gameId], (err2) => {
      if (err2) {
        console.error('Error deleting game:', err2);
        return res.status(500).json({ message: 'Error deleting game' });
      }
      
      res.json({ message: 'Game and inventory deleted successfully' });
    });
  });
});
// -------------
// fetch all games for home
// ------------

// backend/index.js or routes/games.js
app.get('/api/games', (req, res) => {
  db.query('SELECT * FROM games', (err, rows) => {
    if (err) {
      console.error('Failed to fetch games:', err);
      return res.status(500).json({ error: 'Failed to fetch games' });
    }
    res.json(rows);
  });
});


// Get a single product by ID
app.get('/api/games/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM games WHERE game_id = ?';

  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(results[0]);
  });
});

// Get related products (same category)
app.get('/api/games/:id/related', (req, res) => {
  const { id } = req.params;
  const categoryQuery = 'SELECT genre FROM games WHERE game_id = ?';

  db.query(categoryQuery, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Product not found' });

    const genre = results[0].genre;

    const relatedQuery = 'SELECT * FROM games WHERE genre = ? AND game_id != ? LIMIT 6';

    db.query(relatedQuery, [genre, id], (err2, relatedResults) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(relatedResults);
    });
    
  });
});


// -------------------------
// Start Server
// -------------------------
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

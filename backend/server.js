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

//  CART FUNCTIONALITY

app.post('/api/cart', (req, res) => {
  const { userId, gameId, quantity } = req.body;

  if (!userId || !gameId) {
    return res.status(400).json({ error: 'Missing userId or gameId' });
  }

  // First, check if the item is already in the cart
  const checkQuery = 'SELECT * FROM cart WHERE userId = ? AND gameId = ?';
  db.query(checkQuery, [userId, gameId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    if (results.length > 0) {
      // Already in cart ➔ update quantity
      const newQuantity = results[0].quantity + (quantity || 1);
      const updateQuery = 'UPDATE cart SET quantity = ? WHERE userId = ? AND gameId = ?';
      db.query(updateQuery, [newQuantity, userId, gameId], (err2) => {
        if (err2) return res.status(500).json({ error: 'Failed to update cart' });
        res.json({ message: 'Cart updated successfully' });
      });
    } else {
      // Not in cart ➔ insert new row
      const insertQuery = 'INSERT INTO cart (userId, gameId, quantity) VALUES (?, ?, ?)';
      db.query(insertQuery, [userId, gameId, quantity || 1], (err3) => {
        if (err3) return res.status(500).json({ error: 'Failed to add to cart' });
        res.json({ message: 'Item added to cart' });
      });
    }
  });
});

app.get('/api/cart/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT cart.id AS cartId, games.game_id AS gameId, games.title, games.price, games.imageURL, cart.quantity
FROM cart
JOIN games ON cart.gameId = games.game_id
WHERE cart.userId = ?

  `;
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch cart items' });
    res.json(results);
  });
});


app.delete('/api/cart/:cartId', (req, res) => {
  const { cartId } = req.params;
  const query = 'DELETE FROM cart WHERE id = ?';
  db.query(query, [cartId], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to remove item' });
    res.json({ message: 'Item removed successfully' });
  });
});

app.patch('/api/cart/:cartId', (req, res) => {
  const { cartId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  const query = 'UPDATE cart SET quantity = ? WHERE id = ?';
  db.query(query, [quantity, cartId], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to update quantity' });
    res.json({ message: 'Quantity updated successfully' });
  });
});
//  orderss 
app.get('/api/orders', (req, res) => {
  const query = 'SELECT * FROM orders';
  console.log("Getting all orders")
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch orders' });
    res.json(results);
  });
});

// Update order status
app.patch('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'Missing status' });

  const query = 'UPDATE orders SET status = ? WHERE order_id = ?';
  db.query(query, [status, orderId], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to update order status' });
    res.json({ message: 'Order status updated successfully' });
  });
});

app.post('/api/orders', (req, res) => {
  const { user_id, total_amount, status } = req.body;

  if (!user_id || !total_amount || !status) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Assuming the order table looks like: order_id, user_id, order_date, total_amount, status
  const query = 'INSERT INTO orders (user_id, total_amount, status, order_date) VALUES (?, ?, ?, NOW())';
  db.query(query, [user_id, total_amount, status], (err, results) => {
    if (err) {
      console.error('Error inserting order:', err);  // Log error to help debug
      return res.status(500).json({ error: 'Failed to insert order' });
    }
    
    // Successfully inserted order, return success message
    res.status(200).json({
      message: 'Order placed successfully',
      order_id: results.insertId,  // 👈 send the new order ID
    });
  });
});

//update quantity
app.patch('/api/inventory/:gameId', (req, res) => {
  const { gameId } = req.params;
  const { quantity } = req.body;

  const selectQuery = 'SELECT stock_quantity FROM inventory WHERE game_id = ?';
  db.query(selectQuery, [gameId], (err, results) => {
    if (err) {
      console.error('Error fetching inventory:', err);
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const currentStock = results[0].stock_quantity;
    if (currentStock < quantity) {
      return res.status(400).json({ error: 'Not enough stock' });
    }

    const newStock = currentStock - quantity;
    const updateQuery = 'UPDATE inventory SET stock_quantity = ? WHERE game_id = ?';
    db.query(updateQuery, [newStock, gameId], (updateErr) => {
      if (updateErr) {
        console.error('Error updating inventory:', updateErr);
        return res.status(500).json({ error: 'Failed to update inventory' });
      }
      res.status(200).json({ message: 'Inventory updated successfully' });
    });
  });
});


// order tracking and payment
app.post('/api/orders/pay', (req, res) => {
  const { order_id, method } = req.body;
  if (!order_id || !method) return res.status(400).json({ error: 'Missing orderId or method' });

  const updateQuery = 'UPDATE orders SET status = ? WHERE order_id = ?';
  db.query(updateQuery, ['Completed', order_id], (err) => {
    if (err) return res.status(500).json({ error: 'Payment failed' });
    res.json({ message: 'Payment successful' });
  });
});
app.post('/api/pay', async (req, res) => {
  const { userId, orderId, method } = req.body;

  if (!userId || !orderId || !method) {
    return res.status(400).json({ message: 'Missing userId, orderId, or method' });
  }

  const paymentDate = new Date(); // Current date/time

  try {
    const [result] = await db.execute(
      `INSERT INTO Payment (userId, orderId, PaymentDate, method)
       VALUES (?, ?, ?, ?)`,
      [userId, orderId, paymentDate, method]
    );

    res.status(201).json({
      message: 'Payment record created successfully',
      paymentId: result.insertId,
    });
  } catch (error) {
    console.error('Error inserting payment:', error);
    res.status(500).json({ message: 'Failed to insert payment' });
  }
});


app.get('/api/orders/:userId', (req, res) => {
  console.log('HIT /api/orders/:userId with', req.params.userId);  // <- log this
  const userId = req.params.userId;
  const query = 'SELECT * FROM orders WHERE user_id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('DB ERROR:', err);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
    res.json(results);
  });
});

// -------------------------
// Start Server
// -------------------------
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Database initialization
const db = new sqlite3.Database('./database.sqlite');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Products table - REMOVE featured column
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    price DECIMAL(10,2),
    image_url TEXT,
    category TEXT,
    stock INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Orders table
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total_amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Order items table
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price DECIMAL(10,2),
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  // Reviews table
  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    user_id INTEGER,
    rating INTEGER,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Clear existing products and insert fresh sample data
  db.run('DELETE FROM products', () => {
    const sampleProducts = [
      ['MacBook Pro', 'Powerful laptop for professionals', 1299.99, '/images/laptop.jpg', 'Electronics', 10],
      ['iPhone 15', 'Latest smartphone with advanced camera', 999.99, '/images/phone.jpg', 'Electronics', 15],
      ['Sony Headphones', 'Noise-cancelling wireless headphones', 299.99, '/images/headphones.jpg', 'Electronics', 20],
      ['Cotton T-Shirt', 'Premium quality cotton t-shirt', 24.99, '/images/tshirt.jpg', 'Clothing', 50],
      ['Designer Coffee Mug', 'Elegant ceramic coffee mug', 19.99, '/images/mug.jpg', 'Home', 30],
      ['Running Shoes', 'Comfortable running shoes', 89.99, '/images/shoes.jpg', 'Sports', 25],
      ['Smart Watch', 'Feature-rich smartwatch', 199.99, '/images/watch.jpg', 'Electronics', 12]
    ];

    const insertProduct = db.prepare(`INSERT INTO products 
      (name, description, price, image_url, category, stock) VALUES (?, ?, ?, ?, ?, ?)`);
    
    sampleProducts.forEach(product => {
      insertProduct.run(product);
    });
    insertProduct.finalize();
    console.log('Sample products inserted successfully');
  });
});

// Create images directory
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// User registration
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'User already exists' });
        }
        
        const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET);
        res.json({ 
          message: 'User registered successfully',
          token,
          user: { id: this.lastID, username, email }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    try {
      if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({
          message: 'Login successful',
          token,
          user: { id: user.id, username: user.username, email: user.email }
        });
      } else {
        res.status(400).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Get all products
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get featured products (manually define featured product IDs)
app.get('/api/products/featured', (req, res) => {
  // Manually specify which product IDs are featured
  const featuredIds = [1, 2, 4]; // MacBook Pro, iPhone 15, Cotton T-Shirt
  
  db.all('SELECT * FROM products WHERE id IN (?, ?, ?)', featuredIds, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
    if (err || !row) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(row);
  });
});

// Create order
app.post('/api/orders', authenticateToken, (req, res) => {
  const { items, totalAmount } = req.body;
  const userId = req.user.id;

  db.serialize(() => {
    db.run(
      'INSERT INTO orders (user_id, total_amount) VALUES (?, ?)',
      [userId, totalAmount],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create order' });
        }

        const orderId = this.lastID;
        const insertItem = db.prepare(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'
        );

        items.forEach(item => {
          insertItem.run([orderId, item.id, item.quantity, item.price]);
        });

        insertItem.finalize(() => {
          res.json({ 
            message: 'Order created successfully', 
            orderId: orderId 
          });
        });
      }
    );
  });
});

// Get user orders
app.get('/api/orders', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.all(`
    SELECT o.*, oi.product_id, oi.quantity, oi.price, p.name as product_name 
    FROM orders o 
    LEFT JOIN order_items oi ON o.id = oi.order_id 
    LEFT JOIN products p ON oi.product_id = p.id 
    WHERE o.user_id = ?
  `, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Search products
app.get('/api/products/search/:query', (req, res) => {
  const { query } = req.params;
  db.all(
    `SELECT * FROM products WHERE name LIKE ? OR description LIKE ? OR category LIKE ?`,
    [`%${query}%`, `%${query}%`, `%${query}%`],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Get products by category
app.get('/api/products/category/:category', (req, res) => {
  const { category } = req.params;
  db.all('SELECT * FROM products WHERE category = ?', [category], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Add product reviews
app.post('/api/products/:id/reviews', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user.id;
  
  db.run(
    'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
    [id, userId, rating, comment],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to add review' });
      }
      res.json({ message: 'Review added successfully', reviewId: this.lastID });
    }
  );
});

// Get product reviews
app.get('/api/products/:id/reviews', (req, res) => {
  const { id } = req.params;
  
  db.all(`
    SELECT r.*, u.username 
    FROM reviews r 
    JOIN users u ON r.user_id = u.id 
    WHERE r.product_id = ?
  `, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
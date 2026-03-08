const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { register, login } = require('./authController');
const authenticateToken = require('./authMiddleware');

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

async function requireAdmin(req, res, next) {
  try {
    const userId = req.user?.id;
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'User not found' });
    }

    if (result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    return next();
  } catch (err) {
    console.error('Admin check error:', err);
    return res.status(500).json({ error: 'Failed to verify admin role' });
  }
}

app.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.get('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, stock, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description || '', Number(price), Number(stock || 0), image_url || '']
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Product deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  const user_id = req.user.id;
  const { product_id, quantity } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: 'product_id and quantity are required' });
  }

  const productIdNum = Number(product_id);
  const quantityNum = Number(quantity || 1);

  try {
    const existing = await pool.query(
      'SELECT id, quantity FROM cart WHERE user_id = $1 AND product_id = $2',
      [user_id, productIdNum]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        'UPDATE cart SET quantity = quantity + $1 WHERE user_id = $2 AND product_id = $3 RETURNING id, user_id, product_id, quantity',
        [quantityNum, user_id, productIdNum]
      );
    } else {
      result = await pool.query(
        'INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING id, user_id, product_id, quantity',
        [user_id, productIdNum, quantityNum]
      );
    }

    return res.status(200).json({ message: 'Cart updated', cartItem: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

app.get('/api/cart', authenticateToken, async (req, res) => {
  const user_id = req.user.id;

  try {
    const query = `
      SELECT
        c.id,
        c.user_id,
        c.product_id,
        c.quantity,
        p.name,
        p.price,
        p.image_url
      FROM cart c
      INNER JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1
      ORDER BY c.id DESC
    `;

    const result = await pool.query(query, [user_id]);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/checkout', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const cartResult = await client.query(
      `
      SELECT c.user_id, c.product_id, c.quantity, p.price
      FROM cart c
      INNER JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1
      `,
      [userId]
    );

    if (cartResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const insertedOrders = await client.query(
      `
      INSERT INTO orders (user_id, product_id, quantity, price_at_purchase)
      SELECT c.user_id, c.product_id, c.quantity, p.price
      FROM cart c
      INNER JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1
      RETURNING id, user_id, product_id, quantity, price_at_purchase, created_at
      `,
      [userId]
    );

    await client.query('DELETE FROM cart WHERE user_id = $1', [userId]);
    await client.query('COMMIT');

    return res.json({ message: 'Checkout done', orders: insertedOrders.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Something went wrong' });
  } finally {
    client.release();
  }
});

app.post('/auth/register', register);
app.post('/auth/login', login);

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;



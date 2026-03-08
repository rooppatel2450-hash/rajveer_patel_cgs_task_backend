require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const pool = require('./db');

const products = [
  {
    name: 'Wireless Headphones',
    description: 'Noise-cancelling over-ear headphones',
    price: 99.99,
    stock: 25,
    image_url: 'https://via.placeholder.com/300x300?text=Headphones'
  },
  {
    name: 'Smart Watch',
    description: 'Fitness tracking smartwatch',
    price: 199.99,
    stock: 18,
    image_url: 'https://via.placeholder.com/300x300?text=Smart+Watch'
  },
  {
    name: 'Laptop Stand',
    description: 'Ergonomic aluminum laptop stand',
    price: 49.99,
    stock: 30,
    image_url: 'https://via.placeholder.com/300x300?text=Laptop+Stand'
  },
  {
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard with blue switches',
    price: 129.99,
    stock: 20,
    image_url: 'https://via.placeholder.com/300x300?text=Keyboard'
  },
  {
    name: 'USB-C Hub',
    description: '7-in-1 USB-C multiport hub',
    price: 39.99,
    stock: 40,
    image_url: 'https://via.placeholder.com/300x300?text=USB+Hub'
  },
  {
    name: 'Webcam HD',
    description: '1080p USB webcam with mic',
    price: 79.99,
    stock: 22,
    image_url: 'https://via.placeholder.com/300x300?text=Webcam'
  }
];

async function run() {
  try {
    const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM products');
    const total = countResult.rows[0].total;

    if (total > 0) {
      console.log(`SKIPPED: products table already has ${total} rows`);
      return;
    }

    for (const product of products) {
      await pool.query(
        'INSERT INTO products (name, description, price, stock, image_url) VALUES ($1, $2, $3, $4, $5)',
        [product.name, product.description, product.price, product.stock, product.image_url]
      );
    }

    const finalCount = await pool.query('SELECT COUNT(*)::int AS total FROM products');
    console.log('SEEDED_PRODUCTS', finalCount.rows[0].total);
  } catch (error) {
    console.error('SEED_ERROR', error.code, error.message);
  } finally {
    await pool.end();
  }
}

run();

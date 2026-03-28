const express = require('express');
const cors = require('cors');
const db = require('./db');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend'))); 
// Listar materiales
app.get('/api/materiales', (req, res) => {
  db.query('SELECT id, nombre, cantidad, unidad FROM materiales', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Agregar material
app.post('/api/materiales', (req, res) => {
  const { nombre, cantidad, unidad } = req.body;
  db.query(
    'INSERT INTO materiales (nombre, cantidad, unidad) VALUES (?, ?, ?)',
    [nombre, cantidad || 0, unidad],
    (err, results) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Material ya existe' });
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Material agregado' });
    }
  );
});

// Comprar (sumar stock)
app.post('/api/comprar', (req, res) => {
  const { nombre, cantidad } = req.body;
  db.query(
    'UPDATE materiales SET cantidad = cantidad + ? WHERE nombre = ?',
    [cantidad, nombre],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.affectedRows === 0) return res.status(404).json({ error: 'Material no encontrado' });
      res.json({ message: 'Compra registrada' });
    }
  );
});

// Vender (restar stock)
app.post('/api/vender', (req, res) => {
  const { nombre, cantidad } = req.body;
  db.query(
    'UPDATE materiales SET cantidad = cantidad - ? WHERE nombre = ? AND cantidad >= ?',
    [cantidad, nombre, cantidad],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.affectedRows === 0) return res.status(400).json({ error: 'Stock insuficiente o material no encontrado' });
      res.json({ message: 'Venta registrada' });
    }
  );
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
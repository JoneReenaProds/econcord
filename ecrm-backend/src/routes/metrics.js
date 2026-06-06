const express = require('express');
const router = express.Router();
const MetricsRepository = require('../repositories/MetricsRepository');

// POST: Crear una nueva revisión diaria
router.post('/', async (req, res) => {
  try {
    const metricData = req.body;

    // Validación básica: el ID de la tienda es obligatorio
    if (!metricData.store_id) {
      return res.status(400).json({ error: 'El campo store_id es obligatorio.' });
    }

    const result = await MetricsRepository.create(metricData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// NUEVO GET: Obtener TODAS las métricas (Ruta que generaba el error 404)
router.get('/', async (req, res) => {
  try {
    const results = await MetricsRepository.getAll();
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// GET: Obtener métricas de una tienda específica para la vista de ClientDetail
router.get('/:store_id', async (req, res) => {
  try {
    const storeId = req.params.store_id;
    const results = await MetricsRepository.getAllByStore(storeId);
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

module.exports = router;
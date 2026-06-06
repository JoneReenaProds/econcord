const db = require('../config/db');

class MetricsRepository {
  static async create(metricData) {
    try {
      // Usamos destructuring para extraer los datos del payload
      const {
        store_id,
        server_status,
        ram_usage,
        web_flow,
        load_s,
        dom_s,
        notes
      } = metricData;

      // Insertamos en la tabla daily_metrics usando Knex
      const [newMetric] = await db('daily_metrics').insert({
        store_id,
        server_status,
        ram_usage,
        web_flow,
        load_s,
        dom_s,
        notes
      }).returning('*'); // Postgres permite devolver el registro insertado

      return newMetric;
    } catch (error) {
      throw new Error('Error al guardar la métrica en la base de datos: ' + error.message);
    }
  }

  // NUEVO: Obtener absolutamente TODAS las métricas (Para el panel global)
  static async getAll() {
    try {
      return await db('daily_metrics').orderBy('date', 'desc');
    } catch (error) {
      throw new Error('Error al obtener todas las métricas: ' + error.message);
    }
  }

  // Obtener solo las de una tienda (Para la ficha individual del cliente)
  static async getAllByStore(storeId) {
    try {
      return await db('daily_metrics')
        .where({ store_id: storeId })
        .orderBy('date', 'desc');
    } catch (error) {
      throw new Error('Error al obtener las métricas de la tienda: ' + error.message);
    }
  }
}

module.exports = MetricsRepository;
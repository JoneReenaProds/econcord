import React, { useState, useEffect } from 'react';
import crmApi from '../../api/crmApi';

function MetricsPage() {
  const [metrics, setMetrics] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);

  // Filtro de búsqueda para el historial operativo
  const [metricsSearchQuery, setMetricsSearchQuery] = useState('');

  // Paginación del Gráfico Horizontal (🌟 Cambiado a máximo 7 tiendas por vista)
  const [chartCurrentPage, setChartCurrentPage] = useState(1);
  const chartStoresPerPage = 7;

  // Campos del formulario vinculados a tu PostgreSQL
  const [formData, setFormData] = useState({
    store_id: '',
    server_status: 'ONLINE',
    ram_usage: '',
    web_flow: '',
    load_s: '', 
    dom_s: ''   
  });

  // Función extractor inteligente para blindar las respuestas del backend
  const extraerArreglo = (response) => {
    if (!response || !response.data) return [];
    if (Array.isArray(response.data)) return response.data;
    if (response.data.data && Array.isArray(response.data.data)) return response.data.data;
    if (response.data.result && Array.isArray(response.data.result)) return response.data.result;
    
    // Fallback: Busca cualquier propiedad interna que sea un arreglo
    const arregloEncontrado = Object.values(response.data).find(val => Array.isArray(val));
    return arregloEncontrado || [];
  };

  const fetchMetricsData = async () => {
    try {
      setLoading(true);

      // 1. Cargar Tiendas con extracción tolerante
      try {
        const storesRes = await crmApi.get('/stores');
        const tiendasProcesadas = extraerArreglo(storesRes);
        setStores(tiendasProcesadas);
        
        if (tiendasProcesadas.length > 0) {
          setFormData(prev => ({ ...prev, store_id: tiendasProcesadas[0].id }));
        }
      } catch (e) {
        console.error("Error al recuperar tiendas:", e);
      }

      // 2. Cargar Métricas con extracción tolerante
      try {
        const metricsRes = await crmApi.get('/metrics');
        const metricasProcesadas = extraerArreglo(metricsRes);
        setMetrics(metricasProcesadas);
      } catch (e) {
        console.error("Error al recuperar métricas:", e);
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricsData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.store_id) return;

    try {
      const dataToSend = {
        store_id: formData.store_id,
        server_status: formData.server_status,
        ram_usage: parseFloat(formData.ram_usage || 0),
        web_flow: formData.web_flow.trim(),
        load_s: parseFloat(formData.load_s || 0),
        dom_s: parseFloat(formData.dom_s || 0)
      };

      const response = await crmApi.post('/metrics', dataToSend);
      if (response.data.success || response.status === 200 || response.status === 201) {
        alert('Métricas registradas con éxito.');
        setShowPopup(false);
        setFormData(prev => ({
          ...prev,
          ram_usage: '',
          web_flow: '',
          load_s: '',
          dom_s: ''
        }));
        fetchMetricsData(); 
      }
    } catch (error) {
      console.error(error);
      alert('Error al guardar en el servidor.');
    }
  };

  // ==========================================================================
  // FILTRADO DINÁMICO DE LA BARRA DE BÚSQUEDA DEL HISTORIAL
  // ==========================================================================
  const filteredMetrics = metrics.filter(m => {
    if (!m) return false;
    const storeObj = stores.find(s => String(s.id) === String(m.store_id));
    const nombreTienda = storeObj ? storeObj.name.toLowerCase() : '';
    const idTienda = m.store_id ? String(m.store_id).toLowerCase() : '';
    const webFlowText = m.web_flow ? String(m.web_flow).toLowerCase() : '';
    const query = metricsSearchQuery.toLowerCase().trim();

    return nombreTienda.includes(query) || idTienda.includes(query) || webFlowText.includes(query);
  });

  // ==========================================================================
  // PROCESAMIENTO DEL GRÁFICO HORIZONTAL (3 Barras por Tienda Individual)
  // ==========================================================================
  const storeChartGroups = stores.map(store => {
    const storeRecords = metrics.filter(m => String(m.store_id) === String(store.id));
    
    // Ignoramos valores NULL de la base de datos para promediar limpiamente
    const validLoad = storeRecords.filter(m => m.load_s !== null && m.load_s !== undefined);
    const validDom = storeRecords.filter(m => m.dom_s !== null && m.dom_s !== undefined);
    const validRam = storeRecords.filter(m => m.ram_usage !== null && m.ram_usage !== undefined);

    const avgLoad = validLoad.length > 0 ? validLoad.reduce((sum, m) => sum + parseFloat(m.load_s), 0) / validLoad.length : 0;
    const avgDom = validDom.length > 0 ? validDom.reduce((sum, m) => sum + parseFloat(m.dom_s), 0) / validDom.length : 0;
    const avgRam = validRam.length > 0 ? validRam.reduce((sum, m) => sum + parseFloat(m.ram_usage), 0) / validRam.length : 0;

    return {
      id: store.id,
      name: store.name,
      avgLoad,
      avgDom,
      avgRam
    };
  });

  // Paginación del gráfico horizontal (7 bloques de tiendas como máximo)
  const indexOfLastChartItem = chartCurrentPage * chartStoresPerPage;
  const indexOfFirstChartItem = indexOfLastChartItem - chartStoresPerPage;
  const currentChartStores = storeChartGroups.slice(indexOfFirstChartItem, indexOfLastChartItem);
  const totalChartPages = Math.ceil(storeChartGroups.length / chartStoresPerPage);

  if (loading) return <div className="crm-text-loading">Cargando analíticas...</div>;

  return (
    <div>
      {/* Barra de Acciones */}
      <div className="crm-actions-bar">
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Métricas Generales</h1>
        <button onClick={() => setShowPopup(true)} className="crm-btn-black">
          Registrar Diario
        </button>
      </div>

      {/* Gráfico de Distribución Horizontal */}
      <div className="crm-card-paper" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px dotted #111111', paddingBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: 'system-ui, sans-serif' }}>Rendimiento Técnico por Tienda</h3>
          
          {/* Leyenda e-Ink */}
          <div style={{ display: 'flex', gap: '14px', fontSize: '12px', fontFamily: 'system-ui, sans-serif' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#111111' }}></div> Load (s)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#555555' }}></div> DOM (s)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#ffffff', border: '1px solid #111111' }}></div> RAM (MB)</span>
          </div>
        </div>

        {/* Contenedor del Gráfico Horizontal */}
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'flex-start', alignItems: 'flex-end', minHeight: '260px', paddingBottom: '12px', overflowX: 'auto' }}>
          {currentChartStores.length === 0 ? (
            <div className="crm-text-loading" style={{ width: '100%' }}>No hay suficientes datos para procesar el gráfico.</div>
          ) : (
            currentChartStores.map(sc => {
              // Escalas visuales adaptativas
              const hLoad = Math.min((sc.avgLoad / 5) * 100, 100);
              const hDom = Math.min((sc.avgDom / 5) * 100, 100);
              const hRam = Math.min((sc.avgRam / 1024) * 100, 100);

              return (
                <div key={sc.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #c8c6c1', padding: '16px 12px', borderRadius: '8px', backgroundColor: '#fcfbfa', minWidth: '170px' }}>
                  <div style={{ display: 'flex', gap: '10px', height: '160px', alignItems: 'flex-end', justifyContent: 'center', width: '100%', borderBottom: '1px solid #111111', paddingBottom: '4px' }}>
                    
                    {/* Barra 1: Load (Negro) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ height: `${Math.max(hLoad, 6)}%`, backgroundColor: '#111111', width: '100%', position: 'relative' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#111111', position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{sc.avgLoad.toFixed(1)}s</span>
                      </div>
                    </div>

                    {/* Barra 2: DOM (Gris) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ height: `${Math.max(hDom, 6)}%`, backgroundColor: '#555555', width: '100%', position: 'relative' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#111111', position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{sc.avgDom.toFixed(1)}s</span>
                      </div>
                    </div>

                    {/* Barra 3: RAM (Blanco con Borde) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32px', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ height: `${Math.max(hRam, 6)}%`, backgroundColor: '#ffffff', border: '1px solid #111111', width: '100%', position: 'relative', boxSizing: 'border-box' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#111111', position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{Math.round(sc.avgRam)}M</span>
                      </div>
                    </div>

                  </div>
                  <span style={{ fontSize: '12px', marginTop: '10px', textAlign: 'center', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '150px' }}>{sc.name}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Controles de la Paginación del Gráfico Horizontal */}
        {totalChartPages > 1 && (
          <div className="crm-pagination-box" style={{ marginTop: '16px', borderTop: '1px dotted #c8c6c1', paddingTop: '12px' }}>
            <button disabled={chartCurrentPage === 1} onClick={() => setChartCurrentPage(prev => prev - 1)} className="crm-btn-border">Anterior</button>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Páginas de Tiendas: {chartCurrentPage} / {totalChartPages}</span>
            <button disabled={chartCurrentPage === totalChartPages} onClick={() => setChartCurrentPage(prev => prev + 1)} className="crm-btn-border">Siguiente</button>
          </div>
        )}
      </div>

      {/* Historial Operativo */}
      <div className="crm-card-paper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="crm-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Registros Históricos de Rendimiento</h3>
          {/* Barra de búsqueda operativa */}
          <input 
            type="text" 
            placeholder="Buscar por tienda o flujo..." 
            value={metricsSearchQuery} 
            onChange={(e) => setMetricsSearchQuery(e.target.value)} 
            className="crm-input-text"
            style={{ width: '250px' }}
          />
        </div>

        <div className="crm-table-container">
          <table className="crm-table-data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tienda / Cliente</th>
                <th>Server Status</th>
                <th>RAM Usage</th>
                <th>Web Flow</th>
                <th>Load (s)</th>
                <th>DOM (s)</th>
              </tr>
            </thead>
            <tbody>
              {filteredMetrics.length === 0 ? (
                <tr>
                  <td colSpan="7" className="crm-text-loading">No se encontraron registros indexados in el sistema.</td>
                </tr>
              ) : (
                filteredMetrics.map(m => {
                  const associatedStore = stores.find(s => String(s.id) === String(m.store_id));
                  return (
                    <tr key={m.id}>
                      <td>{m.date ? new Date(m.date).toLocaleDateString() : '04/06/2026'}</td>
                      <td><strong>{associatedStore ? associatedStore.name : m.store_id}</strong></td>
                      <td><span className="crm-badge">{m.server_status}</span></td>
                      <td>{m.ram_usage ? `${parseFloat(m.ram_usage)} MB` : '---'}</td>
                      <td>{m.web_flow || '---'}</td>
                      <td>{m.load_s !== null && m.load_s !== undefined ? `${m.load_s}s` : '---'}</td>
                      <td>{m.dom_s !== null && m.dom_s !== undefined ? `${m.dom_s}s` : '---'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulario Pop-up */}
      {showPopup && (
        <div className="crm-modal-mask" onClick={() => setShowPopup(false)}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="crm-section-title" style={{ marginTop: 0 }}>Registro Técnico Diario</h3>
            
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Tienda / Cliente</label>
                <select name="store_id" value={formData.store_id} onChange={handleInputChange} className="crm-select-dropdown" required>
                  {stores.length === 0 ? (
                    <option value="">Cargando tiendas...</option>
                  ) : (
                    stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Server Status</label>
                <select name="server_status" value={formData.server_status} onChange={handleInputChange} className="crm-select-dropdown">
                  <option value="ONLINE">ONLINE</option>
                  <option value="OFFLINE">OFFLINE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">RAM Usage (MB)</label>
                <input type="number" step="0.01" name="ram_usage" value={formData.ram_usage} onChange={handleInputChange} className="crm-input-text" placeholder="Ej: 250" required style={{ width: 'auto' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Web Flow</label>
                <input type="text" name="web_flow" value={formData.web_flow} onChange={handleInputChange} className="crm-input-text" placeholder="Ej: Ok, Estable..." required style={{ width: 'auto' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Load (s)</label>
                  <input type="number" step="0.001" name="load_s" value={formData.load_s} onChange={handleInputChange} className="crm-input-text" placeholder="Segundos" required style={{ width: 'auto' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">DOM (s)</label>
                  <input type="number" step="0.001" name="dom_s" value={formData.dom_s} onChange={handleInputChange} className="crm-input-text" placeholder="Segundos" required style={{ width: 'auto' }} />
                </div>
              </div>

              <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                <button type="submit" className="crm-btn-black">Guardar Registro</button>
                <button type="button" onClick={() => setShowPopup(false)} className="crm-btn-red">Cancelar</button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MetricsPage;
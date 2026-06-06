import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function ClientDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  // Estados principales
  const [client, setClient] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState(false);

  // Estados para la edición de notas internas
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');

  // Estados para la edición de datos generales del cliente
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // Paginaciones Estrictas (Máximo 5 elementos por tabla)
  const [ticketCurrentPage, setTicketCurrentPage] = useState(1);
  const [metricCurrentPage, setMetricCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // 🔒 EXTRACCIÓN MAESTRA DE SEGURIDAD (PAYLOAD JWT)
  const token = localStorage.getItem('crm_token');
  let userRole = 'client'; 
  let userEmail = '';
  if (token) {
    try {
      const payload = JSON.parse(window.atob(token.split('.')[1]));
      userRole = payload.role;
      userEmail = payload.email;
    } catch (e) {
      console.error("Error decodificando token:", e);
    }
  }

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true);
        setClientError(false);
        
        let targetStoreId = storeId;

        // 🛡️ CORTAFUEGOS MULTI-TENANT PARA PERMISOS DE CLIENTES
        if (userRole === 'client') {
          if (storeId !== 'cuentacliente') {
            alert('Acceso Denegado: No tiene autorización para forzar esta consulta.');
            localStorage.removeItem('crm_token');
            navigate('/login', { replace: true });
            return;
          }

          const storesRes = await crmApi.get('/stores');
          const listaTiendas = storesRes.data.data || storesRes.data || [];
          const correoLimpio = String(userEmail).toLowerCase().trim();

          // 🔍 PARSEO MULTI-EMAIL: Dividimos la cadena por comas o espacios y buscamos coincidencia exacta de al menos 1 email
          const miTiendaReal = listaTiendas.find(store => {
            const listaCorreos = String(store.emails).toLowerCase().split(/[\s,;]+/).map(e => e.trim());
            return listaCorreos.includes(correoLimpio);
          });

          if (!miTiendaReal) {
            alert('Su cuenta de usuario no tiene asignado ningún perfil corporativo activo.');
            setClientError(true);
            setLoading(false);
            return;
          }
          
          targetStoreId = miTiendaReal.id;
        }

        // 1. Petición del cliente usando el ID resuelto de forma segura
        const clientRes = await crmApi.get(`/stores/${targetStoreId}`);
        const clientData = clientRes.data.data || clientRes.data; 
        
        if (clientData) {
          setClient(clientData);
          setNotesText(clientData.notes || '');
        } else {
          setClientError(true);
          setLoading(false);
          return;
        }

        // 2. Petición de tickets cruzados con el ID resuelto
        try {
          const ticketsRes = await crmApi.get('/tickets');
          const ticketsList = Array.isArray(ticketsRes.data) ? ticketsRes.data : (ticketsRes.data.data || []);
          setTickets(ticketsList.filter(t => String(t.store_id) === String(targetStoreId)));
        } catch (ticketError) {
          console.error('Error secundario al cargar tickets:', ticketError);
        }

        // 3. Petición de métricas (Exclusivas de esta tienda)
        try {
          const metricsRes = await crmApi.get('/metrics');
          const metricsList = Array.isArray(metricsRes.data) ? metricsRes.data : (metricsRes.data.data || []);
          
          const filteredMetrics = metricsList
            .filter(m => String(m.store_id) === String(targetStoreId))
            .sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at));
            
          setMetrics(filteredMetrics);
        } catch (metricError) {
          console.error('Error secundario al cargar métricas:', metricError);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error principal en el servidor:', error);
        setClientError(true);
        setLoading(false);
      }
    };
    fetchClientData();
  }, [storeId, navigate, userRole, userEmail]);

  // Resolutor dinámico de logotipos
  const getLogoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const apiBase = crmApi.defaults.baseURL || '';
    const domain = apiBase.replace(/\/api$/, ''); 
    return `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleSaveNotes = async () => {
    try {
      const response = await crmApi.patch(`/stores/${client.id}`, { notes: notesText });
      if (response.data.success || response.status === 200) {
        setClient(prev => ({ ...prev, notes: notesText }));
        setIsEditingNotes(false);
      } else {
        alert('No se pudieron guardar los cambios en las notas.');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión con el servidor al actualizar las notas.');
    }
  };

  const openEditModal = () => {
    setEditFormData({
      name: client.name || '',
      web: client.web || '',
      emails: client.emails || '',
      phone: client.phone || '',
      plan_type: client.plan_type || 'GO',
      tecnologia: client.tecnologia || '', // 🌟 Agregado aquí
      logo_url: client.logo_url || ''
    });
    setShowEditModal(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('logo', file);

    try {
      const response = await crmApi.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setEditFormData(prev => ({ ...prev, logo_url: response.data.url }));
        alert('Nueva imagen procesada exitosamente.');
      }
    } catch (error) {
      console.error("Error al subir el logo:", error);
      const errorReal = error.response?.data?.error || error.response?.statusText || error.message;
      alert('Motivo del rechazo del servidor:\n\n' + errorReal);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editFormData.name.trim()) {
      alert('El nombre de la tienda no puede estar vacío.');
      return;
    }

    try {
      const response = await crmApi.patch(`/stores/${client.id}`, editFormData);
      if (response.data.success || response.status === 200) {
        setClient(prev => ({ ...prev, ...editFormData }));
        setShowEditModal(false);
        alert('Datos del cliente actualizados con éxito.');
      }
    } catch (error) {
      console.error(error);
      alert('Error al guardar los cambios en el servidor.');
    }
  };

  if (loading) return <div className="crm-text-loading">Cargando perfil de cliente...</div>;
  
  if (clientError || !client) {
    return (
      <div className="crm-card-paper" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}>
        <h3>Cliente no encontrado</h3>
        <p className="crm-text-muted">El identificador no corresponde a ninguna tienda registrada en la base de datos.</p>
        {userRole !== 'client' && (
          <button onClick={() => navigate('/admin/clientes')} className="crm-btn-black" style={{ marginTop: '16px' }}>
            Volver al listado
          </button>
        )}
      </div>
    );
  }

  const indexOfLastTicket = ticketCurrentPage * itemsPerPage;
  const indexOfFirstTicket = indexOfLastTicket - itemsPerPage;
  const currentTickets = tickets.slice(indexOfFirstTicket, indexOfLastTicket);
  const totalTicketPages = Math.ceil(tickets.length / itemsPerPage);

  const indexOfLastMetric = metricCurrentPage * itemsPerPage;
  const indexOfFirstMetric = indexOfLastMetric - itemsPerPage;
  const currentMetrics = metrics.slice(indexOfFirstMetric, indexOfLastMetric);
  const totalMetricPages = Math.ceil(metrics.length / itemsPerPage);

  const chartMetrics = metrics.slice(-8); 
  const viewW = 650;
  const viewH = 220;
  const padL = 50; 
  const padR = 40; 
  const padT = 30; 
  const padB = 40; 
  
  const graphW = viewW - padL - padR;
  const graphH = viewH - padT - padB;

  const maxLoad = Math.max(...chartMetrics.map(m => Number(m.load_s) || 0), 1);
  const maxDom = Math.max(...chartMetrics.map(m => Number(m.dom_s) || 0), 1);
  const maxRam = Math.max(...chartMetrics.map(m => Number(m.ram_usage) || 0), 1);

  const getX = (index) => padL + (index * graphW) / (chartMetrics.length - 1 || 1);
  const getY = (val, max) => viewH - padB - ((Number(val) || 0) / max) * graphH;

  const loadPoints = chartMetrics.map((m, i) => `${getX(i)},${getY(m.load_s, maxLoad)}`).join(' ');
  const domPoints = chartMetrics.map((m, i) => `${getX(i)},${getY(m.dom_s, maxDom)}`).join(' ');
  const ramPoints = chartMetrics.map((m, i) => `${getX(i)},${getY(m.ram_usage, maxRam)}`).join(' ');

  return (
    <div>
      <div className="crm-actions-bar" style={{ marginBottom: '16px' }}>
        {userRole !== 'client' && (
          <button onClick={() => navigate('/admin/clientes')} className="crm-btn-border">Volver a Clientes</button>
        )}
        
        {(userRole === 'super admin' || userRole === 'admin') && (
          <button onClick={openEditModal} className="crm-btn-black">Editar Datos del Cliente</button>
        )}
      </div>

      <div className="crm-card-paper" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ width: '64px', height: '64px', backgroundColor: '#f2f1ec', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #111111', overflow: 'hidden', flexShrink: 0 }}>
          {client.logo_url ? (
            <img src={getLogoUrl(client.logo_url)} alt={`Logo de ${client.name}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>LOGO</span>
          )}
        </div>
        <div style={{ flexGrow: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'normal' }}>{client.name}</h1>
            <span className="crm-badge">Plan: {client.plan_type}</span>
          </div>
          <p className="crm-text-muted">ID de registro: {client.id}</p>
        </div>
      </div>

      <div className={userRole === 'client' ? "crm-card-paper" : "crm-grid-two-columns"}>
        <div className={userRole === 'client' ? "" : "crm-card-paper"} style={userRole === 'client' ? { border: 'none', padding: 0 } : {}}>
          <h3 className="crm-section-title" style={{ marginTop: 0 }}>Datos de Contacto</h3>
          <p className="crm-text-muted"><strong>Sitio Web:</strong> {client.web ? <a href={client.web} target="_blank" rel="noreferrer" style={{ color: '#111111' }}>{client.web}</a> : 'No registrado'}</p>
          <p className="crm-text-muted"><strong>Tecnología:</strong> {client.tecnologia || 'No registrada'}</p> {/* 🌟 Línea Nueva */}
          <p className="crm-text-muted"><strong>Correos:</strong> {client.emails || 'No registrados'}</p>
          <p className="crm-text-muted"><strong>Teléfono:</strong> {client.phone || 'No registrado'}</p>
          <p className="crm-text-muted"><strong>Contador de Soportes:</strong> {client.ticket_count || 0} creados en total</p>
        </div>

        {userRole !== 'client' && (
          <div className="crm-card-paper">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="crm-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Notas Internas</h3>
              {!isEditingNotes ? (
                <button onClick={() => setIsEditingNotes(true)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Editar</button>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={handleSaveNotes} className="crm-btn-black" style={{ padding: '4px 10px', fontSize: '12px' }}>Guardar</button>
                  <button onClick={() => { setIsEditingNotes(false); setNotesText(client.notes || ''); }} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>Cancelar</button>
                </div>
              )}
            </div>
            
            {isEditingNotes ? (
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                className="crm-input-text"
                style={{ width: '100%', height: '100px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {client.notes || 'Sin anotaciones particulares sobre este cliente.'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="crm-grid-two-columns" style={{ marginTop: '24px' }}>
        <div className="crm-card-paper">
          <h2 className="crm-section-title" style={{ marginTop: 0 }}>Tickets de Soporte Técnico</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '260px' }}>
            {currentTickets.length === 0 ? (
              <p className="crm-text-muted">No cuenta con registros de soporte abiertos actualmente.</p>
            ) : (
              currentTickets.map(ticket => (
                <div 
                  key={ticket.id} 
                  onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                  className="crm-table-row-interactive"
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid #cccccc', backgroundColor: '#fcfbfa', cursor: 'pointer' }}
                >
                  <div>
                    <span style={{ fontSize: '11px', color: '#555555', fontWeight: 'bold' }}>{ticket.serial_number}</span>
                    <h4 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 'normal' }}>{ticket.name}</h4>
                  </div>
                  <div>
                    <span className="crm-badge">{ticket.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalTicketPages > 1 && (
            <div className="crm-pagination-box" style={{ marginTop: '16px' }}>
              <button disabled={ticketCurrentPage === 1} onClick={() => setTicketCurrentPage(prev => prev - 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>
                Anterior
              </button>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{ticketCurrentPage} / {totalTicketPages}</span>
              <button disabled={ticketCurrentPage === totalTicketPages} onClick={() => setTicketCurrentPage(prev => prev + 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>
                Siguiente
              </button>
            </div>
          )}
        </div>

        <div className="crm-card-paper">
          <h2 className="crm-section-title" style={{ marginTop: 0 }}>Registros Históricos de Actividad</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '260px' }}>
            {currentMetrics.length === 0 ? (
              <p className="crm-text-muted">No cuenta con métricas diarias registradas.</p>
            ) : (
              currentMetrics.map(metric => (
                <div key={metric.id} style={{ padding: '10px', border: '1px solid #cccccc', backgroundColor: '#fcfbfa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px dotted #e5e5e5', paddingBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#111111', fontWeight: 'bold' }}>
                      Fecha: {metric.date ? new Date(metric.date).toLocaleDateString() : '04/06/2026'}
                    </span>
                    <span className="crm-badge" style={{ fontSize: '10px' }}>{metric.server_status}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }} className="crm-text-muted">
                    <div>
                      <p style={{ margin: '1px 0' }}><strong>RAM Utilizada:</strong> {metric.ram_usage ? `${metric.ram_usage}MB` : '—'}</p>
                      <p style={{ margin: '1px 0' }}><strong>Flujo Web:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{metric.web_flow || '—'}</span></p>
                    </div>
                    <div>
                      <p style={{ margin: '1px 0' }}><strong>Tiempo Carga:</strong> {metric.load_s !== null && metric.load_s !== undefined ? `${metric.load_s}s` : '—'}</p>
                      <p style={{ margin: '1px 0' }}><strong>Tiempo DOM:</strong> {metric.dom_s !== null && metric.dom_s !== undefined ? `${metric.dom_s}s` : '—'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalMetricPages > 1 && (
            <div className="crm-pagination-box" style={{ marginTop: '16px' }}>
              <button disabled={metricCurrentPage === 1} onClick={() => setMetricCurrentPage(prev => prev - 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>
                Anterior
              </button>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{metricCurrentPage} / {totalMetricPages}</span>
              <button disabled={metricCurrentPage === totalMetricPages} onClick={() => setMetricCurrentPage(prev => prev + 1)} className="crm-btn-border" style={{ padding: '4px 10px', fontSize: '12px' }}>
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="crm-card-paper" style={{ marginTop: '24px' }}>
        <h2 className="crm-section-title" style={{ marginTop: 0 }}>Evolución Temporal de Rendimiento de Servidor</h2>
        {chartMetrics.length < 2 ? (
          <p className="crm-text-muted" style={{ textAlign: 'center', padding: '32px 0' }}>Inserta al menos 2 registros de métricas en la base de datos para trazar las líneas de tendencia.</p>
        ) : (
          <div>
            <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#fcfbfa', border: '1px solid #cccccc', padding: '10px 0' }}>
              <svg viewBox={`0 0 ${viewW} ${viewH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                <line x1={padL} y1={padT} x2={viewW - padR} y2={padT} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3,3" />
                <line x1={padL} y1={padT + graphH / 2} x2={viewW - padR} y2={padT + graphH / 2} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3,3" />
                <line x1={padL} y1={viewH - padB} x2={viewW - padR} y2={viewH - padB} stroke="#111111" strokeWidth="1.5" />
                <line x1={padL} y1={padT} x2={padL} y2={viewH - padB} stroke="#111111" strokeWidth="1.5" />

                <polyline fill="none" stroke="#888888" strokeWidth="2" points={ramPoints} />
                <polyline fill="none" stroke="#111111" strokeWidth="2" strokeDasharray="4,4" points={domPoints} />
                <polyline fill="none" stroke="#111111" strokeWidth="3" points={loadPoints} />

                {chartMetrics.map((m, i) => {
                  const cx = getX(i);
                  const dateStr = m.date ? new Date(m.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : '04/06';
                  return (
                    <g key={m.id}>
                      <circle cx={cx} cy={getY(m.load_s, maxLoad)} r="4" fill="#111111" />
                      <text x={cx} y={viewH - 15} textAnchor="middle" style={{ fontSize: '10px', fontFamily: 'monospace', fill: '#555555' }}>
                        {dateStr}
                      </text>
                      <text x={cx} y={getY(m.load_s, maxLoad) - 8} textAnchor="middle" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#111111' }}>
                        {m.load_s !== null ? `${m.load_s}s` : ''}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '14px', fontSize: '12px', borderTop: '1px dotted #cccccc', paddingTop: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '0px', borderTop: '3px solid #111111', display: 'inline-block' }}></span> 
                <strong>Tiempo Carga (load_s)</strong> <span style={{ color: '#666666' }}>(Pico: {maxLoad}s)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '0px', borderTop: '2px dashed #111111', display: 'inline-block' }}></span> 
                <strong>Tiempo DOM (dom_s)</strong> <span style={{ color: '#666666' }}>(Pico: {maxDom}s)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '24px', height: '0px', borderTop: '2px solid #888888', display: 'inline-block' }}></span> 
                <strong>RAM Utilizada</strong> <span style={{ color: '#666666' }}>(Pico: {maxRam}MB)</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {showEditModal && (
        <div className="crm-modal-mask" onClick={() => setShowEditModal(false)}>
          <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="crm-section-title" style={{ marginTop: 0 }}>Editar Datos del Cliente</h3>
            
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Nombre del Cliente / Tienda</label>
                <input type="text" name="name" value={editFormData.name} onChange={handleEditInputChange} className="crm-input-text" style={{ width: 'auto' }} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Sitio Web</label>
                  <input type="url" name="web" value={editFormData.web} onChange={handleEditInputChange} className="crm-input-text" style={{ width: 'auto' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Teléfono</label>
                  <input type="text" name="phone" value={editFormData.phone} onChange={handleEditInputChange} className="crm-input-text" style={{ width: 'auto' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Correos de contacto</label>
                  <input type="text" name="emails" value={editFormData.emails} onChange={handleEditInputChange} className="crm-input-text" style={{ width: 'auto' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="crm-stat-label">Tipo de Plan</label>
                  <select name="plan_type" value={editFormData.plan_type} onChange={handleEditInputChange} className="crm-select-dropdown">
                    <option value="GO">GO</option>
                    <option value="GROWTH">GROWTH</option>
                    <option value="ESCALE">ESCALE</option>
                    <option value="WARRANTY">WARRANTY</option>
                    <option value="OUT_OF_WARRANTY">OUT OF WARRANTY</option>
                    <option value="LEAD">LEAD</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Actualizar Logotipo</label>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="crm-input-text" style={{ width: 'auto', padding: '5px' }} />
                {editFormData.logo_url && (
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>
                    ✓ Logo cargado ({editFormData.logo_url.split('/').pop()})
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="crm-stat-label">Tecnología E-commerce</label>
                <select name="tecnologia" value={editFormData.tecnologia || ''} onChange={handleEditInputChange} className="crm-select-dropdown">
                  <option value="">Selecciona tecnología</option>
                  <option value="Shopify">Shopify</option>
                  <option value="Woocommerce">WooCommerce</option>
                  <option value="Vtex">VTEX</option>
                  <option value="Magento">Magento</option>
                  <option value="Custom">Custom / Propio</option>
                </select>
              </div>

              <div className="crm-pagination-box" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
                <button type="submit" className="crm-btn-black">Guardar Cambios</button>
                <button type="button" onClick={() => setShowEditModal(false)} className="crm-btn-red">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientDetail;
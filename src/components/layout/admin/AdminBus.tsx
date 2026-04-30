import React, { useState, useEffect } from 'react';
import { 
  StudentsService, 
  BusRoutesService, 
  ClassesService 
} from '@/lib/firestore-service';
import { useToast } from '@/components/ui/Toast';
import { useSchool } from '@/context/SchoolContext';
import { 
  UsersIcon, 
  MapPinIcon, 
  PlusIcon, 
  EditIcon, 
  TrashIcon,
  SearchIcon,
  PhoneIcon,
  AlertTriangleIcon
} from '@/components/ui/Icons';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import type { Student, BusRoute, Class } from '@/types/models';

export default function AdminBus({ subPage = 'students' }: { subPage?: 'students' | 'routes' }) {
  const [activeTab, setActiveTab] = useState<'students' | 'routes'>(subPage as any);
  const { showToast } = useToast();
  const { school } = useSchool();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Route Form
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<BusRoute | null>(null);
  const [routeForm, setRouteForm] = useState({
    routeName: '', fee: '', vehicleNumber: '', driverName: '', driverPhone: '', stops: ''
  });

  useEffect(() => {
    setActiveTab(subPage as any);
  }, [subPage]);

  useEffect(() => {
    async function fetchData() {
      if (!school?.academicYear) return;
      try {
        const [s, r, c] = await Promise.all([
          StudentsService.getAll(school.academicYear),
          BusRoutesService.getAll(),
          ClassesService.getAll(school.academicYear)
        ]);
        setStudents((s as unknown as Student[]).filter(st => (st as any).transportType === 'bus'));
        setRoutes(r as unknown as BusRoute[]);
        setClasses(c as unknown as Class[]);
      } catch (err) {
        console.error(err);
        showToast('Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [school?.academicYear]);

  const handleSaveRoute = async () => {
    if (!routeForm.routeName || !routeForm.fee) {
      showToast('Route name and fee are required');
      return;
    }

    const payload = {
      routeName: routeForm.routeName,
      fee: parseFloat(routeForm.fee) || 0,
      vehicleNumber: routeForm.vehicleNumber,
      driverName: routeForm.driverName,
      driverPhone: routeForm.driverPhone,
      stops: routeForm.stops.split(',').map(s => s.trim()).filter(Boolean)
    };

    try {
      if (editingRoute) {
        await BusRoutesService.update(editingRoute.id, payload);
        showToast('Route updated successfully');
      } else {
        await BusRoutesService.create(payload);
        showToast('Route created successfully');
      }
      setShowRouteModal(false);
      const r = await BusRoutesService.getAll();
      setRoutes(r as unknown as BusRoute[]);
    } catch (err) {
      showToast('Operation failed');
    }
  };

  const deleteRoute = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    try {
      await BusRoutesService.delete(id);
      setRoutes(p => p.filter(r => r.id !== id));
      showToast('Route deleted');
    } catch (err) {
      showToast('Delete failed');
    }
  };

  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all');

  const filteredStudents = students.filter(s => {
    const matchClass = selectedClassId === 'all' || s.classId === selectedClassId;
    const matchRoute = selectedRouteId === 'all' || (s as any).routeId === selectedRouteId;
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchRoute && matchSearch;
  });

  const busStats = {
    total: students.length,
    assigned: students.filter(s => (s as any).routeId).length,
    unassigned: students.filter(s => !(s as any).routeId).length
  };

  if (loading) return <div className="page-container"><p>Loading...</p></div>;

  return (
    <div className="page-container" style={{ background: 'var(--color-surface-variant)', minHeight: '100vh' }}>
      <div className="page-header" style={{ 
        background: 'white', 
        padding: 'var(--space-6)', 
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 'var(--space-6)'
      }}>
        <div>
          <h1 className="text-h1" style={{ fontSize: '1.75rem', color: '#111827' }}>{activeTab === 'students' ? 'Bus Commuters' : 'Transport Routes'}</h1>
          <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 4 }}>
            {activeTab === 'students' ? 'Manage and track school bus students' : 'Configure and manage school transport routes'}
          </p>
        </div>
      </div>

      {activeTab === 'students' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Stats Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)' }}>
            <div className="card" style={{ padding: 'var(--space-5)', borderLeft: '4px solid var(--color-primary)' }}>
              <div className="text-caption" style={{ fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>TOTAL BUS STUDENTS</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827' }}>{busStats.total}</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #10B981' }}>
              <div className="text-caption" style={{ fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>ROUTE ASSIGNED</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827' }}>{busStats.assigned}</div>
            </div>
            <div className="card" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #F59E0B' }}>
              <div className="text-caption" style={{ fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>PENDING ASSIGNMENT</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#111827' }}>{busStats.unassigned}</div>
            </div>
          </div>

          {/* Filters Card */}
          <div className="card" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-h2" style={{ fontSize: '1.1rem', margin: 0 }}>Active Commuters</h2>
              <div style={{ position: 'relative', width: '280px' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
                  <SearchIcon size={16} />
                </span>
                <input 
                  className="input-base" 
                  style={{ 
                    paddingLeft: 36, 
                    height: 40, 
                    fontSize: '0.875rem', 
                    borderRadius: 8,
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB'
                  }} 
                  placeholder="Search name or ID..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: 'var(--space-3)', 
              background: '#F9FAFB', 
              padding: '12px', 
              borderRadius: '10px',
              border: '1px solid #F3F4F6'
            }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="text-caption" style={{ fontWeight: 700, color: '#6B7280', whiteSpace: 'nowrap' }}>CLASS:</span>
                <select 
                  className="input-base"
                  style={{ 
                    background: 'white', 
                    height: 36, 
                    padding: '0 12px', 
                    fontSize: '0.875rem', 
                    borderRadius: 6,
                    border: '1px solid #E5E7EB',
                    cursor: 'pointer'
                  }}
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                >
                  <option value="all">All Academic Classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ width: 1, background: '#E5E7EB' }}></div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="text-caption" style={{ fontWeight: 700, color: '#6B7280', whiteSpace: 'nowrap' }}>ROUTE:</span>
                <select 
                  className="input-base"
                  style={{ 
                    background: 'white', 
                    height: 36, 
                    padding: '0 12px', 
                    fontSize: '0.875rem', 
                    borderRadius: 6,
                    border: '1px solid #E5E7EB',
                    cursor: 'pointer'
                  }}
                  value={selectedRouteId}
                  onChange={e => setSelectedRouteId(e.target.value)}
                >
                  <option value="all">All Transport Routes</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.routeName}</option>)}
                </select>
              </div>
            </div>
          </div>


          {/* Table Card */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="table-container">
              <table className="table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead style={{ background: '#F9FAFB' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: 600, color: '#4B5563', borderBottom: '1px solid #E5E7EB' }}>Student Profile</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: 600, color: '#4B5563', borderBottom: '1px solid #E5E7EB' }}>Class Details</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: 600, color: '#4B5563', borderBottom: '1px solid #E5E7EB' }}>Assigned Route</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontWeight: 600, color: '#4B5563', borderBottom: '1px solid #E5E7EB' }}>Parent Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>No commuter records found.</td></tr>
                  ) : filteredStudents.map(s => (
                    <tr key={s.id} className="table-row-hover" style={{ transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ 
                            width: 40, height: 40, borderRadius: '10px', 
                            background: 'var(--color-primary-light)', 
                            color: 'var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '1rem'
                          }}>
                            {s.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{s.name}</div>
                            <div className="text-caption" style={{ color: '#6B7280' }}>Adm: {s.admissionNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ display: 'inline-flex', padding: '4px 12px', background: '#EEF2FF', color: '#4F46E5', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem' }}>
                          {s.className}
                        </div>
                        <div className="text-caption" style={{ marginTop: 4, color: '#6B7280' }}>Section {s.sectionName}</div>
                      </td>
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6' }}>
                        {(s as any).routeName ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontWeight: 600 }}>
                            <MapPinIcon size={16} />
                            <span>{(s as any).routeName}</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626', fontWeight: 500 }}>
                            <AlertTriangleIcon size={16} />
                            <span>Not Assigned</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6' }}>
                        {s.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4B5563' }}>
                            <PhoneIcon size={16} style={{ color: '#9CA3AF' }} />
                            <span>{s.phone}</span>
                          </div>
                        ) : <span style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>


      ) : (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
            <div>
              <h2 className="text-h2" style={{ fontSize: '1.25rem' }}>Active Routes</h2>
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)' }}>Total configured routes: {routes.length}</p>
            </div>
            <Button variant="primary" icon={<PlusIcon size={18} />} onClick={() => {
              setEditingRoute(null);
              setRouteForm({ routeName: '', fee: '', vehicleNumber: '', driverName: '', driverPhone: '', stops: '' });
              setShowRouteModal(true);
            }}>
              Add New Route
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-5)' }}>
            {routes.map(r => (
              <div key={r.id} style={{ 
                background: 'white',
                border: '1.5px solid #E5E7EB',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}>
                {/* Card top accent + header */}
                <div style={{ borderTop: '4px solid var(--color-primary)' }} />
                <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#111827' }}>{r.routeName}</h3>
                    <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPinIcon size={12} /> {r.stops?.length || 0} Scheduled Stops
                    </div>
                  </div>
                  <div style={{ 
                    background: '#EEF2FF', 
                    color: 'var(--color-primary)', 
                    padding: '6px 14px', 
                    borderRadius: 8, 
                    fontWeight: 700, 
                    fontSize: '1rem' 
                  }}>
                    ₹{r.fee.toLocaleString()}
                  </div>
                </div>

                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>DRIVER</span>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>{r.driverName || 'Not Assigned'}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: 2 }}>{r.driverPhone || 'No Phone'}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>VEHICLE</span>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>{r.vehicleNumber || 'No Plate'}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: 2 }}>Active Service</div>
                    </div>
                  </div>

                  <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '12px 14px', marginBottom: 'var(--space-4)' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>ROUTE STOPS</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(r.stops || []).length > 0 ? r.stops?.map((stop, idx) => (
                        <span key={idx} style={{ 
                          padding: '3px 10px', 
                          borderRadius: 6, 
                          background: 'white',
                          border: '1px solid #E5E7EB',
                          color: '#374151',
                          fontSize: '0.75rem', 
                          fontWeight: 500 
                        }}>{stop}</span>
                      )) : <span style={{ fontSize: '0.8rem', color: '#9CA3AF', fontStyle: 'italic' }}>No stops defined yet.</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button 
                      onClick={() => {
                        setEditingRoute(r);
                        setRouteForm({
                          routeName: r.routeName,
                          fee: String(r.fee),
                          vehicleNumber: r.vehicleNumber || '',
                          driverName: r.driverName || '',
                          driverPhone: r.driverPhone || '',
                          stops: (r.stops || []).join(', ')
                        });
                        setShowRouteModal(true);
                      }}
                      style={{ 
                        flex: 1, 
                        padding: '10px', 
                        borderRadius: 8, 
                        border: '1px solid #E5E7EB', 
                        background: 'white',
                        color: '#374151',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                      }}
                    >
                      <EditIcon size={16} /> Edit Details
                    </button>
                    <button 
                      onClick={() => deleteRoute(r.id)}
                      style={{ 
                        padding: '10px', 
                        borderRadius: 8, 
                        border: '1px solid #FEE2E2', 
                        background: '#FEF2F2',
                        color: '#DC2626',
                        cursor: 'pointer'
                      }}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route Modal */}
      {showRouteModal && (
        <div className="modal-overlay" style={{ 
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)', 
          backdropFilter: 'blur(4px)', 
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{ 
            width: '100%',
            maxWidth: 580, 
            background: 'white', 
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
              <h2 className="text-h2" style={{ margin: 0 }}>{editingRoute ? 'Edit Bus Route' : 'Add New Bus Route'}</h2>
              <p className="text-body-sm" style={{ color: 'var(--color-text-tertiary)', marginTop: 4 }}>Configure the route details and monthly fee</p>
            </div>

            <div style={{ padding: 'var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
                <Input 
                  label="Route Name *" 
                  value={routeForm.routeName} 
                  onChange={e => setRouteForm(p => ({...p, routeName: e.target.value}))} 
                  placeholder="e.g. Route 1 - Anna Nagar" 
                />
                <Input 
                  label="Monthly Fee (₹) *" 
                  type="number" 
                  value={routeForm.fee} 
                  onChange={e => setRouteForm(p => ({...p, fee: e.target.value}))} 
                  placeholder="1500" 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input 
                  label="Vehicle Number" 
                  value={routeForm.vehicleNumber} 
                  onChange={e => setRouteForm(p => ({...p, vehicleNumber: e.target.value}))} 
                  placeholder="TN-XX-XXXX" 
                />
                <Input 
                  label="Driver Name" 
                  value={routeForm.driverName} 
                  onChange={e => setRouteForm(p => ({...p, driverName: e.target.value}))} 
                  placeholder="John Doe" 
                />
              </div>

              <Input 
                label="Driver Phone" 
                value={routeForm.driverPhone} 
                onChange={e => setRouteForm(p => ({...p, driverPhone: e.target.value}))} 
                placeholder="9876543210" 
                icon={<PhoneIcon size={16} />}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="text-caption" style={{ fontWeight: 600 }}>STOPS (Comma separated)</label>
                <textarea 
                  className="input-base" 
                  rows={3} 
                  value={routeForm.stops} 
                  onChange={e => setRouteForm(p => ({...p, stops: e.target.value}))} 
                  placeholder="Stop 1, Stop 2, Stop 3..."
                />
              </div>
            </div>

            <div style={{ padding: 'var(--space-6)', background: '#F9FAFB', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="secondary" onClick={() => setShowRouteModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveRoute}>Save Route</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

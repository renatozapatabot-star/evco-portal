'use client';

import { Truck, Check } from 'lucide-react';
import { StatCard, StatusBanner, EmptyState } from './ui-primitives';

interface ClientDashboardProps {
  clientName: string;
  /** Decoded company name — never pass URL-encoded strings */
  companyName?: string;
  stats: {
    activos: number;
    completados: number;
    valorImportado: number;
  };
  /** Whether the client has pending actions */
  hasPendientes: boolean;
  /** Recent activity items */
  activity: Array<{
    id: string;
    description: string;
    timestamp: string;
    color: 'green' | 'blue' | 'amber' | 'red';
  }>;
  /** Active shipments (null/empty = show empty state) */
  embarques: Array<{
    id: string;
    trafico: string;
    estado: string;
    fecha: string;
    descripcion: string;
  }> | null;
}

function formatCurrency(value: number): string {
  if (value === 0) return '$0';
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${value.toLocaleString('en-US')}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function ClientDashboard({
  clientName,
  companyName = 'Renato Zapata & Company',
  stats,
  hasPendientes,
  activity,
  embarques,
}: ClientDashboardProps) {
  // Always decode in case upstream sends encoded strings
  const safeName = decodeURIComponent(clientName);
  const safeCompany = decodeURIComponent(companyName);

  return (
    <div className="aduana-content" style={{ maxWidth: 900 }}>
      {/* Greeting */}
      <h1 className="page-title" style={{ fontSize: 24 }}>
        {getGreeting()}, {safeName}
      </h1>
      <p className="page-subtitle" style={{ marginBottom: 28 }}>
        Resumen de su operación aduanera con {safeCompany}
      </p>

      {/* Status banner */}
      {!hasPendientes ? (
        <div style={{ marginBottom: 28 }}>
          <StatusBanner
            level="ok"
            title="No hay pendientes de su parte"
            subtitle="Todos los documentos están al día"
            icon={<Check size={18} />}
          />
        </div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          <StatusBanner
            level="warning"
            title="Tiene documentos pendientes"
            subtitle="Revise la sección de expedientes para subir los documentos requeridos"
          />
        </div>
      )}

      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 28,
        }}
      >
        <StatCard
          label="Embarques activos"
          value={stats.activos}
          note="En tránsito o en proceso"
        />
        <StatCard
          label="Completados"
          value={stats.completados}
          note="Cruzados este mes"
        />
        <StatCard
          label="Valor importado"
          value={formatCurrency(stats.valorImportado)}
          note="USD acumulado"
        />
      </div>

      {/* Active shipments */}
      <div className="section-title">Embarques activos</div>
      {!embarques || embarques.length === 0 ? (
        <div style={{ marginBottom: 28 }}>
          <EmptyState
            icon={<Truck size={20} />}
            text="No hay embarques activos en este momento"
            hint="Cuando inicie una operación, aparecerá aquí con seguimiento en tiempo real"
          />
        </div>
      ) : (
        <div className="aguila-table-wrap" style={{ marginBottom: 28 }}>
          <table className="aguila-table">
            <thead>
              <tr>
                <th>Embarque</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {embarques.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="trafico-id">{e.trafico}</span>
                  </td>
                  <td>{e.estado}</td>
                  <td>{e.fecha}</td>
                  <td>
                    <span className="desc-text">{e.descripcion}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Activity feed */}
      <div className="section-title">Actividad reciente</div>
      {activity.length === 0 ? (
        <EmptyState
          text="Sin actividad reciente"
          hint="La actividad de sus embarques aparecerá aquí"
        />
      ) : (
        <div className="card-flush">
          {activity.map((item) => (
            <div key={item.id} className="activity-row">
              <span className={`activity-dot ${item.color}`} />
              <span className="activity-desc">{item.description}</span>
              <span className="activity-time">{item.timestamp}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="powered-footer">
        Operado por {safeCompany} · Patente 3596 · Aduana 240 Nuevo Laredo
      </div>
    </div>
  );
}

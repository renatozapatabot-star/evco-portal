'use client';

import { useState } from 'react';
import { Download, Search } from 'lucide-react';
import {
  StatusBadge,
  DocsProgress,
  PedimentoDisplay,
  StatCard,
} from './ui-primitives';
import type { TraficoStatus } from './design-tokens';

// ── Types ──

interface Trafico {
  id: string;
  trafico: string;
  pedimento: string | null;
  estado: TraficoStatus;
  fecha: string;
  descripcion: string;
  peso: number | null;
  importe: number | null;
  docsTotal: number;
  docsFilled: number;
  docsPending: number;
}

interface TraficosPageProps {
  traficos: Trafico[];
  stats: {
    activos: number;
    enProceso: number;
    docsFaltantes: number;
    cruzadosHoy: number;
  };
  totalCount: number;
  totalValor: number;
  onExportCSV?: () => void;
  onSearch?: (query: string) => void;
}

// ── Helpers ──

function formatMoney(value: number | null): string {
  if (value === null || value === 0) return '—';
  return `$${value.toLocaleString('en-US')}`;
}

function formatWeight(value: number | null): string {
  if (value === null || value === 0) return '—';
  return value.toLocaleString('en-US');
}

// ── Component ──

export default function TraficosPage({
  traficos,
  stats,
  totalCount,
  totalValor,
  onExportCSV,
  onSearch,
}: TraficosPageProps) {
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? traficos.filter(
        (t) =>
          t.trafico.toLowerCase().includes(filter.toLowerCase()) ||
          t.pedimento?.includes(filter) ||
          t.descripcion.toLowerCase().includes(filter.toLowerCase())
      )
    : traficos;

  return (
    <div className="aduana-content">
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 className="page-title">Tráficos</h1>
          <p className="page-subtitle">
            {totalCount.toLocaleString()} embarques · Renato Zapata & Company
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={onExportCSV}>
            <Download size={14} />
            CSV
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <StatCard label="Activos" value={stats.activos} />
        <StatCard label="En proceso" value={stats.enProceso} />
        <StatCard
          label="Docs faltantes"
          value={stats.docsFaltantes}
          variant={stats.docsFaltantes > 0 ? 'alert' : 'default'}
        />
        <StatCard
          label="Cruzados hoy"
          value={stats.cruzadosHoy}
          variant={stats.cruzadosHoy > 0 ? 'success' : 'default'}
        />
      </div>

      {/* Table */}
      <div className="aguila-table-wrap">
        <div className="aguila-table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>
              <strong style={{ color: 'var(--navy-800)', fontWeight: 600 }}>
                {filtered.length.toLocaleString()}
              </strong>{' '}
              {filter ? 'resultados' : 'total'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--slate-500)' }}>
              <strong style={{ color: 'var(--navy-800)', fontWeight: 600 }}>
                ${(totalValor / 1_000_000).toFixed(1)}M USD
              </strong>{' '}
              valor importado
            </span>
          </div>
          <div
            className="topbar-search"
            style={{ width: 200, padding: '6px 10px' }}
          >
            <Search size={13} className="topbar-search-icon" />
            <input
              placeholder="Filtrar..."
              style={{ fontSize: 12 }}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                onSearch?.(e.target.value);
              }}
            />
          </div>
        </div>

        <table className="aguila-table">
          <thead>
            <tr>
              <th>Tráfico</th>
              <th>Pedimento</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Descripción</th>
              <th style={{ textAlign: 'right' }}>Importe</th>
              <th>Docs</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td>
                  <span className="trafico-id">{t.trafico}</span>
                </td>
                <td>
                  <PedimentoDisplay numero={t.pedimento} />
                </td>
                <td>
                  <StatusBadge status={t.estado} />
                </td>
                <td>{t.fecha}</td>
                <td>
                  <span className="desc-text">{t.descripcion}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="importe">{formatMoney(t.importe)}</span>
                </td>
                <td>
                  <DocsProgress
                    total={t.docsTotal}
                    filled={t.docsFilled}
                    pending={t.docsPending}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

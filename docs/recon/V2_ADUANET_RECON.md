# V2 ADUANET RECON — SAT / VUCEM / ANEXO 22 Document Ecosystem

_Block 4 companion recon. Cross-reference: `docs/recon/V2_GLOBALPC_RECON.md`._

Purpose: document the regulatory side of the supplier-solicitation loop.
GlobalPC's historical demand (`V2_GLOBALPC_RECON.md`) captures what brokers
have actually asked for; this doc captures what SAT, VUCEM, and the regulatory
overlays require — the 50-code catalog in `src/lib/document-types.ts` is the
union of the two, annotated with `reconSource` per entry.

---

## 1. Overview — The ADUANET / VUCEM Document Ecosystem

**VUCEM** (Ventanilla Única de Comercio Exterior Mexicano) is the SAT-run
portal where pedimentos, COVE, DODA, and electronic overlays (certificados
digitales, permisos) are filed. ADUANET is the legacy-plus-current transactional
layer that the SAT/ANAM uses to track every operation against Patente 3596.

Document obligations fall in three buckets:
- **SAT/ANAM transactional** — pedimento, COVE, DODA, MV (Manifestación de Valor)
- **Commercial evidence** — factura, BL/AWB/carta porte, packing list
- **Regulatory overlays** — NOM, COFEPRIS, SAGARPA/SENASICA, SEMARNAT, SENER

Every pedimento's Anexo 22 declaration enumerates which docs back which
campos — the agent aduanal is legally responsible for keeping the full
expediente traceable.

---

## 2. Pedimento Anatomy — Documentos Requeridos por Régimen

### A1 — Importación Definitiva

| Doc | Campo del pedimento | Obligatorio |
|---|---|---|
| Factura comercial | 1 (valor factura), 6 (moneda), 7 (tipo de cambio) | Sí |
| Lista de empaque | — (evidencia) | Sí (cuando aplica) |
| BL/AWB/Carta porte | 18 (medio de transporte), 19 (modalidad) | Sí |
| COVE | Asociado al pedimento vía e.firma | Sí |
| MV (Anexo 1-B) | Valor aduana desglosado | Sí |
| Certificado de origen T-MEC | Campo específico de preferencia | Sí si aplica preferencia |
| Encargo conferido | Archivado con el agente | Sí |
| Constancia RFC (52/78/79) | Validación del padrón | Sí |
| DODA/Previo | Escaneo del despacho | Sí |

### C1 — Exportación Definitiva

Similar a A1 pero sin COVE de importación; sí CFDI de exportación + carta porte
+ certificado de origen cuando el importador final lo requiere.

### IN / BA / BB — Importación Temporal IMMEX

A1 base + Anexo 24 (control de inventario IMMEX) + Anexo 31 (SCCCyG).

### EX / H1 — Exportación Temporal

Documentación simplificada, sin MVE, pero con manifiesto de retorno.

---

## 3. Annex 22 — Obligaciones Documentales a Nivel de Fracción

Cada partida del pedimento declara (campo por campo en el Anexo 22 del RCGCE):

- `frac_arancelaria` (XXXX.XX.XX) — con dots preservados, siempre
- `num_identificacion_comercial` (NICO) — 2 dígitos cuando aplica
- `unidad_medida_tarifa` y `unidad_medida_comercial`
- `pais_origen`, `pais_vendedor`
- `valor_aduana`, `valor_comercial`, `precio_unitario`
- `tasa_tigie`, `tasa_iva`, `tasa_dta`

Documentación soporte a nivel de fracción: dictámenes de clasificación,
fichas técnicas, fotografías, catálogos — el catálogo los captura como
TECNICO.

---

## 4. COVE / DODA / Encargo Conferido Workflow

1. **Encargo conferido** se carga al portal SAT del importador una vez —
   permanece vigente hasta revocación. El proveedor no lo firma; el
   importador sí.
2. **COVE** se transmite al SAT por cada operación antes del pedimento.
   Amarra el valor comercial al pedimento vía acuse electrónico.
3. **DODA** (Documento de Operación para Despacho Aduanero) sustituye al
   previo tradicional — código QR + PDF que la aduana escanea.

Fallo común: COVE sin CFDI de pago al proveedor = observación del SAT
en revisión posterior. El catálogo incluye CFDI de pago como FINANCIERO
precisamente por esto.

---

## 5. Supplier-Facing Document Requirements by Commodity Class

| Clase | Docs típicos sumados a COMERCIAL + TRANSPORTE |
|---|---|
| Químicos / farmacéuticos | COA, MSDS, COFEPRIS |
| Alimentos | COA, SAGARPA/SENASICA |
| Productos terminados mecánicos | Fotos, catálogo, ficha técnica |
| Autopartes IMMEX | Anexo 24, BOM, dictamen |
| Hidrocarburos | SENER, análisis, CFDI de pago |
| Residuos / químicos peligrosos | SEMARNAT, MSDS |

---

## 6. Regulatory Overlays

- **NOM** — Norma Oficial Mexicana. Certificación por organismo acreditado.
- **COFEPRIS** — Sanitario. Alimentos, bebidas, cosméticos, farmacéuticos.
- **SAGARPA / SENASICA** — Zoosanitario y fitosanitario.
- **SEMARNAT** — Medio ambiente, residuos peligrosos, especies protegidas.
- **SENER** — Hidrocarburos y petrolíferos.

Todos se marcaron como `reconSource: 'regulatory'` en el catálogo — no
surgen del recon de GlobalPC ni de ADUANET sino de completitud regulatoria.

---

## 7. Fiscal Documentation (CFDI, RFC Constancias)

- **Constancia de situación fiscal** — SAT, debe estar vigente al momento
  del pedimento. Expira 30 días si el RFC tuvo cambios.
- **CFDI de pago** — complemento que acredita pago al proveedor.
- **Constancia de retenciones ISR/IVA** — cuando el proveedor mexicano
  cobra al extranjero.
- **Opinión de cumplimiento** (32-D) — positiva requerida para trámites SAT.

---

## 8. Open Questions / Future Reconnaissance

- **Certificados digitales para NOM** — ¿cuáles organismos acreditados
  responden con formato estándar? (mismatch entre laboratorios propietarios).
- **Anexo 24 / 31 automation** — hoy los emite el IMMEX manualmente;
  hay un camino futuro para que CRUZ los genere desde traficos + pedimentos.
- **COVE amarrado a CFDI de pago** — ¿se puede automatizar el match?
  (hay una señal de auditoría que SAT empezó a cruzar en 2025).
- **Evidencia de entrega (POD)** — no es obligatorio ante SAT pero Tito
  lo pide como cierre del expediente. Capturado en OTROS.
- **DODA digital vs físico** — la aduana 240 ya acepta digital, pero
  algunos recintos secundarios siguen exigiendo impresión.

---

_Última revisión: 2026-04-15 · Block 4 · recon complementario al GlobalPC._

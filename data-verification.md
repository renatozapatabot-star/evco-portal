# CRUZ Data Verification Report
## Date: 2026-04-05
## Range: 2024-01-01 → 2026-04-05

---

### EVCO Plastics de México (company_id: evco, clave_cliente: 9254)

#### 1. Tráficos
| Metric | Value | Portal Page |
|--------|-------|-------------|
| Total count | 892 | /traficos |
| Date range | 2024-01-02 → 2026-03-31 | /traficos |
| With pedimento | 888 (99.6%) | /pedimentos |
| Valor total (importe_total) | $35,809,598.01 USD | /reportes |
| T-MEC operations | 714 (80.0%) | /reportes |

**Status distribution:**
| Status | Count | % |
|--------|-------|---|
| Cruzado | 562 | 63.0% |
| En Proceso | 197 | 22.1% |
| Pedimento Pagado | 133 | 14.9% |

#### 2. Entradas
| Metric | Value | % | Portal Page |
|--------|-------|---|-------------|
| Total count | 1,000 | — | /entradas |
| Linked to tráfico | 514 | 51.4% | /entradas |
| Bultos populated | 1,000 | 100.0% | /entradas |
| Peso populated | 1,000 | 100.0% | /entradas |

#### 3. Aduanet Facturas
| Metric | Value | % | Portal Page |
|--------|-------|---|-------------|
| Raw count | 89 | — | — |
| After dedup (by referencia) | 89 | — | /reportes |
| Duplicates removed | 0 | — | — |
| Total valor_usd | $4,380,804.84 USD | — | /reportes |
| valor_usd populated | 89 | 100.0% | /pedimentos |
| DTA populated | 56 | 62.9% | /pedimentos |
| IGI populated | 27 | 30.3% | /pedimentos |
| IVA populated | 87 | 97.8% | /pedimentos |
| Linked to pedimento | 89 | 100.0% | /pedimentos |

#### 4. GlobalPC Facturas
| Metric | Value | Portal Page |
|--------|-------|-------------|
| Total count (cve_cliente=9254) | 1,000 | — |

#### 5. Expediente Documentos
| Metric | Value | Portal Page |
|--------|-------|-------------|
| Total documents | 15,726 | /documentos |
| Unique tráficos with docs | 885 | /documentos |
| Coverage (tráficos with ≥1 doc) | 99.2% (885 de 892) | /documentos |

**Document type distribution:**
| Type | Count | % |
|------|-------|---|
| cove | 1,006 | 6.4% |
| acuse_cove | 587 | 3.7% |
| archivos_validacion | 439 | 2.8% |
| factura_comercial | 326 | 2.1% |
| otro | 279 | 1.8% |
| doda | 252 | 1.6% |
| pedimento_detallado | 232 | 1.5% |
| packing_list | 230 | 1.5% |
| cuenta_gastos | 123 | 0.8% |
| mve | 55 | 0.3% |
| pedimento_simplificado | 16 | 0.1% |
| bol | 9 | 0.1% |

#### 6. Supplier Name Resolution
| Metric | Value | % |
|--------|-------|---|
| Lookup table size | 938 | — |
| Total supplier codes in tráficos | 2,932 | — |
| Resolved (name or non-PRV_) | 2,792 | 95.2% |
| Unresolved PRV_ codes | 140 | 4.8% |

**Unresolved sample:** `PRV_2236`, `PRV_2621`, `PRV_2706`, `PRV_2717`, `PRV_128`, `PRV_2327`, `PRV_768`, `PRV_2108`, `PRV_730`, `PRV_1255`

#### 7. Cross-Linking Summary
| Relationship | Linked | Total | % |
|-------------|--------|-------|---|
| Entradas → Tráfico | 514 | 1,000 | 51.4% |
| Tráficos → Pedimento | 888 | 892 | 99.6% |
| Facturas → Pedimento | 89 | 89 | 100.0% |

---

### MAFESA (company_id: mafesa, clave_cliente: 4598)

#### 1. Tráficos
| Metric | Value | Portal Page |
|--------|-------|-------------|
| Total count | 59 | /traficos |
| Date range | 2024-02-01 → 2026-03-03 | /traficos |
| With pedimento | 59 (100.0%) | /pedimentos |
| Valor total (importe_total) | $2,817,672.72 USD | /reportes |
| T-MEC operations | 59 (100.0%) | /reportes |

**Status distribution:**
| Status | Count | % |
|--------|-------|---|
| Cruzado | 59 | 100.0% |

#### 2. Entradas
| Metric | Value | % | Portal Page |
|--------|-------|---|-------------|
| Total count | 1,000 | — | /entradas |
| Linked to tráfico | 824 | 82.4% | /entradas |
| Bultos populated | 1,000 | 100.0% | /entradas |
| Peso populated | 1,000 | 100.0% | /entradas |

#### 3. Aduanet Facturas
| Metric | Value | % | Portal Page |
|--------|-------|---|-------------|
| Raw count | 56 | — | — |
| After dedup (by referencia) | 56 | — | /reportes |
| Duplicates removed | 0 | — | — |
| Total valor_usd | $5,856,358.91 USD | — | /reportes |
| valor_usd populated | 56 | 100.0% | /pedimentos |
| DTA populated | 24 | 42.9% | /pedimentos |
| IGI populated | 2 | 3.6% | /pedimentos |
| IVA populated | 14 | 25.0% | /pedimentos |
| Linked to pedimento | 56 | 100.0% | /pedimentos |

#### 4. GlobalPC Facturas
| Metric | Value | Portal Page |
|--------|-------|-------------|
| Total count (cve_cliente=4598) | 1,000 | — |

#### 5. Expediente Documentos
| Metric | Value | Portal Page |
|--------|-------|-------------|
| Total documents | 193 | /documentos |
| Unique tráficos with docs | 58 | /documentos |
| Coverage (tráficos with ≥1 doc) | 98.3% (58 de 59) | /documentos |

**Document type distribution:**
| Type | Count | % |
|------|-------|---|
| otro | 53 | 27.5% |
| doda | 40 | 20.7% |
| factura_comercial | 37 | 19.2% |
| pedimento_detallado | 27 | 14.0% |
| archivos_validacion | 17 | 8.8% |
| packing_list | 8 | 4.1% |
| pedimento_simplificado | 6 | 3.1% |
| cove | 3 | 1.6% |
| cuenta_gastos | 2 | 1.0% |

#### 6. Supplier Name Resolution
| Metric | Value | % |
|--------|-------|---|
| Lookup table size | 938 | — |
| Total supplier codes in tráficos | 66 | — |
| Resolved (name or non-PRV_) | 66 | 100.0% |
| Unresolved PRV_ codes | 0 | 0.0% |

#### 7. Cross-Linking Summary
| Relationship | Linked | Total | % |
|-------------|--------|-------|---|
| Entradas → Tráfico | 824 | 1,000 | 82.4% |
| Tráficos → Pedimento | 59 | 59 | 100.0% |
| Facturas → Pedimento | 56 | 56 | 100.0% |

---

### Cross-Client Isolation Verification

| Check | Result |
|-------|--------|
| EVCO traficos exist | ✅ Yes |
| MAFESA traficos exist | ✅ Yes |
| EVCO facturas exist (clave 9254) | ✅ Yes |
| MAFESA facturas exist (clave 4598) | ✅ Yes |
| Traficos with unknown company_id | ❌ Found 10 rows |

**Unknown company_id rows:**
- trafico=5913-Y1558, company_id=castores
- trafico=5913-Y1560, company_id=castores
- trafico=5913-Y1695, company_id=castores
- trafico=5913-Y1696, company_id=castores
- trafico=5913-Y1697, company_id=castores
- trafico=5913-Y1731, company_id=castores
- trafico=5913-Y1732, company_id=castores
- trafico=5913-Y1726, company_id=castores
- trafico=5913-Y1534, company_id=castores
- trafico=5913-Y1535, company_id=castores

---
*Generated by scripts/data-verification.js on 2026-04-05T02:49:29.732Z*
# CRUZ Data Verification Report
## Date: 2026-04-05
## Range: 2024-01-01 → 2026-04-05

---

### EVCO Plastics de México (company_id: evco, clave_cliente: 9254)

#### 1. Tráficos
| Metric | Value | Portal Page |
|--------|-------|-------------|
| Total count | 894 | /traficos |
| Date range | 2024-01-02 → 2026-03-31 | /traficos |
| With pedimento | 887 (99.2%) | /pedimentos |
| Valor total (importe_total) | $35,832,321.91 USD | /reportes |
| T-MEC operations | 713 (79.8%) | /reportes |

**Status distribution:**
| Status | Count | % |
|--------|-------|---|
| Cruzado | 562 | 62.9% |
| En Proceso | 201 | 22.5% |
| Pedimento Pagado | 131 | 14.7% |

#### 2. Entradas
| Metric | Value | % | Portal Page |
|--------|-------|---|-------------|
| Total count | 1,000 | — | /entradas |
| Linked to tráfico | 526 | 52.6% | /entradas |
| Bultos populated | 1,000 | 100.0% | /entradas |
| Peso populated | 1,000 | 100.0% | /entradas |

#### 3. Aduanet Facturas
| Metric | Value | % | Portal Page |
|--------|-------|---|-------------|
| Raw count | 374 | — | — |
| After dedup (by referencia) | 89 | — | /reportes |
| Duplicates removed | 285 | — | — |
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
| Total documents | 0 | /documentos |
| Unique tráficos with docs | 0 | /documentos |
| Coverage (tráficos with ≥1 doc) | 0.0% (0 de 894) | /documentos |

**Document type distribution:**
| Type | Count | % |
|------|-------|---|

#### 6. Supplier Name Resolution
| Metric | Value | % |
|--------|-------|---|
| Lookup table size | 957 | — |
| Total supplier codes in tráficos | 2,242 | — |
| Resolved (name or non-PRV_) | 1,092 | 48.7% |
| Unresolved PRV_ codes | 1,150 | 51.3% |

**Unresolved sample:** `PRV_19`, `PRV_2042`, `PRV_1042`, `PRV_1545`, `PRV_1608`, `PRV_1828`, `PRV_1865`, `PRV_1953`, `PRV_2304`, `PRV_587`

#### 7. Cross-Linking Summary
| Relationship | Linked | Total | % |
|-------------|--------|-------|---|
| Entradas → Tráfico | 526 | 1,000 | 52.6% |
| Tráficos → Pedimento | 887 | 894 | 99.2% |
| Facturas → Pedimento | 89 | 89 | 100.0% |

---

### MAFESA (company_id: mafesa, clave_cliente: 4598)

#### 1. Tráficos
| Metric | Value | Portal Page |
|--------|-------|-------------|
| Total count | 10 | /traficos |
| Date range | 2026-03-16 → 2026-03-30 | /traficos |
| With pedimento | 0 (0.0%) | /pedimentos |
| Valor total (importe_total) | $2,606,000.00 USD | /reportes |
| T-MEC operations | 10 (100.0%) | /reportes |

**Status distribution:**
| Status | Count | % |
|--------|-------|---|
| En Proceso | 4 | 40.0% |
| Cruzado | 3 | 30.0% |
| Detenido | 2 | 20.0% |
| Pedimento Pagado | 1 | 10.0% |

#### 2. Entradas
| Metric | Value | % | Portal Page |
|--------|-------|---|-------------|
| Total count | 0 | — | /entradas |
| Linked to tráfico | 0 | 0.0% | /entradas |
| Bultos populated | 0 | 0.0% | /entradas |
| Peso populated | 0 | 0.0% | /entradas |

#### 3. Aduanet Facturas
| Metric | Value | % | Portal Page |
|--------|-------|---|-------------|
| Raw count | 431 | — | — |
| After dedup (by referencia) | 56 | — | /reportes |
| Duplicates removed | 375 | — | — |
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
| Total documents | 0 | /documentos |
| Unique tráficos with docs | 0 | /documentos |
| Coverage (tráficos with ≥1 doc) | 0.0% (0 de 10) | /documentos |

**Document type distribution:**
| Type | Count | % |
|------|-------|---|

#### 6. Supplier Name Resolution
| Metric | Value | % |
|--------|-------|---|
| Lookup table size | 957 | — |
| Total supplier codes in tráficos | 0 | — |
| Resolved (name or non-PRV_) | 0 | 0.0% |
| Unresolved PRV_ codes | 0 | 0.0% |

#### 7. Cross-Linking Summary
| Relationship | Linked | Total | % |
|-------------|--------|-------|---|
| Entradas → Tráfico | 0 | 0 | 0.0% |
| Tráficos → Pedimento | 0 | 10 | 0.0% |
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
*Generated by scripts/data-verification.js on 2026-04-05T00:58:31.319Z*
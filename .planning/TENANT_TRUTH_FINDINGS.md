# Tenant-Truth Findings · 2026-04-17

**Active companies:** 51 / 307
**Generated:** 2026-04-17T21:54:47.964Z

## Per-table overview

| Table | Total rows | Sample distinct company_ids | Orphan ids |
|---|---:|---:|---|
| traficos | 32,376 | 21 | — |
| entradas | 64,785 | 4 | — |
| expediente_documentos | 307,974 | 5 | 0405, 0535, 0543, 0626, 0627 |
| globalpc_productos | 748,922 | 1 | — |
| globalpc_partidas | 290,597 | 1 | — |
| globalpc_facturas | 64,447 | 4 | — |
| globalpc_eventos | 196,611 | 36 | 8979, 3423, 7073 |
| globalpc_proveedores | 1,972 | 48 | — |
| anexo24_partidas | 1,793 | 1 | — |

## Per-company contamination

| company_id | name | truth | claimed | contamination | % | verdict |
|---|---|---:|---:|---:|---:|---|
| aceros-termicos | INTERNACIONAL DE ACEROS TERMICOS S.A. DE C.V. | 238 | 243 | 6 | 2.5% | 🟢 CLEAN |
| alimentos-san-fabian | ALIMENTOS Y PRODUCTOS CINEGETICOS SAN FABIAN | 15 | 24 | 9 | 37.5% | 🟡 DRIFT |
| becomar | BECOMAR DE MEXICO S. DE R.L. DE C.V. | 142 | 148 | 6 | 4.1% | 🟢 CLEAN |
| bekaert | BEKAERT TRADE MEXICO S.DE R.L.DE C.V. | 161 | 246 | 85 | 34.6% | 🟡 DRIFT |
| beumer | BEUMER DE MEXICO S. DE R.L. DE C.V. | 101 | 106 | 5 | 4.7% | 🟢 CLEAN |
| cable-proveedora | CABLE PROVEEDORA S.A. | 451 | 646 | 195 | 30.2% | 🟡 DRIFT |
| calfer | CALFER DE MEXICO S.A. DE C.V. | 2721 | 4030 | 1310 | 32.5% | 🟡 DRIFT |
| camisas-manchester | FABRICA DE CAMISAS MANCHESTER S.A. DE C.V. | 9 | 168 | 159 | 94.6% | 🔴 SEVERE |
| castores | COOPERATIVA DE CONSUMIDORES REFACCIONARIA CASTORES SC | 33 | 36 | 3 | 8.3% | 🟢 CLEAN |
| cinetica | CINETICA QUIMICA S.A. DE C.V. | 38 | 92 | 54 | 58.7% | 🟠 CONTAMINATED |
| cmae | COMPANIA MANUFACTURERA DE ARTEFACTOS ELECTRICOS S.A DE | 488 | 1267 | 779 | 61.5% | 🟠 CONTAMINATED |
| demo-plastics | DEMO PLASTICS S.A. DE C.V. | 0 | 0 | 0 | 0.0% | 🟢 CLEAN |
| dist-parra | DISTRIBUIDORA PARRA DE MONTERREY SA DE CV | 783 | 1104 | 321 | 29.1% | 🟡 DRIFT |
| embajada1 | EMBAJADA DE LOS ESTADOS UNIDOS DE NORTEAMERICA | 2204 | 6182 | 3985 | 64.5% | 🟠 CONTAMINATED |
| embajada2 | LA EMBAJADA DE LOS ESTADOS UNIDOS DE NORTEAMERICA | 2949 | 3002 | 53 | 1.8% | 🟢 CLEAN |
| embajada3 | EMBAJADA DE LOS ESTADOS UNIDOS DE NORTEAMERICA | 3416 | 5038 | 1625 | 32.3% | 🟡 DRIFT |
| empaques-litograficos | EMPAQUES Y ACABADOS LITOGRAFICOS S.A. DE C.V. | 33 | 152 | 120 | 78.9% | 🟠 CONTAMINATED |
| equipos-dd | EQUIPOS Y MANTENIMIENTO D & D S.A. DE C.V. | 1100 | 1267 | 172 | 13.6% | 🟡 DRIFT |
| evco | EVCO PLASTICS DE MEXICO,S.DE R.L.DE C.V. | 4575 | 6131 | 1599 | 26.1% | 🟡 DRIFT |
| expoimpo | EXPOIMPO RB S.A. DE C.V. | 972 | 1274 | 302 | 23.7% | 🟡 DRIFT |
| faurecia | FAURECIA SISTEMAS AUTOMOTRICES DE MEXICO S DE RL DE CV | 20 | 23 | 5 | 21.7% | 🟡 DRIFT |
| ferretera-mims | DISTRIBUIDORA FERRETERA MIMS S.A. DE C.V. | 2211 | 3050 | 847 | 27.8% | 🟡 DRIFT |
| g-traders | G-TRADERS GROUP S.A. DE C.V. | 930 | 948 | 18 | 1.9% | 🟢 CLEAN |
| galia-textil | GALIA TEXTIL S.A. DE C.V. | 97 | 156 | 59 | 37.8% | 🟡 DRIFT |
| garlock | GARLOCK DE MEXICO S.A. DE C.V. | 1394 | 2381 | 987 | 41.5% | 🟡 DRIFT |
| gostech | GOSTECH S.A. DE C.V. | 223 | 737 | 514 | 69.7% | 🟠 CONTAMINATED |
| grupo-pelayo | GRUPO PELAYO S.A. DE C.V. | 120 | 478 | 358 | 74.9% | 🟠 CONTAMINATED |
| grupo-requena | GRUPO REQUENA S.A. DE C.V. | 295 | 305 | 13 | 4.3% | 🟢 CLEAN |
| hilos-iris | HILOS IRIS S.A. DE C.V | 109 | 300 | 191 | 63.7% | 🟠 CONTAMINATED |
| instrumentos-medicos | INSTRUMENTOS MEDICOS INTERNACIONALES S.A DE C.V | 158 | 167 | 9 | 5.4% | 🟢 CLEAN |
| lvm-nucleo | LVM NUCLEO S DE RL DE CV | 91 | 94 | 3 | 3.2% | 🟢 CLEAN |
| mafesa | MANUFACTURERA FEDERAL ELECTRICA S.DE RL DE CV | 1250 | 1681 | 432 | 25.7% | 🟡 DRIFT |
| maniphor | MANIPHOR S.A. DE C.V. | 36 | 829 | 793 | 95.7% | 🔴 SEVERE |
| maquinaria-pacifico | MAQUINARIA DEL PACIFICO S.A. DE C.V. | 4522 | 7586 | 3065 | 40.4% | 🟡 DRIFT |
| mercatrup | MERCATRUP.COM S. DE R.L. DE C.V. | 74 | 86 | 12 | 14.0% | 🟡 DRIFT |
| papeles-bolsas | PAPELES Y BOLSAS ECOLOGICAS S.A. DE C.V. | 279 | 349 | 70 | 20.1% | 🟡 DRIFT |
| plasticos-ing | PLASTICOS DE INGENIERIA TECNOQUIM SA DE CV | 92 | 109 | 17 | 15.6% | 🟡 DRIFT |
| plasticos-villagar | PLASTICOS VILLAGAR S.A. DE C.V. | 213 | 291 | 78 | 26.8% | 🟡 DRIFT |
| preciomex | PRECIOMEX S.A. DE C.V. | 187 | 255 | 68 | 26.7% | 🟡 DRIFT |
| promotora-mexicana | PROMOTORA MEXICANA S.A. DE C.V. | 222 | 531 | 309 | 58.2% | 🟠 CONTAMINATED |
| pti-dos | PTI DOS DIVERSIFIED OUTSOURCING SOLUTIONS S. DE R.L DE C.V | 427 | 461 | 34 | 7.4% | 🟢 CLEAN |
| pti-qcs | PTI QCS S. DE R.L DE C.V | 143 | 149 | 6 | 4.0% | 🟢 CLEAN |
| sercom | SERCOM INTERNACIONAL S.A. DE C.V. | 434 | 2017 | 1589 | 78.8% | 🟠 CONTAMINATED |
| stempro | STEMPRO DE MEXICO S. DE R.L. DE C.V. | 1008 | 1174 | 166 | 14.1% | 🟡 DRIFT |
| tork-electro | TORK ELECTRO SISTEMAS SA DE CV | 1149 | 1165 | 26 | 2.2% | 🟢 CLEAN |
| tracusa | TRACUSA LA RUTA DEL SOL SA DE CV | 3 | 3 | 0 | 0.0% | 🟢 CLEAN |
| ts-san-pedro | TS DE SAN PEDRO INDUSTRIES S. DE R.L. DE C.V. | 121 | 121 | 1 | 0.8% | 🟢 CLEAN |
| vollrath | VOLLRATH DE MEXICO S DE R.L. DE C.V. | 4709 | 5490 | 783 | 14.3% | 🟡 DRIFT |
| whitehall | WHITEHALL INDUSTRIES DE MEXICO S DE RL. DE CV. | 293 | 316 | 23 | 7.3% | 🟢 CLEAN |
| worldtech | WORLDTECH S.A. DE C.V. | 75 | 169 | 94 | 55.6% | 🟠 CONTAMINATED |
| yates | YATES CONSTRUCTION MEXICO S DE RL DE CV | 369 | 1178 | 810 | 68.8% | 🟠 CONTAMINATED |

## Per-company detail

### aceros-termicos · INTERNACIONAL DE ACEROS TERMICOS S.A. DE C.V.
**clave_cliente:** `5967`

| table | count |
|---|---:|
| traficos | 242 |
| entradas | 457 |
| expediente_documentos | 0 |
| globalpc_productos | 1,847 |
| globalpc_partidas | 1,230 |
| globalpc_facturas | 536 |
| globalpc_eventos | 2,274 |
| globalpc_proveedores | 8 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 238
- globalpc_partidas distinct cve_producto (via cve_cliente): 238
- **Truth set (union):** 238
- **Claimed in globalpc_productos:** 243
- **Contamination:** 6 (2.5%)
- Sample contamination: `DPSS-400-400-10`, `PENDIENTE`, `PF-125X-250`, `RA1-125-5000-310`, `RA35-.1375-4.750-310`, `RA35.375-2.250-304`
- Sample truth: `092-0005-04`, `092-0005-14`, `102-0101-03`, `102-0101-13`, `102-0219-01`, `102-0401-01`, `3003.020X.500XRDM`, `3003.500X.020XRDM`, `304.062XCOIL`, `304.125X.250XCOIL`

### alimentos-san-fabian · ALIMENTOS Y PRODUCTOS CINEGETICOS SAN FABIAN
**clave_cliente:** `1787`

| table | count |
|---|---:|
| traficos | 145 |
| entradas | 152 |
| expediente_documentos | 0 |
| globalpc_productos | 293 |
| globalpc_partidas | 258 |
| globalpc_facturas | 154 |
| globalpc_eventos | 505 |
| globalpc_proveedores | 6 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 15
- globalpc_partidas distinct cve_producto (via cve_cliente): 15
- **Truth set (union):** 15
- **Claimed in globalpc_productos:** 24
- **Contamination:** 9 (37.5%)
- Sample contamination: `45005`, `8402`, `ALIMENTO PARA VENADO`, `LAVADORA`, `MALLA`, `MONSTER`, `PORTONES`, `T-POSTS`, `TIPMANN`
- Sample truth: `12312`, `BOMBA SUMERGIBLE`, `CONMUTADOR`, `CORRAL COMPLETO`, `DEER BLINDS`, `DEER FEEDERS`, `GRATE`, `MAQ. NIVELADORA`, `PELLET`, `PODADORAS DE CESPED`

### becomar · BECOMAR DE MEXICO S. DE R.L. DE C.V.
**clave_cliente:** `1648`

| table | count |
|---|---:|
| traficos | 147 |
| entradas | 164 |
| expediente_documentos | 0 |
| globalpc_productos | 1,373 |
| globalpc_partidas | 1,085 |
| globalpc_facturas | 176 |
| globalpc_eventos | 1,520 |
| globalpc_proveedores | 12 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 142
- globalpc_partidas distinct cve_producto (via cve_cliente): 142
- **Truth set (union):** 142
- **Claimed in globalpc_productos:** 148
- **Contamination:** 6 (4.1%)
- Sample contamination: `FBD 220`, `FBO 075`, `FBV 110`, `MET`, `MLV-3`, `P25XTP075-CCW`
- Sample truth: `2448NC`, `5A547C`, `5A557C`, `5A567C`, `5A577C`, `ACID/CORROSIVE STORAGE 44 GAL`, `ADHESIVE`, `BLENDED GRAIN COUNTERTOP`, `BLUESKING ROOF HIGH`, `BLUESKING VP160-SA`

### bekaert · BEKAERT TRADE MEXICO S.DE R.L.DE C.V.
**clave_cliente:** `9085`

| table | count |
|---|---:|
| traficos | 431 |
| entradas | 483 |
| expediente_documentos | 0 |
| globalpc_productos | 2,871 |
| globalpc_partidas | 1,017 |
| globalpc_facturas | 700 |
| globalpc_eventos | 3,487 |
| globalpc_proveedores | 20 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 161
- globalpc_partidas distinct cve_producto (via cve_cliente): 161
- **Truth set (union):** 161
- **Claimed in globalpc_productos:** 246
- **Contamination:** 85 (34.6%)
- Sample contamination: `.1378`, `0010`, `1018-3.0`, `1047/6 CL`, `113089`, `118366`, `118373`, `12 1/2 GAUGE X 14`, `121634`, `122024`
- Sample truth: `.055`, `004742`, `119171`, `121460`, `121510`, `121514`, `121575`, `121586`, `121602`, `121627`

### beumer · BEUMER DE MEXICO S. DE R.L. DE C.V.
**clave_cliente:** `1519`

| table | count |
|---|---:|
| traficos | 169 |
| entradas | 174 |
| expediente_documentos | 0 |
| globalpc_productos | 810 |
| globalpc_partidas | 690 |
| globalpc_facturas | 194 |
| globalpc_eventos | 2,032 |
| globalpc_proveedores | 6 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 101
- globalpc_partidas distinct cve_producto (via cve_cliente): 101
- **Truth set (union):** 101
- **Claimed in globalpc_productos:** 106
- **Contamination:** 5 (4.7%)
- Sample contamination: `BANDAS PARA TRANSPORTADOR`, `PARTES PARA TRANSPORTADORES ENSAMBLES`, `POWER CURVE`, `SISTEMA DE TRANSPORTADOR COMBINADO BANDA Y RODILLO`, `TORNILLOS DE ACERO`
- Sample truth: `72458`, `ALTAVOCES`, `ATTACHMENT STRAP`, `BANDA`, `BANDA DE HULE`, `BANDAS`, `BANDAS DE HULE`, `BANDAS PARA TRANSMISION`, `BANDAS TRANSPORTADORAS`, `BANDAS TRANSPORTADORAS.`

### cable-proveedora · CABLE PROVEEDORA S.A.
**clave_cliente:** `2108`

| table | count |
|---|---:|
| traficos | 830 |
| entradas | 885 |
| expediente_documentos | 0 |
| globalpc_productos | 11,409 |
| globalpc_partidas | 5,008 |
| globalpc_facturas | 988 |
| globalpc_eventos | 4,293 |
| globalpc_proveedores | 26 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 451
- globalpc_partidas distinct cve_producto (via cve_cliente): 451
- **Truth set (union):** 451
- **Claimed in globalpc_productos:** 646
- **Contamination:** 195 (30.2%)
- Sample contamination: `0048LA8WM12NS`, `006S60VO1GY521PVE5R1`, `102-SS07-210000000`, `104-SS07-210010000`, `109-S801-10002BKLG`, `1230G4`, `14403`, `14907`, `201SS`, `21500`
- Sample truth: `006E77V008BK0010000R1`, `1122G21033213000`, `1152G21033113000`, `1220`, `12500`, `1329`, `1329-CHAPARRAL`, `16710`, `31910`, `32110`

### calfer · CALFER DE MEXICO S.A. DE C.V.
**clave_cliente:** `1760`

| table | count |
|---|---:|
| traficos | 408 |
| entradas | 4,978 |
| expediente_documentos | 0 |
| globalpc_productos | 56,544 |
| globalpc_partidas | 14,104 |
| globalpc_facturas | 6,095 |
| globalpc_eventos | 2,805 |
| globalpc_proveedores | 43 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 2721
- globalpc_partidas distinct cve_producto (via cve_cliente): 2721
- **Truth set (union):** 2721
- **Claimed in globalpc_productos:** 4030
- **Contamination:** 1310 (32.5%)
- Sample contamination: `.5" CV VLV`, `.75 CV VLV`, `0000`, `0007-1598`, `0007-1600`, `0007-1645`, `001-0021`, `001-0109`, `0010-5033`, `0011-0109`
- Sample truth: `.5CV`, `.75 8700`, `.75CV`, `0001-7684`, `0003-6170`, `0005-5134`, `0007-1644`, `0007-1650`, `0007-1655`, `0007-1700`

### camisas-manchester · FABRICA DE CAMISAS MANCHESTER S.A. DE C.V.
**clave_cliente:** `4180`

| table | count |
|---|---:|
| traficos | 578 |
| entradas | 1,486 |
| expediente_documentos | 0 |
| globalpc_productos | 368 |
| globalpc_partidas | 59 |
| globalpc_facturas | 589 |
| globalpc_eventos | 2,182 |
| globalpc_proveedores | 38 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 9
- globalpc_partidas distinct cve_producto (via cve_cliente): 9
- **Truth set (union):** 9
- **Claimed in globalpc_productos:** 168
- **Contamination:** 159 (94.6%)
- Sample contamination: `0041801`, `0042872`, `0043442`, `0047058`, `0093632`, `0303050302003`, `051.355/6`, `06/32`, `112690`, `115162`
- Sample truth: `257-020-060-0`, `634-022`, `700-094-001-0`, `CAMISA HOMBRE POLIESTER`, `CAMISAS BOYS`, `CAMISAS HOMBRE`, `MUESTRAS`, `MUESTRAS PARA NINOS`, `SC040035`

### castores · COOPERATIVA DE CONSUMIDORES REFACCIONARIA CASTORES SC
**clave_cliente:** `5913`

| table | count |
|---|---:|
| traficos | 1,660 |
| entradas | 1,719 |
| expediente_documentos | 0 |
| globalpc_productos | 1,673 |
| globalpc_partidas | 1,550 |
| globalpc_facturas | 1,622 |
| globalpc_eventos | 16,509 |
| globalpc_proveedores | 4 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 33
- globalpc_partidas distinct cve_producto (via cve_cliente): 33
- **Truth set (union):** 33
- **Claimed in globalpc_productos:** 36
- **Contamination:** 3 (8.3%)
- Sample contamination: `FALDON`, `P-1077WHSHWS`, `SEMIREMOLQUE TIPO CAJA NUEVA`
- Sample truth: `01-6500-0-164`, `01-6650-0-113`, `01-6650-0-179`, `01-6650-0-194`, `03-6650-0-310`, `03-6650-0-510`, `AR700SS`, `FLATBED`, `FRONT DOOR VENTS`, `JUEGO PARTE (ENSAMBLE)`

### cinetica · CINETICA QUIMICA S.A. DE C.V.
**clave_cliente:** `3360`

| table | count |
|---|---:|
| traficos | 311 |
| entradas | 322 |
| expediente_documentos | 0 |
| globalpc_productos | 726 |
| globalpc_partidas | 428 |
| globalpc_facturas | 326 |
| globalpc_eventos | 1,848 |
| globalpc_proveedores | 19 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 38
- globalpc_partidas distinct cve_producto (via cve_cliente): 38
- **Truth set (union):** 38
- **Claimed in globalpc_productos:** 92
- **Contamination:** 54 (58.7%)
- Sample contamination: `ACIDO ACRILICO`, `AQUA FLOW PUMP`, `BH-304`, `BIOBROM`, `CD-201`, `CD-208`, `CG-8`, `CONDUCTIVITY, NUEVO`, `CONDUCTIVITY, USADO`, `DRUM, 15 GAL`
- Sample truth: `100730`, `25000112-4`, `25000254`, `25000263`, `2517`, `61000122`, `70954`, `70993`, `71002`, `73646`

### cmae · COMPANIA MANUFACTURERA DE ARTEFACTOS ELECTRICOS S.A DE
**clave_cliente:** `2481`

| table | count |
|---|---:|
| traficos | 362 |
| entradas | 389 |
| expediente_documentos | 0 |
| globalpc_productos | 8,563 |
| globalpc_partidas | 1,831 |
| globalpc_facturas | 522 |
| globalpc_eventos | 3,375 |
| globalpc_proveedores | 72 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 488
- globalpc_partidas distinct cve_producto (via cve_cliente): 488
- **Truth set (union):** 488
- **Claimed in globalpc_productos:** 1267
- **Contamination:** 779 (61.5%)
- Sample contamination: `.10C20H338`, `.10C25H338`, `.10C30H334`, `.10C35H334`, `.10C35H338`, `.10C40H338`, `.10CNFH4`, `.10CNFH4/934`, `.10CNFHB/934`, `.10CNFHE/934`
- Sample truth: `#6022 SHEAR BLADES`, `#BL446 LEAF CHAIN`, `0001V1`, `02012-01 DISH KNIFE`, `021238 SCR CAP`, `046908 PIN SPRING`, `0750D0203 MINI CYLINDER-PINCH`, `11BA1010203`, `11BA1010205 25KVA G BUASY WET`, `11BA1030202`

### demo-plastics · DEMO PLASTICS S.A. DE C.V.
**clave_cliente:** `DEMO`

| table | count |
|---|---:|
| traficos | 50 |
| entradas | 30 |
| expediente_documentos | 60 |
| globalpc_productos | 0 |
| globalpc_partidas | 0 |
| globalpc_facturas | 0 |
| globalpc_eventos | 0 |
| globalpc_proveedores | 0 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 0
- globalpc_partidas distinct cve_producto (via cve_cliente): 0
- **Truth set (union):** 0
- **Claimed in globalpc_productos:** 0
- **Contamination:** 0 (0.0%)

### dist-parra · DISTRIBUIDORA PARRA DE MONTERREY SA DE CV
**clave_cliente:** `9393`

| table | count |
|---|---:|
| traficos | 334 |
| entradas | 618 |
| expediente_documentos | 0 |
| globalpc_productos | 10,085 |
| globalpc_partidas | 4,204 |
| globalpc_facturas | 694 |
| globalpc_eventos | 2,759 |
| globalpc_proveedores | 90 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 783
- globalpc_partidas distinct cve_producto (via cve_cliente): 783
- **Truth set (union):** 783
- **Claimed in globalpc_productos:** 1104
- **Contamination:** 321 (29.1%)
- Sample contamination: `00154`, `01000BK`, `01000CL25`, `03493WH26`, `03494AL25`, `03628CL12`, `1`, `1 LT ALUMINUM CUP`, `1000151`, `1000157`
- Sample truth: `(14303)`, `(LE0366)`, `00154/01`, `00172/01`, `010/01`, `01000BK12`, `01000CL12`, `01000RD12`, `01011`, `01011BK48`

### embajada1 · EMBAJADA DE LOS ESTADOS UNIDOS DE NORTEAMERICA
**clave_cliente:** `3187`

| table | count |
|---|---:|
| traficos | 1,987 |
| entradas | 4,926 |
| expediente_documentos | 0 |
| globalpc_productos | 13,755 |
| globalpc_partidas | 7,846 |
| globalpc_facturas | 2,342 |
| globalpc_eventos | 14,398 |
| globalpc_proveedores | 3 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 2204
- globalpc_partidas distinct cve_producto (via cve_cliente): 2204
- **Truth set (union):** 2204
- **Claimed in globalpc_productos:** 6182
- **Contamination:** 3985 (64.5%)
- Sample contamination: `0912-0450--4`, `1/2`, `10264598`, `12 TAPING KNIFE`, `1RF46`, `2230-0150-0`, `2230-0150-1`, `236993`, `2440-0020`, `28W T5`
- Sample truth: `02030-01962`, `02030-02453`, `02030-02471`, `02030-02594`, `02030-02605`, `02030-02622`, `02030-02644`, `410SS`, `ABRAZADERA DE ACERO`, `ABRAZADERAS`

### embajada2 · LA EMBAJADA DE LOS ESTADOS UNIDOS DE NORTEAMERICA
**clave_cliente:** `3186`

| table | count |
|---|---:|
| traficos | 1,800 |
| entradas | 3,609 |
| expediente_documentos | 0 |
| globalpc_productos | 12,782 |
| globalpc_partidas | 7,381 |
| globalpc_facturas | 1,809 |
| globalpc_eventos | 17 |
| globalpc_proveedores | 11 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 2949
- globalpc_partidas distinct cve_producto (via cve_cliente): 2949
- **Truth set (union):** 2949
- **Claimed in globalpc_productos:** 3002
- **Contamination:** 53 (1.8%)
- Sample contamination: `0RRUL1142D`, `A19 LAMPS 100 WATT`, `ACIDO SULFURICO`, `AJAS DE CONEXION`, `ALPHA BATTERY ENCLOSURE`, `BANET CONTROL BOX`, `BATTERY RACK`, `CAP`, `CHAIN LINK FENCE`, `CONTACO MAGNETICO`
- Sample truth: `(FIXTURE)`, `0912-0450--4`, `1/2`, `10002`, `100A/ECONOMY/130V`, `10264598`, `102DC`, `11/2 FW WASHER`, `11/2 NC HEX NUT`, `115PLUSF20`

### embajada3 · EMBAJADA DE LOS ESTADOS UNIDOS DE NORTEAMERICA
**clave_cliente:** `3185`

| table | count |
|---|---:|
| traficos | 963 |
| entradas | 1,283 |
| expediente_documentos | 0 |
| globalpc_productos | 14,704 |
| globalpc_partidas | 10,946 |
| globalpc_facturas | 1,001 |
| globalpc_eventos | 6,272 |
| globalpc_proveedores | 2 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 3416
- globalpc_partidas distinct cve_producto (via cve_cliente): 3416
- **Truth set (union):** 3416
- **Claimed in globalpc_productos:** 5038
- **Contamination:** 1625 (32.3%)
- Sample contamination: `0912-0450--4`, `1/2`, `10264598`, `12 TAPING KNIFE`, `1RF46`, `2230-0150-0`, `2230-0150-1`, `236993`, `2440-0020`, `28W T5`
- Sample truth: `6KY32`, `ABRASIVE DISCS`, `ABRASIVOS EN PAPEL (LIJAS)`, `ABRASIVOS EN PAPEL CARTON`, `ABRASIVOS EN PAPEL(LIJAS)`, `ABRAZADERA DE ACERO`, `ABRAZADERAS`, `ABRAZADERAS DE ACERO`, `ABRAZADERAS DE ACERO PARA REJILLAS`, `ABRAZADERAS DE ACERO PARA TUBOS`

### empaques-litograficos · EMPAQUES Y ACABADOS LITOGRAFICOS S.A. DE C.V.
**clave_cliente:** `3323`

| table | count |
|---|---:|
| traficos | 197 |
| entradas | 208 |
| expediente_documentos | 932 |
| globalpc_productos | 1,223 |
| globalpc_partidas | 1,056 |
| globalpc_facturas | 202 |
| globalpc_eventos | 2,195 |
| globalpc_proveedores | 14 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 33
- globalpc_partidas distinct cve_producto (via cve_cliente): 33
- **Truth set (union):** 33
- **Claimed in globalpc_productos:** 152
- **Contamination:** 120 (78.9%)
- Sample contamination: `156 PALLET TRUCK`, `190/0321L`, `279`, `33B`, `3500658030`, `4-COLOR 0FFSET PRINT`, `48101399`, `604`, `63A`, `68B`
- Sample truth: `01500000004`, `ANAQUELES DE METAL`, `BBUNC`, `CARRETILLAS DE MANO`, `COMPRESORES`, `COMPUTADORA`, `CONWAY GRIPPER`, `CUP P1S`, `CUP P2S`, `CUPSTOCK`

### equipos-dd · EQUIPOS Y MANTENIMIENTO D & D S.A. DE C.V.
**clave_cliente:** `4181`

| table | count |
|---|---:|
| traficos | 156 |
| entradas | 693 |
| expediente_documentos | 0 |
| globalpc_productos | 13,630 |
| globalpc_partidas | 8,766 |
| globalpc_facturas | 995 |
| globalpc_eventos | 679 |
| globalpc_proveedores | 14 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 1100
- globalpc_partidas distinct cve_producto (via cve_cliente): 1100
- **Truth set (union):** 1100
- **Claimed in globalpc_productos:** 1267
- **Contamination:** 172 (13.6%)
- Sample contamination: `188179`, `1989`, `3200`, `3210`, `3211`, `3486106`, `3486110`, `36333`, `36909`, `38089499`
- Sample truth: `10852`, `10CWNR133`, `1777191`, `1779636`, `1779699`, `1779700`, `1779731`, `1779738`, `1779740`, `1779741`

### evco · EVCO PLASTICS DE MEXICO,S.DE R.L.DE C.V.
**clave_cliente:** `9254`

| table | count |
|---|---:|
| traficos | 3,448 |
| entradas | 20,843 |
| expediente_documentos | 214,124 |
| globalpc_productos | 149,710 |
| globalpc_partidas | 22,599 |
| globalpc_facturas | 14,058 |
| globalpc_eventos | 38,437 |
| globalpc_proveedores | 449 |
| anexo24_partidas | 1,793 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 119
- globalpc_partidas distinct cve_producto (via company_id): 4551
- globalpc_partidas distinct cve_producto (via cve_cliente): 4551
- **Truth set (union):** 4575
- **Claimed in globalpc_productos:** 6131
- **Contamination:** 1599 (26.1%)
- Sample contamination: `(007) .6CNNMS/985 INSERT LOCK NUT`, `#27 GLASS CLOTH ELECTRICAL TAPE`, `0-RING`, `001223010`, `001223011`, `0012930101`, `0013790001`, `0013800306`, `00142 ELECTRONIC`, `0022930130`
- Sample truth: `071017`, `3800735`, `BSG200`, `3800513`, `80118`, `012023-MTY`, `002016`, `042133`, `083451`, `083113`

### expoimpo · EXPOIMPO RB S.A. DE C.V.
**clave_cliente:** `4170`

| table | count |
|---|---:|
| traficos | 158 |
| entradas | 189 |
| expediente_documentos | 0 |
| globalpc_productos | 42,689 |
| globalpc_partidas | 5,715 |
| globalpc_facturas | 2,135 |
| globalpc_eventos | 121 |
| globalpc_proveedores | 112 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 972
- globalpc_partidas distinct cve_producto (via cve_cliente): 972
- **Truth set (union):** 972
- **Claimed in globalpc_productos:** 1274
- **Contamination:** 302 (23.7%)
- Sample contamination: `*CASINGS`, `1011-030`, `1014-006T-HB-K`, `1016-030T-141495`, `10181`, `10183`, `10188-STB`, `10190`, `10190-DSR`, `10215`
- Sample truth: `08BOX-K`, `1006-005T`, `1006-005T.168697`, `1006-006T`, `1007-005T`, `1011-030T`, `1011-031T`, `1013-061T-HQ`, `1013-062T-PQ`, `1013-066T-HB-K`

### faurecia · FAURECIA SISTEMAS AUTOMOTRICES DE MEXICO S DE RL DE CV
**clave_cliente:** `4275`

| table | count |
|---|---:|
| traficos | 540 |
| entradas | 549 |
| expediente_documentos | 561 |
| globalpc_productos | 2,097 |
| globalpc_partidas | 1,937 |
| globalpc_facturas | 551 |
| globalpc_eventos | 3,277 |
| globalpc_proveedores | 1 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 20
- globalpc_partidas distinct cve_producto (via cve_cliente): 20
- **Truth set (union):** 20
- **Claimed in globalpc_productos:** 23
- **Contamination:** 5 (21.7%)
- Sample contamination: `EJEMPLO`, `EMPTY PLASTIC BIN`, `ESTRUCTURA`, `PALETAS`, `PALLET`
- Sample truth: `AP PALLET`, `AP PALLET (AL)`, `BASES`, `BUCKHORN`, `CAJA Y TAPAS`, `CAJAS`, `CAJAS DE PLASTICO`, `CAJAS Y TAPAS`, `CORREDERAS`, `FRM COMP`

### ferretera-mims · DISTRIBUIDORA FERRETERA MIMS S.A. DE C.V.
**clave_cliente:** `3020`

| table | count |
|---|---:|
| traficos | 740 |
| entradas | 1,605 |
| expediente_documentos | 3,501 |
| globalpc_productos | 63,983 |
| globalpc_partidas | 25,369 |
| globalpc_facturas | 1,931 |
| globalpc_eventos | 4,732 |
| globalpc_proveedores | 234 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 2211
- globalpc_partidas distinct cve_producto (via cve_cliente): 2211
- **Truth set (union):** 2211
- **Claimed in globalpc_productos:** 3050
- **Contamination:** 847 (27.8%)
- Sample contamination: `0050316023`, `1/16 27`, `1/8 27 NPT`, `100H-1-OL`, `1030A`, `1040A`, `11-516G7`, `113-23B`, `11749/10`, `119-01`
- Sample truth: `#1 CHAIN BREAKERS&`, `#2 CHAIN BREAKERS`, `#3 CHAIN BREAKERS`, `000350`, `000351`, `000352`, `000353`, `000354`, `000355`, `000358`

### g-traders · G-TRADERS GROUP S.A. DE C.V.
**clave_cliente:** `0101`

| table | count |
|---|---:|
| traficos | 326 |
| entradas | 399 |
| expediente_documentos | 1,345 |
| globalpc_productos | 9,586 |
| globalpc_partidas | 8,466 |
| globalpc_facturas | 434 |
| globalpc_eventos | 2,169 |
| globalpc_proveedores | 12 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 930
- globalpc_partidas distinct cve_producto (via cve_cliente): 930
- **Truth set (union):** 930
- **Claimed in globalpc_productos:** 948
- **Contamination:** 18 (1.9%)
- Sample contamination: `1571B`, `20881`, `210602`, `21515`, `21701`, `21993`, `31560`, `39241001`, `39269099`, `4`
- Sample truth: `008-140701`, `01200X0`, `10110`, `10130`, `10131`, `10140`, `10141`, `10160`, `10180`, `10210`

### galia-textil · GALIA TEXTIL S.A. DE C.V.
**clave_cliente:** `4899`

| table | count |
|---|---:|
| traficos | 162 |
| entradas | 182 |
| expediente_documentos | 0 |
| globalpc_productos | 1,648 |
| globalpc_partidas | 257 |
| globalpc_facturas | 186 |
| globalpc_eventos | 153 |
| globalpc_proveedores | 29 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 97
- globalpc_partidas distinct cve_producto (via cve_cliente): 97
- **Truth set (union):** 97
- **Claimed in globalpc_productos:** 156
- **Contamination:** 59 (37.8%)
- Sample contamination: `026580B`, `026580C`, `08856001`, `106890B BAG`, `10850001`, `109659A`, `109828A`, `110990B`, `112570A`, `112570A EVA/NYLON`
- Sample truth: `026580D`, `106797B`, `106797B BAG`, `109653A`, `109659B PPG-030`, `109828C`, `109835A`, `110990A EVA/NYLON`, `110990C`, `110990C EVA/NYLON`

### garlock · GARLOCK DE MEXICO S.A. DE C.V.
**clave_cliente:** `5020`

| table | count |
|---|---:|
| traficos | 3,037 |
| entradas | 3,613 |
| expediente_documentos | 0 |
| globalpc_productos | 60,438 |
| globalpc_partidas | 17,097 |
| globalpc_facturas | 3,953 |
| globalpc_eventos | 2,707 |
| globalpc_proveedores | 87 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 1394
- globalpc_partidas distinct cve_producto (via cve_cliente): 1394
- **Truth set (union):** 1394
- **Claimed in globalpc_productos:** 2381
- **Contamination:** 987 (41.5%)
- Sample contamination: `#141`, `#325 MESH BENTONITE`, `#777-5`, `00-006-061`, `000-095-689`, `000-095-690`, `000-095-691`, `000070020999`, `001`, `002`
- Sample truth: `#325`, `00-0001-039`, `00-0003-020`, `00-0006-061`, `00-0006-073`, `00-01-02-13`, `00-01-02-18`, `00-01-02-20`, `00-01-02-24`, `00-01-02-35`

### gostech · GOSTECH S.A. DE C.V.
**clave_cliente:** `5081`

| table | count |
|---|---:|
| traficos | 226 |
| entradas | 293 |
| expediente_documentos | 0 |
| globalpc_productos | 7,040 |
| globalpc_partidas | 5,085 |
| globalpc_facturas | 280 |
| globalpc_eventos | 1,488 |
| globalpc_proveedores | 37 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 223
- globalpc_partidas distinct cve_producto (via cve_cliente): 223
- **Truth set (union):** 223
- **Claimed in globalpc_productos:** 737
- **Contamination:** 514 (69.7%)
- Sample contamination: `.014 C1S SBS 23"`, `.014 SBS`, `.146`, `#40 100YD`, `#5 100 YD`, `#75`, `#9 100 YD`, `00194015`, `01`, `0240`
- Sample truth: `.136`, `0033230`, `006403`, `033120`, `033169`, `033194`, `061708`, `06213`, `11001`, `11002`

### grupo-pelayo · GRUPO PELAYO S.A. DE C.V.
**clave_cliente:** `1934`

| table | count |
|---|---:|
| traficos | 742 |
| entradas | 775 |
| expediente_documentos | 0 |
| globalpc_productos | 8,038 |
| globalpc_partidas | 2,596 |
| globalpc_facturas | 1,274 |
| globalpc_eventos | 2,504 |
| globalpc_proveedores | 22 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 120
- globalpc_partidas distinct cve_producto (via cve_cliente): 120
- **Truth set (union):** 120
- **Claimed in globalpc_productos:** 478
- **Contamination:** 358 (74.9%)
- Sample contamination: `.10C20H338`, `.10C25H338`, `.10C30H334`, `.10C35H334`, `.10C35H338`, `.10C40H338`, `.10CNFH4`, `.10CNFH4/934`, `.10CNFHB/934`, `.10CNFHE/934`
- Sample truth: `11BA1000201`, `11BA1010203`, `11BA1030202`, `11BA1030203`, `11BA1330201 BUSHING`, `11BA1410201`, `11BE1010204`, `11BE1010700`, `11BG1010204`, `11HG1320302`

### grupo-requena · GRUPO REQUENA S.A. DE C.V.
**clave_cliente:** `5155`

| table | count |
|---|---:|
| traficos | 214 |
| entradas | 296 |
| expediente_documentos | 1,150 |
| globalpc_productos | 899 |
| globalpc_partidas | 586 |
| globalpc_facturas | 283 |
| globalpc_eventos | 1,986 |
| globalpc_proveedores | 56 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 295
- globalpc_partidas distinct cve_producto (via cve_cliente): 295
- **Truth set (union):** 295
- **Claimed in globalpc_productos:** 305
- **Contamination:** 13 (4.3%)
- Sample contamination: `0100`, `2000`, `200T 3M SENSORY KIT`, `698 MEDIUM  WATER WALKING ASSI`, `APARATO PARA TERAPIA`, `AROMA MOUSE DIFFUSER WITH CORD`, `BLUE CHASING ROPE LIGHT KIT`, `MOBILE PODAITRY WHIRLPOOL`, `OPT MASSAGE 15`, `OPT VIDEO 500/500I`
- Sample truth: `002-LE125B`, `00653814037085`, `01884`, `01885`, `01886`, `01887`, `03-13900`, `03-CHM8058`, `03-E1004`, `03-FER-STRET`

### hilos-iris · HILOS IRIS S.A. DE C.V
**clave_cliente:** `5343`

| table | count |
|---|---:|
| traficos | 277 |
| entradas | 343 |
| expediente_documentos | 1,571 |
| globalpc_productos | 1,173 |
| globalpc_partidas | 735 |
| globalpc_facturas | 298 |
| globalpc_eventos | 2,785 |
| globalpc_proveedores | 27 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 109
- globalpc_partidas distinct cve_producto (via cve_cliente): 109
- **Truth set (union):** 109
- **Claimed in globalpc_productos:** 300
- **Contamination:** 191 (63.7%)
- Sample contamination: `016509`, `0207241`, `1/10 D'TEX/48`, `1/10 D'TEX/48 FILAME`, `1/110 D' TEX/48`, `1/167 D'TEX /48`, `1/32 D'TEX/48`, `1/67 D' TEX/48 FILAM`, `1/67 D'48`, `1/83 D' TEX/36`
- Sample truth: `1/83 D' TEX/36 FILAMENT`, `10036230`, `10036231`, `10674`, `1111`, `1124`, `120385`, `120386`, `120387`, `120388`

### instrumentos-medicos · INSTRUMENTOS MEDICOS INTERNACIONALES S.A DE C.V
**clave_cliente:** `3066`

| table | count |
|---|---:|
| traficos | 209 |
| entradas | 379 |
| expediente_documentos | 0 |
| globalpc_productos | 3,944 |
| globalpc_partidas | 3,681 |
| globalpc_facturas | 456 |
| globalpc_eventos | 2,372 |
| globalpc_proveedores | 11 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 158
- globalpc_partidas distinct cve_producto (via cve_cliente): 158
- **Truth set (union):** 158
- **Claimed in globalpc_productos:** 167
- **Contamination:** 9 (5.4%)
- Sample contamination: `281300-50 MEPILEX BORDER LITE`, `281500-50 MEPILEX BORDER LITE`, `282050-50 MEPILEX BORDER SACRUM`, `295200-50 MEPILEX BORDER`, `295400-50 MEPILEX BORDER`, `83030-001 APOSITO ADHESIVO PARA  CUBRIR`, `83032-001 APOSITO ADHESIVO PARA CUBRIR`, `APOSITO ADHESIVO`, `PDC008`
- Sample truth: `2434-03`, `2436-03`, `2436-03 TUBIFAST 2-WAY STRECH`, `2438-03`, `2438-03 TUBIFAST 2-WAY STRECH`, `252200-01`, `252200-01 MELGISORB PLUS`, `252500-01`, `281000-02`, `281200-50`

### lvm-nucleo · LVM NUCLEO S DE RL DE CV
**clave_cliente:** `3576`

| table | count |
|---|---:|
| traficos | 216 |
| entradas | 225 |
| expediente_documentos | 0 |
| globalpc_productos | 413 |
| globalpc_partidas | 319 |
| globalpc_facturas | 243 |
| globalpc_eventos | 960 |
| globalpc_proveedores | 12 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 91
- globalpc_partidas distinct cve_producto (via cve_cliente): 91
- **Truth set (union):** 91
- **Claimed in globalpc_productos:** 94
- **Contamination:** 3 (3.2%)
- Sample contamination: `MANUFACTURA DE METAL`, `SOLA TRANSORMER`, `YAR/PORTABLE STEEL YARDRAMP`
- Sample truth: `2 TON GANTRY CRANE`, `2 TON HSI`, `3 PHASE TRANSFORMER`, `47634 OHEPOWELD 17634-A`, `57634 OHEPOWELD 17634-B`, `6.7 SA1M 5 PLY PRESPOOL`, `6.70`, `6.70 TRANSFORMER CORE`, `8.40 5 PLY TRANSFORMER`, `AC POWER SUPPLY W/CABLES`

### mafesa · MANUFACTURERA FEDERAL ELECTRICA S.DE RL DE CV
**clave_cliente:** `4598`

| table | count |
|---|---:|
| traficos | 776 |
| entradas | 1,155 |
| expediente_documentos | 2,238 |
| globalpc_productos | 5,567 |
| globalpc_partidas | 6,287 |
| globalpc_facturas | 1,257 |
| globalpc_eventos | 0 |
| globalpc_proveedores | 32 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 1250
- globalpc_partidas distinct cve_producto (via cve_cliente): 1250
- **Truth set (union):** 1250
- **Claimed in globalpc_productos:** 1681
- **Contamination:** 432 (25.7%)
- Sample contamination: `#14 CRIMP LUG`, `#18:94/0350`, `#3:95/0228/00`, `#30:0019`, `#30:60/0019/89`, `01063 VALVE V DISCH`, `02/0709-00/50 VALVE`, `1/4 X 3 BOLTS 84-121`, `10" LEAD ASSY`, `10249A`
- Sample truth: `#11:01/0092/89`, `#12:95/0851/87`, `#18:94/0350-2/50`, `#19 O RING`, `#3:95/0228`, `#30:60/0019`, `#5:01/0055/89`, `0.5THOIST/M154`, `0.5THOIST/M155`, `01/0013/98`

### maniphor · MANIPHOR S.A. DE C.V.
**clave_cliente:** `8102`

| table | count |
|---|---:|
| traficos | 387 |
| entradas | 402 |
| expediente_documentos | 908 |
| globalpc_productos | 3,370 |
| globalpc_partidas | 1,899 |
| globalpc_facturas | 424 |
| globalpc_eventos | 3,913 |
| globalpc_proveedores | 71 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 36
- globalpc_partidas distinct cve_producto (via cve_cliente): 36
- **Truth set (union):** 36
- **Claimed in globalpc_productos:** 829
- **Contamination:** 793 (95.7%)
- Sample contamination: `.014 C1S SBS 23"`, `.014 SBS`, `.017`, `.12C1SSBS`, `.136`, `.146`, `.21SUS`, `#40 100YD`, `#5 100 YD`, `#75`
- Sample truth: `(CRB)`, `(SBS)`, `(URB)`, `BAG KRAFT`, `BL`, `BLEACH KRAFT`, `BLEACHED BAG`, `BLEACHED WET`, `CARRIER PAPERBOARD`, `CARRIER UNCOATED PAPERBOARD`

### maquinaria-pacifico · MAQUINARIA DEL PACIFICO S.A. DE C.V.
**clave_cliente:** `6460`

| table | count |
|---|---:|
| traficos | 300 |
| entradas | 627 |
| expediente_documentos | 1,899 |
| globalpc_productos | 60,488 |
| globalpc_partidas | 16,913 |
| globalpc_facturas | 720 |
| globalpc_eventos | 2,412 |
| globalpc_proveedores | 25 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 4522
- globalpc_partidas distinct cve_producto (via cve_cliente): 4522
- **Truth set (union):** 4522
- **Claimed in globalpc_productos:** 7586
- **Contamination:** 3065 (40.4%)
- Sample contamination: `0001119853`, `0001185970`, `0001945168`, `0002381136`, `0025X6-10`, `0025X7`, `0025X7-10`, `0025X7MA`, `0031X4`, `0031X4MA`
- Sample truth: `000335-`, `0003680608`, `020378`, `020379`, `020740`, `020741`, `030466`, `030468`, `030471`, `030614`

### mercatrup · MERCATRUP.COM S. DE R.L. DE C.V.
**clave_cliente:** `7316`

| table | count |
|---|---:|
| traficos | 161 |
| entradas | 178 |
| expediente_documentos | 0 |
| globalpc_productos | 406 |
| globalpc_partidas | 280 |
| globalpc_facturas | 164 |
| globalpc_eventos | 1,678 |
| globalpc_proveedores | 15 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 74
- globalpc_partidas distinct cve_producto (via cve_cliente): 74
- **Truth set (union):** 74
- **Claimed in globalpc_productos:** 86
- **Contamination:** 12 (14.0%)
- Sample contamination: `3M1012566`, `AERO SAVER`, `BUJES PARA SUSPENSION`, `CORNER PANEL`, `DONAS`, `FRONT RAIL`, `GANCHO`, `LOWER RAIL`, `PRESSURE GUARD SYSTEM`, `REEFER`
- Sample truth: `01-2170-0-040`, `02-7115-0-048`, `03-1510-0-007`, `03-1510-0-008`, `03-6009-0-029`, `03-6009-0-030`, `03-6009-0-031`, `04-4150-0-012`, `12721212`, `1308161`

### papeles-bolsas · PAPELES Y BOLSAS ECOLOGICAS S.A. DE C.V.
**clave_cliente:** `7110`

| table | count |
|---|---:|
| traficos | 183 |
| entradas | 324 |
| expediente_documentos | 0 |
| globalpc_productos | 2,446 |
| globalpc_partidas | 1,676 |
| globalpc_facturas | 353 |
| globalpc_eventos | 2,392 |
| globalpc_proveedores | 17 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 279
- globalpc_partidas distinct cve_producto (via cve_cliente): 279
- **Truth set (union):** 279
- **Claimed in globalpc_productos:** 349
- **Contamination:** 70 (20.1%)
- Sample contamination: `33809`, `BOLSAS DE PLASTICO`, `C09NK1`, `C10NK1`, `CN-1HOL`, `CN-6HOL`, `CW-1-XMAS`, `CW-1GRN`, `CW-6-XMAS`, `CW-6GRN`
- Sample truth: `054012`, `057800`, `057850`, `057950`, `116008`, `116030`, `1260`, `1260-CB`, `1270-CB`, `1280-CB`

### plasticos-ing · PLASTICOS DE INGENIERIA TECNOQUIM SA DE CV
**clave_cliente:** `7324`

| table | count |
|---|---:|
| traficos | 178 |
| entradas | 289 |
| expediente_documentos | 0 |
| globalpc_productos | 1,548 |
| globalpc_partidas | 1,230 |
| globalpc_facturas | 523 |
| globalpc_eventos | 1,088 |
| globalpc_proveedores | 14 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 92
- globalpc_partidas distinct cve_producto (via cve_cliente): 92
- **Truth set (union):** 92
- **Claimed in globalpc_productos:** 109
- **Contamination:** 17 (15.6%)
- Sample contamination: `C ACETAL NATURAL`, `POLYSTONE BLK`, `POLYSTONE CUT-RITE`, `POLYSTONE CUT-RITE 5`, `POLYSTONE M NAT`, `POLYSTONE NATURAL`, `POLYSTONE P HOM NATU`, `RCNYVNOPMOS07500`, `SCNYVNOPMOS250048096`, `SEULVNATNOA0750DROP SUSTA PEI`
- Sample truth: `1162600916497`, `1162607916497`, `2502106`, `3034200116AW4`, `3036200016HUE`, `3036200516UPG`, `3502033`, `3502036`, `3502063 CBC-5-2 BLACK`, `3502066`

### plasticos-villagar · PLASTICOS VILLAGAR S.A. DE C.V.
**clave_cliente:** `7331`

| table | count |
|---|---:|
| traficos | 278 |
| entradas | 374 |
| expediente_documentos | 0 |
| globalpc_productos | 1,098 |
| globalpc_partidas | 764 |
| globalpc_facturas | 399 |
| globalpc_eventos | 2,228 |
| globalpc_proveedores | 20 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 213
- globalpc_partidas distinct cve_producto (via cve_cliente): 213
- **Truth set (union):** 213
- **Claimed in globalpc_productos:** 291
- **Contamination:** 78 (26.8%)
- Sample contamination: `112204`, `113498`, `115733`, `115950`, `115968`, `115970`, `116426`, `126653`, `141299`, `142123M`
- Sample truth: `109FB7`, `109N70`, `110234`, `110243`, `110790`, `114791`, `114905`, `115680`, `115716`, `115902`

### preciomex · PRECIOMEX S.A. DE C.V.
**clave_cliente:** `7759`

| table | count |
|---|---:|
| traficos | 203 |
| entradas | 492 |
| expediente_documentos | 0 |
| globalpc_productos | 3,695 |
| globalpc_partidas | 1,860 |
| globalpc_facturas | 862 |
| globalpc_eventos | 1,599 |
| globalpc_proveedores | 21 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 187
- globalpc_partidas distinct cve_producto (via cve_cliente): 187
- **Truth set (union):** 187
- **Claimed in globalpc_productos:** 255
- **Contamination:** 68 (26.7%)
- Sample contamination: `1`, `106-80006`, `106-90136`, `109-70013`, `109-70041`, `109-70047`, `109-72007-2`, `109-72121`, `3000SA2`, `306-7305 5H`
- Sample truth: `016111/16X1X100`, `016111/16X2X100`, `016111/8X1X100`, `016111/8X2X100`, `0271118HT`, `0272213PTA130-1`, `0472318HT`, `1006`, `103-70036`, `103-80224`

### promotora-mexicana · PROMOTORA MEXICANA S.A. DE C.V.
**clave_cliente:** `7557`

| table | count |
|---|---:|
| traficos | 149 |
| entradas | 214 |
| expediente_documentos | 0 |
| globalpc_productos | 5,317 |
| globalpc_partidas | 3,206 |
| globalpc_facturas | 237 |
| globalpc_eventos | 1,167 |
| globalpc_proveedores | 17 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 222
- globalpc_partidas distinct cve_producto (via cve_cliente): 222
- **Truth set (union):** 222
- **Claimed in globalpc_productos:** 531
- **Contamination:** 309 (58.2%)
- Sample contamination: `.0625`, `.0720" SQUARE OIL TE`, `.0920`, `.0990`, `.1560`, `.2070"`, `.2500"`, `.3930"`, `.5000"`, `02216`
- Sample truth: `.1205`, `.1250`, `.1920`, `018300`, `040-1001`, `0M101`, `21-04`, `21-05`, `21-06`, `21-07`

### pti-dos · PTI DOS DIVERSIFIED OUTSOURCING SOLUTIONS S. DE R.L DE C.V
**clave_cliente:** `0627`

| table | count |
|---|---:|
| traficos | 1,077 |
| entradas | 1,276 |
| expediente_documentos | 0 |
| globalpc_productos | 2,022 |
| globalpc_partidas | 2,015 |
| globalpc_facturas | 1,207 |
| globalpc_eventos | 5,872 |
| globalpc_proveedores | 27 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 427
- globalpc_partidas distinct cve_producto (via cve_cliente): 427
- **Truth set (union):** 427
- **Claimed in globalpc_productos:** 461
- **Contamination:** 34 (7.4%)
- Sample contamination: `312X-1`, `6261K184 SINGLE STRAND ROLLER CHAIN`, `6261K214 SINGLE STRAND ROLLER CHAIN`, `6261K274 SINGLE STRAND ROLLER CHAIN`, `79001-04 O RING`, `79001-29 O RING`, `AIR CAP 79153-65R-1`, `BRAKE PISTON`, `CAUCHO`, `COMPUTERS SYX VENTURE`
- Sample truth: `000-094-002 NEEDLE`, `000-161-112 SCREW`, `100 MESH FILTER PACK`, `100049-1 IGNITER`, `101010818 SWITCH`, `101010819 SWITCH`, `1040 TRANSFER PUMP`, `104361 KIT ORINGS`, `12178 TRANSFORMER`, `12746 SCANNER (SENSOR FOR BURN`

### pti-qcs · PTI QCS S. DE R.L DE C.V
**clave_cliente:** `0626`

| table | count |
|---|---:|
| traficos | 172 |
| entradas | 177 |
| expediente_documentos | 0 |
| globalpc_productos | 554 |
| globalpc_partidas | 401 |
| globalpc_facturas | 241 |
| globalpc_eventos | 948 |
| globalpc_proveedores | 17 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 143
- globalpc_partidas distinct cve_producto (via cve_cliente): 143
- **Truth set (union):** 143
- **Claimed in globalpc_productos:** 149
- **Contamination:** 6 (4.0%)
- Sample contamination: `860X-1 EXTRUSION LINEAL`, `CENTRAL BEARING`, `HYDRAULIC BEND BASE/FRAME SB-5`, `SILICONE CAP/PLUG`, `SLEEVES`, `SLIP YOKE`
- Sample truth: `05-1340-515228 SENOGUARD`, `091611-1013406-001 HYD PUMP`, `18020 3010 NG ALUMINUM SHIM W/RUBBER`, `19-1341-515231 SENOGUARD`, `30002002K ALUMINUM`, `312X-1-D`, `312X-2`, `4 POST PRESS #1`, `4 POST PRESS #2`, `4213-2231 PLASTIC FRAMES`

### sercom · SERCOM INTERNACIONAL S.A. DE C.V.
**clave_cliente:** `3838`

| table | count |
|---|---:|
| traficos | 222 |
| entradas | 268 |
| expediente_documentos | 0 |
| globalpc_productos | 2,322 |
| globalpc_partidas | 840 |
| globalpc_facturas | 240 |
| globalpc_eventos | 769 |
| globalpc_proveedores | 9 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 434
- globalpc_partidas distinct cve_producto (via cve_cliente): 434
- **Truth set (union):** 434
- **Claimed in globalpc_productos:** 2017
- **Contamination:** 1589 (78.8%)
- Sample contamination: `(PR) SIDE CHANNEL-SU`, ``LIBROS`, `016514`, `058-81-79167`, `0813-700-09`, `10-5898903`, `100019`, `100030`, `100157`, `100403`
- Sample truth: `10047`, `10739L`, `10801`, `10888`, `12910`, `130R0072CH`, `136DK`, `14112`, `14119`, `14767`

### stempro · STEMPRO DE MEXICO S. DE R.L. DE C.V.
**clave_cliente:** `8399`

| table | count |
|---|---:|
| traficos | 779 |
| entradas | 1,419 |
| expediente_documentos | 0 |
| globalpc_productos | 25,913 |
| globalpc_partidas | 18,530 |
| globalpc_facturas | 981 |
| globalpc_eventos | 1,979 |
| globalpc_proveedores | 8 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 1008
- globalpc_partidas distinct cve_producto (via cve_cliente): 1008
- **Truth set (union):** 1008
- **Claimed in globalpc_productos:** 1174
- **Contamination:** 166 (14.1%)
- Sample contamination: `0011832102`, `001851047`, `0115001380`, `011502901`, `011503001`, `011504501`, `0115515360`, `0115713103`, `011610190`, `011610690`
- Sample truth: `011020004`, `011025001`, `011025003`, `011030001`, `011030002`, `011030003`, `011030004`, `011030005`, `011030006`, `011030008`

### tork-electro · TORK ELECTRO SISTEMAS SA DE CV
**clave_cliente:** `8503`

| table | count |
|---|---:|
| traficos | 607 |
| entradas | 2,622 |
| expediente_documentos | 0 |
| globalpc_productos | 11,633 |
| globalpc_partidas | 10,529 |
| globalpc_facturas | 3,334 |
| globalpc_eventos | 4,122 |
| globalpc_proveedores | 127 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 1149
- globalpc_partidas distinct cve_producto (via cve_cliente): 1149
- **Truth set (union):** 1149
- **Claimed in globalpc_productos:** 1165
- **Contamination:** 26 (2.2%)
- Sample contamination: `10218`, `10219`, `10344`, `10396`, `140492`, `2100`, `441452601`, `73514-R`, `871591`, `900006-37`
- Sample truth: `-12`, `02-002-KIT`, `02311-000-1000`, `02311-002-1000`, `03311-000-1248`, `04300-005-1012`, `10-ERA-6AEB1543CVT-ND`, `10009`, `10032`, `10034`

### tracusa · TRACUSA LA RUTA DEL SOL SA DE CV
**clave_cliente:** `8704`

| table | count |
|---|---:|
| traficos | 417 |
| entradas | 421 |
| expediente_documentos | 0 |
| globalpc_productos | 432 |
| globalpc_partidas | 427 |
| globalpc_facturas | 427 |
| globalpc_eventos | 4,070 |
| globalpc_proveedores | 3 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 3
- globalpc_partidas distinct cve_producto (via cve_cliente): 3
- **Truth set (union):** 3
- **Claimed in globalpc_productos:** 3
- **Contamination:** 0 (0.0%)
- Sample truth: `OAK FLOORING`, `SEMIREMOLQUE`, `SEMIREMORLQUE  REFRIGERADO`

### ts-san-pedro · TS DE SAN PEDRO INDUSTRIES S. DE R.L. DE C.V.
**clave_cliente:** `8225`

| table | count |
|---|---:|
| traficos | 175 |
| entradas | 228 |
| expediente_documentos | 896 |
| globalpc_productos | 2,896 |
| globalpc_partidas | 3,119 |
| globalpc_facturas | 305 |
| globalpc_eventos | 1,638 |
| globalpc_proveedores | 1 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 121
- globalpc_partidas distinct cve_producto (via cve_cliente): 121
- **Truth set (union):** 121
- **Claimed in globalpc_productos:** 121
- **Contamination:** 1 (0.8%)
- Sample contamination: `CAJAS DE CARTON BIG PACK`
- Sample truth: `10006405`, `10010254`, `30035359`, `30038512`, `30038518`, `30038519`, `30038521`, `30038523`, `30038525`, `30038530`

### vollrath · VOLLRATH DE MEXICO S DE R.L. DE C.V.
**clave_cliente:** `9089`

| table | count |
|---|---:|
| traficos | 543 |
| entradas | 594 |
| expediente_documentos | 0 |
| globalpc_productos | 78,412 |
| globalpc_partidas | 54,913 |
| globalpc_facturas | 615 |
| globalpc_eventos | 4,784 |
| globalpc_proveedores | 11 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 4709
- globalpc_partidas distinct cve_producto (via cve_cliente): 4709
- **Truth set (union):** 4709
- **Claimed in globalpc_productos:** 5490
- **Contamination:** 783 (14.3%)
- Sample contamination: `005027-5`, `005028-5`, `005029-5`, `005030-5`, `07312`, `07411`, `08102-1`, `08260-1`, `08282-1`, `08320-1`
- Sample truth: `014487-5`, `014488-5`, `0231-309I2F`, `0231-38I2`, `0431-309I2F`, `0431-30PI2F`, `0643N`, `0644N`, `0646N`, `0652`

### whitehall · WHITEHALL INDUSTRIES DE MEXICO S DE RL. DE CV.
**clave_cliente:** `9042`

| table | count |
|---|---:|
| traficos | 151 |
| entradas | 157 |
| expediente_documentos | 0 |
| globalpc_productos | 1,348 |
| globalpc_partidas | 1,075 |
| globalpc_facturas | 191 |
| globalpc_eventos | 0 |
| globalpc_proveedores | 3 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 293
- globalpc_partidas distinct cve_producto (via cve_cliente): 293
- **Truth set (union):** 293
- **Claimed in globalpc_productos:** 316
- **Contamination:** 23 (7.3%)
- Sample contamination: `504 CBORE`, `551-625`, `551/625`, `ALLEN WRENCH SET`, `BEND DIE`, `CMM FIXTURE LH`, `CMM FIXTURE RH`, `DEBURR & DRILL MACHINE`, `DEBURR & DRILL MACHINE.`, `DIE CUTTER STATION`
- Sample truth: `(ENSAMBLE) PARTES PARA MAQUINA`, `0013-P-36 HYDRAULIC PRESS`, `0015 ROTARY DRAIN`, `0020 551/625 BENDER`, `0026 F-2403`, `0027 F-2536 504 TOX`, `0035 HYDRAULIC PUMP`, `0036 551/625 2-STAGE`, `003654 SPRING`, `0037 504 PUNCH DIE`

### worldtech · WORLDTECH S.A. DE C.V.
**clave_cliente:** `9045`

| table | count |
|---|---:|
| traficos | 832 |
| entradas | 885 |
| expediente_documentos | 149 |
| globalpc_productos | 2,347 |
| globalpc_partidas | 1,918 |
| globalpc_facturas | 959 |
| globalpc_eventos | 3,152 |
| globalpc_proveedores | 45 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 75
- globalpc_partidas distinct cve_producto (via cve_cliente): 75
- **Truth set (union):** 75
- **Claimed in globalpc_productos:** 169
- **Contamination:** 94 (55.6%)
- Sample contamination: `.014 SBS`, `.017`, `.12C1SSBS`, `.21SUS`, `00400`, `0308-AY-0308-A`, `10983`, `13-325-0-04-00`, `1986`, `2086`
- Sample truth: `10282`, `120630002`, `2092869`, `352538035`, `362291190994`, `ADHESIVO`, `AIR COND`, `APARATO`, `BLEACH MG`, `BLEACHED KRAFT`

### yates · YATES CONSTRUCTION MEXICO S DE RL DE CV
**clave_cliente:** `9144`

| table | count |
|---|---:|
| traficos | 283 |
| entradas | 489 |
| expediente_documentos | 0 |
| globalpc_productos | 2,921 |
| globalpc_partidas | 988 |
| globalpc_facturas | 373 |
| globalpc_eventos | 11 |
| globalpc_proveedores | 12 |
| anexo24_partidas | 0 |

**Truth sources:**
- anexo24_partidas distinct numero_parte: 0
- globalpc_partidas distinct cve_producto (via company_id): 369
- globalpc_partidas distinct cve_producto (via cve_cliente): 369
- **Truth set (union):** 369
- **Claimed in globalpc_productos:** 1178
- **Contamination:** 810 (68.8%)
- Sample contamination: `(FIXTURE)`, `0912-0450--4`, `1/2`, `10002`, `100A/ECONOMY/130V`, `10264598`, `102DC`, `115PLUSF20`, `12 TAPING KNIFE`, `130C-3/4`
- Sample truth: `549900`, `A6MB-12-144`, `A6MB-18-144`, `A6MB-24-144`, `ABRAZADERAS`, `ABRAZADERAS DE ACERO`, `ABRAZADERAS DE ACERO.`, `ABRAZADERAS VERTICALES`, `ABRAZADERAS.`, `ACCESORIO DE TUBERIA`

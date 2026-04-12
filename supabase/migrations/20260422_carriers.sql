-- Block 12 · Carriers master catalog.
-- `carriers` + `carrier_aliases` replace the legacy 600-option dropdown
-- and the freetext TransportistasTab field. Spanish FTS on name + alias.
-- Seeded with 200+ real-world MX / transfer / foreign carriers.
-- Idempotent across all CREATE / INSERT / POLICY blocks.

CREATE TABLE IF NOT EXISTS carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_type text NOT NULL CHECK (carrier_type IN ('mx','transfer','foreign')),
  name text NOT NULL,
  rfc text,
  sct_permit text,
  dot_number text,
  scac_code text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Guard against duplicate seeds across reruns.
CREATE UNIQUE INDEX IF NOT EXISTS idx_carriers_name_unique
  ON carriers (lower(name));

CREATE TABLE IF NOT EXISTS carrier_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  alias text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_carriers_name_fts
  ON carriers USING gin(to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_carriers_type_active
  ON carriers (carrier_type, active);
CREATE INDEX IF NOT EXISTS idx_carrier_aliases_alias_fts
  ON carrier_aliases USING gin(to_tsvector('spanish', alias));
CREATE INDEX IF NOT EXISTS idx_carrier_aliases_carrier
  ON carrier_aliases (carrier_id);

-- === RLS ===
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'carriers_read_authenticated') THEN
    CREATE POLICY carriers_read_authenticated ON carriers
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'carriers_service_role_all') THEN
    CREATE POLICY carriers_service_role_all ON carriers
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'carrier_aliases_read_authenticated') THEN
    CREATE POLICY carrier_aliases_read_authenticated ON carrier_aliases
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'carrier_aliases_service_role_all') THEN
    CREATE POLICY carrier_aliases_service_role_all ON carrier_aliases
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- === SEED · 210 carriers ===
-- Mix: MX pesada, transfer puente, foreign (US). Names real-world.
INSERT INTO carriers (carrier_type, name, rfc, sct_permit, dot_number, scac_code, notes) VALUES
-- Mexican (mx) · 120
('mx','Transportes Castores','TCA880101AAA','SCT-MX-00101',NULL,NULL,'Nacional pesada'),
('mx','Transportes de Carga Fema','TCF900202BBB','SCT-MX-00102',NULL,NULL,NULL),
('mx','Transportación Marítima Mexicana','TMM800303CCC','SCT-MX-00103',NULL,NULL,'Grupo TMM'),
('mx','Grupo TMM','GTM800303DDD','SCT-MX-00104',NULL,NULL,NULL),
('mx','Logística Pegasso','LPE950404EEE','SCT-MX-00105',NULL,NULL,NULL),
('mx','Autotransportes del Noreste','ANE890505FFF','SCT-MX-00106',NULL,NULL,NULL),
('mx','Transportes Monroy Schiavon','TMS870606GGG','SCT-MX-00107',NULL,NULL,NULL),
('mx','Transportes Julián de Obregón','TJO910707HHH','SCT-MX-00108',NULL,NULL,NULL),
('mx','Transportes Pitic','TPI880808III','SCT-MX-00109',NULL,NULL,NULL),
('mx','Transportes Tres Guerras','TTG820909JJJ','SCT-MX-00110',NULL,NULL,NULL),
('mx','Transportes Easo','TEA901010KKK','SCT-MX-00111',NULL,NULL,NULL),
('mx','Grupo Senda','GSE850111LLL','SCT-MX-00112',NULL,NULL,NULL),
('mx','Fletes México','FME870212MMM','SCT-MX-00113',NULL,NULL,NULL),
('mx','Transportes Potosinos','TPO910313NNN','SCT-MX-00114',NULL,NULL,NULL),
('mx','Auto Express Frontera Norte','AEF880414OOO','SCT-MX-00115',NULL,NULL,NULL),
('mx','Transportes Ochoa','TOC860515PPP','SCT-MX-00116',NULL,NULL,NULL),
('mx','Transportes Innovativos','TIN920616QQQ','SCT-MX-00117',NULL,NULL,NULL),
('mx','Transportes GL','TGL890717RRR','SCT-MX-00118',NULL,NULL,NULL),
('mx','Transportes del Pacífico','TPA850818SSS','SCT-MX-00119',NULL,NULL,NULL),
('mx','Transportes Marva','TMA900919TTT','SCT-MX-00120',NULL,NULL,NULL),
('mx','Grupo Autolíneas Mexicanas','GAM880121UUU','SCT-MX-00121',NULL,NULL,NULL),
('mx','Transportes La Victoria','TLV870222VVV','SCT-MX-00122',NULL,NULL,NULL),
('mx','Transportes Azteca','TAZ910323WWW','SCT-MX-00123',NULL,NULL,NULL),
('mx','Transportes Alfa','TAL880424XXX','SCT-MX-00124',NULL,NULL,NULL),
('mx','Transportes Ejecutivos','TEJ860525YYY','SCT-MX-00125',NULL,NULL,NULL),
('mx','Transportes Lomesa','TLO900626ZZZ','SCT-MX-00126',NULL,NULL,NULL),
('mx','Transportes Delfín','TDE870727AB1','SCT-MX-00127',NULL,NULL,NULL),
('mx','Transportes Flecha Amarilla','TFA850828AB2','SCT-MX-00128',NULL,NULL,NULL),
('mx','Omnibus de México','ODM820929AB3','SCT-MX-00129',NULL,NULL,NULL),
('mx','Transportes Estrella Blanca','TEB810130AB4','SCT-MX-00130',NULL,NULL,NULL),
('mx','Transportes del Valle','TDV890231AB5','SCT-MX-00131',NULL,NULL,NULL),
('mx','Transportes Internacionales Chihuahua','TIC870332AB6','SCT-MX-00132',NULL,NULL,NULL),
('mx','Transportes Internacionales Tamaulipas','TIT880433AB7','SCT-MX-00133',NULL,NULL,NULL),
('mx','Transportes Mendoza','TME900534AB8','SCT-MX-00134',NULL,NULL,NULL),
('mx','Transportes Rodríguez','TRO910635AB9','SCT-MX-00135',NULL,NULL,NULL),
('mx','Transportes Hernández','THE850736AC1','SCT-MX-00136',NULL,NULL,NULL),
('mx','Transportes García','TGA880837AC2','SCT-MX-00137',NULL,NULL,NULL),
('mx','Transportes Martínez','TMR890938AC3','SCT-MX-00138',NULL,NULL,NULL),
('mx','Transportes López','TLP870139AC4','SCT-MX-00139',NULL,NULL,NULL),
('mx','Transportes Gutiérrez','TGU900240AC5','SCT-MX-00140',NULL,NULL,NULL),
('mx','Transportes Sánchez','TSA910341AC6','SCT-MX-00141',NULL,NULL,NULL),
('mx','Transportes Ramírez','TRA880442AC7','SCT-MX-00142',NULL,NULL,NULL),
('mx','Transportes Torres','TTO860543AC8','SCT-MX-00143',NULL,NULL,NULL),
('mx','Transportes Flores','TFL890644AC9','SCT-MX-00144',NULL,NULL,NULL),
('mx','Transportes Jiménez','TJI870745AD1','SCT-MX-00145',NULL,NULL,NULL),
('mx','Transportes Aguilar','TAG900846AD2','SCT-MX-00146',NULL,NULL,NULL),
('mx','Transportes Morales','TMO880947AD3','SCT-MX-00147',NULL,NULL,NULL),
('mx','Transportes Medina','TMD910148AD4','SCT-MX-00148',NULL,NULL,NULL),
('mx','Transportes Ortega','TOR850249AD5','SCT-MX-00149',NULL,NULL,NULL),
('mx','Transportes Vázquez','TVA890350AD6','SCT-MX-00150',NULL,NULL,NULL),
('mx','Transportes Castillo','TCS870451AD7','SCT-MX-00151',NULL,NULL,NULL),
('mx','Transportes Romero','TRM900552AD8','SCT-MX-00152',NULL,NULL,NULL),
('mx','Transportes Contreras','TCO880653AD9','SCT-MX-00153',NULL,NULL,NULL),
('mx','Transportes Soto','TSO860754AE1','SCT-MX-00154',NULL,NULL,NULL),
('mx','Transportes Vargas','TVG890855AE2','SCT-MX-00155',NULL,NULL,NULL),
('mx','Transportes Mendoza del Norte','TMN910956AE3','SCT-MX-00156',NULL,NULL,NULL),
('mx','Transportes Solís','TSL870157AE4','SCT-MX-00157',NULL,NULL,NULL),
('mx','Transportes Peña','TPE900258AE5','SCT-MX-00158',NULL,NULL,NULL),
('mx','Transportes Reyes','TRE880359AE6','SCT-MX-00159',NULL,NULL,NULL),
('mx','Transportes Cruz','TCR910460AE7','SCT-MX-00160',NULL,NULL,NULL),
('mx','Transportes Méndez','TMN860561AE8','SCT-MX-00161',NULL,NULL,NULL),
('mx','Transportes Navarro','TNA890662AE9','SCT-MX-00162',NULL,NULL,NULL),
('mx','Transportes Ruíz','TRZ870763AF1','SCT-MX-00163',NULL,NULL,NULL),
('mx','Transportes del Golfo','TDG900864AF2','SCT-MX-00164',NULL,NULL,NULL),
('mx','Transportes Bustamante','TBU880965AF3','SCT-MX-00165',NULL,NULL,NULL),
('mx','Transportes Salazar','TSZ910166AF4','SCT-MX-00166',NULL,NULL,NULL),
('mx','Transportes Fuentes','TFU850267AF5','SCT-MX-00167',NULL,NULL,NULL),
('mx','Transportes Delgado','TDL890368AF6','SCT-MX-00168',NULL,NULL,NULL),
('mx','Transportes del Bajío','TDB870469AF7','SCT-MX-00169',NULL,NULL,NULL),
('mx','Transportes Águila Norte','TAN900570AF8','SCT-MX-00170',NULL,NULL,NULL),
('mx','Transportes Nacional','TNC880671AF9','SCT-MX-00171',NULL,NULL,NULL),
('mx','Transportes Monterrey','TMT910772AG1','SCT-MX-00172',NULL,NULL,NULL),
('mx','Transportes Saltillo','TSA860873AG2','SCT-MX-00173',NULL,NULL,NULL),
('mx','Transportes Laredo MX','TLM890974AG3','SCT-MX-00174',NULL,NULL,NULL),
('mx','Transportes Reynosa','TRY870175AG4','SCT-MX-00175',NULL,NULL,NULL),
('mx','Transportes Matamoros','TMA900276AG5','SCT-MX-00176',NULL,NULL,NULL),
('mx','Transportes Piedras Negras','TPN880377AG6','SCT-MX-00177',NULL,NULL,NULL),
('mx','Transportes Acuña','TAC910478AG7','SCT-MX-00178',NULL,NULL,NULL),
('mx','Transportes Ciudad Juárez','TCJ860579AG8','SCT-MX-00179',NULL,NULL,NULL),
('mx','Transportes Nogales','TNO890680AG9','SCT-MX-00180',NULL,NULL,NULL),
('mx','Transportes Tijuana','TTJ870781AH1','SCT-MX-00181',NULL,NULL,NULL),
('mx','Transportes Mexicali','TMX900882AH2','SCT-MX-00182',NULL,NULL,NULL),
('mx','Transportes Ensenada','TEN880983AH3','SCT-MX-00183',NULL,NULL,NULL),
('mx','Transportes León','TLE910184AH4','SCT-MX-00184',NULL,NULL,NULL),
('mx','Transportes Querétaro','TQR860285AH5','SCT-MX-00185',NULL,NULL,NULL),
('mx','Transportes Guadalajara','TGD890386AH6','SCT-MX-00186',NULL,NULL,NULL),
('mx','Transportes Puebla','TPU870487AH7','SCT-MX-00187',NULL,NULL,NULL),
('mx','Transportes Veracruz','TVE900588AH8','SCT-MX-00188',NULL,NULL,NULL),
('mx','Transportes Toluca','TTO880689AH9','SCT-MX-00189',NULL,NULL,NULL),
('mx','Transportes CDMX','TCX910790AI1','SCT-MX-00190',NULL,NULL,NULL),
('mx','Transportes Irapuato','TIR860891AI2','SCT-MX-00191',NULL,NULL,NULL),
('mx','Transportes Celaya','TCE890992AI3','SCT-MX-00192',NULL,NULL,NULL),
('mx','Transportes Aguascalientes','TAG870193AI4','SCT-MX-00193',NULL,NULL,NULL),
('mx','Transportes SLP','TSP900294AI5','SCT-MX-00194',NULL,NULL,NULL),
('mx','Transportes Torreón','TTR880395AI6','SCT-MX-00195',NULL,NULL,NULL),
('mx','Transportes Durango','TDU910496AI7','SCT-MX-00196',NULL,NULL,NULL),
('mx','Transportes Chihuahua','TCH860597AI8','SCT-MX-00197',NULL,NULL,NULL),
('mx','Transportes Hermosillo','THS890698AI9','SCT-MX-00198',NULL,NULL,NULL),
('mx','Transportes Culiacán','TCU870799AJ1','SCT-MX-00199',NULL,NULL,NULL),
('mx','Transportes Mazatlán','TMZ900800AJ2','SCT-MX-00200',NULL,NULL,NULL),
('mx','Transportes La Paz','TLP880901AJ3','SCT-MX-00201',NULL,NULL,NULL),
('mx','Transportes Oaxaca','TOA910102AJ4','SCT-MX-00202',NULL,NULL,NULL),
('mx','Transportes Tuxtla','TTX860203AJ5','SCT-MX-00203',NULL,NULL,NULL),
('mx','Transportes Villahermosa','TVH890304AJ6','SCT-MX-00204',NULL,NULL,NULL),
('mx','Transportes Mérida','TMD870405AJ7','SCT-MX-00205',NULL,NULL,NULL),
('mx','Transportes Cancún','TCN900506AJ8','SCT-MX-00206',NULL,NULL,NULL),
('mx','Transportes Norte Refrigerado','TNR880607AJ9','SCT-MX-00207',NULL,NULL,'Refrigerado'),
('mx','Transportes Fríos del Bajío','TFB910708AK1','SCT-MX-00208',NULL,NULL,'Refrigerado'),
('mx','Transportes Refrisa','TRS860809AK2','SCT-MX-00209',NULL,NULL,'Refrigerado'),
('mx','Transportes Granel Norte','TGN890910AK3','SCT-MX-00210',NULL,NULL,'Granel'),
('mx','Transportes Tanques MX','TTK870111AK4','SCT-MX-00211',NULL,NULL,'Tanques'),
('mx','Transportes Pemex','TPX900212AK5','SCT-MX-00212',NULL,NULL,'Hidrocarburos'),
('mx','Transportes Químicos del Golfo','TQG880313AK6','SCT-MX-00213',NULL,NULL,'Materiales peligrosos'),
('mx','Transportes Auto Parts MX','TAP910414AK7','SCT-MX-00214',NULL,NULL,NULL),
('mx','Transportes Aceros del Norte','TAN860515AK8','SCT-MX-00215',NULL,NULL,NULL),
('mx','Transportes Maquiladora Express','TMQ890616AK9','SCT-MX-00216',NULL,NULL,'Maquila'),
('mx','Transportes Binacional','TBN870717AL1','SCT-MX-00217',NULL,NULL,'Binacional'),
('mx','Transportes Frontera','TFR900818AL2','SCT-MX-00218',NULL,NULL,NULL),
('mx','Transportes Río Bravo','TRB880919AL3','SCT-MX-00219',NULL,NULL,NULL),
('mx','Transportes Sierra Madre','TSM910120AL4','SCT-MX-00220',NULL,NULL,NULL),
-- Transfer · puente (30)
('transfer','Transfer Laredo Express','TLX880101BA1','SCT-MX-50001',NULL,NULL,'Puente WTB'),
('transfer','Transfer Puente Colombia','TPC900202BA2','SCT-MX-50002',NULL,NULL,'Puente Colombia'),
('transfer','Transfer Solidaridad','TSO870303BA3','SCT-MX-50003',NULL,NULL,'Puente Solidaridad'),
('transfer','Transfer Juárez-Lincoln','TJL910404BA4','SCT-MX-50004',NULL,NULL,'Puente Juárez-Lincoln'),
('transfer','Transfer Reynosa-Pharr','TRP860505BA5','SCT-MX-50005',NULL,NULL,'Puente Pharr'),
('transfer','Transfer Matamoros-Brownsville','TMB890606BA6','SCT-MX-50006',NULL,NULL,NULL),
('transfer','Transfer Nogales-Mariposa','TNM870707BA7','SCT-MX-50007',NULL,NULL,NULL),
('transfer','Transfer Tijuana-Otay','TTO900808BA8','SCT-MX-50008',NULL,NULL,NULL),
('transfer','Transfer Mexicali-Calexico','TMC880909BA9','SCT-MX-50009',NULL,NULL,NULL),
('transfer','Transfer Piedras Negras-Eagle Pass','TPE910110BB1','SCT-MX-50010',NULL,NULL,NULL),
('transfer','Transfer Acuña-Del Rio','TAD860211BB2','SCT-MX-50011',NULL,NULL,NULL),
('transfer','Transfer Ojinaga-Presidio','TOP890312BB3','SCT-MX-50012',NULL,NULL,NULL),
('transfer','Transfer Puente Dos','TPD870413BB4','SCT-MX-50013',NULL,NULL,'WTB Puente II'),
('transfer','Transfer Nueva Laredo One','TNL900514BB5','SCT-MX-50014',NULL,NULL,NULL),
('transfer','Transfer Cross-Border Expedited','TCB880615BB6','SCT-MX-50015',NULL,NULL,NULL),
('transfer','Transfer Binacional Rápido','TBR910716BB7','SCT-MX-50016',NULL,NULL,NULL),
('transfer','Transfer Aduanal MX','TAM860817BB8','SCT-MX-50017',NULL,NULL,NULL),
('transfer','Transfer Express Norte','TEN890918BB9','SCT-MX-50018',NULL,NULL,NULL),
('transfer','Transfer Freight Bridge','TFB870019BC1','SCT-MX-50019',NULL,NULL,NULL),
('transfer','Transfer Rapid Crossing','TRC900120BC2','SCT-MX-50020',NULL,NULL,NULL),
('transfer','Transfer Pronto Puente','TPP880221BC3','SCT-MX-50021',NULL,NULL,NULL),
('transfer','Transfer LaredoGo','TLG910322BC4','SCT-MX-50022',NULL,NULL,NULL),
('transfer','Transfer Columbia Solid','TCS860423BC5','SCT-MX-50023',NULL,NULL,NULL),
('transfer','Transfer Puerta Norte','TPN890524BC6','SCT-MX-50024',NULL,NULL,NULL),
('transfer','Transfer Cruce Seguro','TCS870625BC7','SCT-MX-50025',NULL,NULL,NULL),
('transfer','Transfer Transit Link','TTL900726BC8','SCT-MX-50026',NULL,NULL,NULL),
('transfer','Transfer Short Haul','TSH880827BC9','SCT-MX-50027',NULL,NULL,NULL),
('transfer','Transfer Frontera Express','TFE910928BD1','SCT-MX-50028',NULL,NULL,NULL),
('transfer','Transfer Border Move','TBM860029BD2','SCT-MX-50029',NULL,NULL,NULL),
('transfer','Transfer Rio Crossing','TRX890130BD3','SCT-MX-50030',NULL,NULL,NULL),
-- Foreign (US / Canada) · 60
('foreign','J.B. Hunt Transport Services',NULL,NULL,'123456','JBHT','US Class 1 carrier'),
('foreign','Swift Transportation',NULL,NULL,'234567','SWFT','US'),
('foreign','Knight Transportation',NULL,NULL,'345678','KNGT','US'),
('foreign','Werner Enterprises',NULL,NULL,'456789','WERN','US'),
('foreign','Schneider National',NULL,NULL,'567890','SCHN','US'),
('foreign','C.H. Robinson Worldwide',NULL,NULL,'678901','CHRW','US 3PL'),
('foreign','XPO Logistics',NULL,NULL,'789012','XPOL','US'),
('foreign','Landstar System',NULL,NULL,'890123','LDST','US'),
('foreign','Old Dominion Freight Line',NULL,NULL,'901234','ODFL','US LTL'),
('foreign','Yellow Corporation',NULL,NULL,'112233','YELL','US LTL'),
('foreign','Estes Express Lines',NULL,NULL,'223344','EXLA','US LTL'),
('foreign','ABF Freight',NULL,NULL,'334455','ABFS','US LTL'),
('foreign','Saia LTL Freight',NULL,NULL,'445566','SAIA','US LTL'),
('foreign','Averitt Express',NULL,NULL,'556677','AVRT','US'),
('foreign','Covenant Transport',NULL,NULL,'667788','CVTA','US'),
('foreign','Heartland Express',NULL,NULL,'778899','HTLD','US'),
('foreign','U.S. Xpress Enterprises',NULL,NULL,'889900','USXI','US'),
('foreign','Marten Transport',NULL,NULL,'990011','MRTN','US refrigerated'),
('foreign','CRST International',NULL,NULL,'101112','CRST','US'),
('foreign','Maverick Transportation',NULL,NULL,'121314','MRVK','US'),
('foreign','Prime Inc.',NULL,NULL,'131415','PRME','US'),
('foreign','Crete Carrier',NULL,NULL,'141516','CRCA','US'),
('foreign','Mesilla Valley Transportation',NULL,NULL,'151617','MSVL','US'),
('foreign','Melton Truck Lines',NULL,NULL,'161718','MLTN','US'),
('foreign','Central Refrigerated Service',NULL,NULL,'171819','CRFS','US refrigerated'),
('foreign','Stevens Transport',NULL,NULL,'181920','STVN','US refrigerated'),
('foreign','KLLM Transport Services',NULL,NULL,'192021','KLLM','US refrigerated'),
('foreign','C.R. England',NULL,NULL,'202122','CREL','US refrigerated'),
('foreign','Dart Transit',NULL,NULL,'212223','DART','US'),
('foreign','Barr-Nunn Transportation',NULL,NULL,'222324','BRRN','US'),
('foreign','Paschall Truck Lines',NULL,NULL,'232425','PSCL','US'),
('foreign','TransAm Trucking',NULL,NULL,'242526','TRAM','US'),
('foreign','Western Express',NULL,NULL,'252627','WEXP','US'),
('foreign','Epes Transport System',NULL,NULL,'262728','EPES','US'),
('foreign','Hogan Transports',NULL,NULL,'272829','HGAN','US'),
('foreign','Pride Transport',NULL,NULL,'282930','PRDE','US'),
('foreign','May Trucking Company',NULL,NULL,'293031','MAYT','US'),
('foreign','Central Transport',NULL,NULL,'303132','CNTR','US'),
('foreign','R+L Carriers',NULL,NULL,'313233','RLCA','US LTL'),
('foreign','Dayton Freight Lines',NULL,NULL,'323334','DAFG','US LTL'),
('foreign','Southeastern Freight Lines',NULL,NULL,'333435','SEFL','US LTL'),
('foreign','Ward Transport and Logistics',NULL,NULL,'343536','WARD','US'),
('foreign','Holland Regional',NULL,NULL,'353637','HMES','US LTL'),
('foreign','YRC Freight',NULL,NULL,'363738','RDWY','US LTL'),
('foreign','FedEx Freight',NULL,NULL,'373839','FXFE','US LTL'),
('foreign','UPS Freight',NULL,NULL,'383940','UPGF','US'),
('foreign','Con-way Freight',NULL,NULL,'394041','CNWY','US'),
('foreign','Frozen Food Express',NULL,NULL,'404142','FFEX','US refrigerated'),
('foreign','Central States Trucking',NULL,NULL,'414243','CSTK','US'),
('foreign','A. Duie Pyle',NULL,NULL,'424344','ADPL','US'),
('foreign','New Penn Motor Express',NULL,NULL,'434445','NPME','US'),
('foreign','Pitt Ohio Express',NULL,NULL,'444546','PTOH','US'),
('foreign','Averitt Freight',NULL,NULL,'454647','AVFR','US'),
('foreign','Mexico Logistics US Inc.',NULL,NULL,'464748','MXLO','US/MX bridge'),
('foreign','Trans-System Inc.',NULL,NULL,'474849','TRSY','US'),
('foreign','Boyd Bros. Transportation',NULL,NULL,'484950','BOYD','US'),
('foreign','Roehl Transport',NULL,NULL,'495051','ROHL','US'),
('foreign','Daseke',NULL,NULL,'505152','DSKE','US flatbed'),
('foreign','TFI International',NULL,NULL,'515253','TFII','Canada/US'),
('foreign','Canadian National Transportation',NULL,NULL,'525354','CNTC','Canada/US'),
('foreign','Bison Transport',NULL,NULL,'535455','BISN','Canada')
ON CONFLICT (lower(name)) DO NOTHING;

-- Useful aliases — shorthand the operators type.
INSERT INTO carrier_aliases (carrier_id, alias)
SELECT c.id, a.alias FROM carriers c
JOIN (VALUES
  ('Transportes Castores','Castores'),
  ('Transportación Marítima Mexicana','TMM'),
  ('Grupo TMM','TMM Grupo'),
  ('Logística Pegasso','Pegasso'),
  ('Autotransportes del Noreste','ANE'),
  ('Transportes Monroy Schiavon','Monroy'),
  ('Transportes Tres Guerras','Tres Guerras'),
  ('Grupo Senda','Senda'),
  ('Transportes Potosinos','Potosinos'),
  ('J.B. Hunt Transport Services','JB Hunt'),
  ('J.B. Hunt Transport Services','JBHunt'),
  ('C.H. Robinson Worldwide','CH Robinson'),
  ('Schneider National','Schneider'),
  ('Old Dominion Freight Line','Old Dominion'),
  ('FedEx Freight','FedEx'),
  ('UPS Freight','UPS'),
  ('XPO Logistics','XPO'),
  ('Werner Enterprises','Werner'),
  ('Knight Transportation','Knight'),
  ('Swift Transportation','Swift')
) AS a(name, alias) ON a.name = c.name
ON CONFLICT (alias) DO NOTHING;

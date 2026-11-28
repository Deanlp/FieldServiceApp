-- Office-extendable pick-lists, so stats aren't spoiled by spelling variations.
CREATE TABLE picklist_item (
  list TEXT NOT NULL CHECK (list IN ('appliance_type', 'brand', 'fault_category')),
  value TEXT NOT NULL COLLATE NOCASE,
  position INTEGER NOT NULL,
  PRIMARY KEY (list, value)
);

INSERT INTO picklist_item (list, value, position) VALUES
  ('appliance_type', 'Oven', 1), ('appliance_type', 'Hob', 2), ('appliance_type', 'Cooker / range', 3),
  ('appliance_type', 'Extractor', 4), ('appliance_type', 'Fridge / freezer', 5), ('appliance_type', 'Dishwasher', 6),
  ('appliance_type', 'Washing machine', 7), ('appliance_type', 'Tumble dryer', 8), ('appliance_type', 'Washer-dryer', 9),
  ('appliance_type', 'Microwave', 10), ('appliance_type', 'Coffee machine', 11), ('appliance_type', 'Warming drawer', 12),
  ('appliance_type', 'Small appliance', 13),
  ('brand', 'SMEG', 1), ('brand', 'Bosch', 2), ('brand', 'Siemens', 3), ('brand', 'Miele', 4), ('brand', 'Defy', 5),
  ('brand', 'Samsung', 6), ('brand', 'LG', 7), ('brand', 'Whirlpool', 8), ('brand', 'Electrolux', 9), ('brand', 'Other', 10),
  ('fault_category', 'No power / electrical', 1), ('fault_category', 'Ignition', 2),
  ('fault_category', 'Thermocouple / flame failure', 3), ('fault_category', 'Gas blockage / leak', 4),
  ('fault_category', 'Not heating', 5), ('fault_category', 'Not cooling', 6), ('fault_category', 'Water leak', 7),
  ('fault_category', 'Drainage / pump', 8), ('fault_category', 'Door / seal / hinge', 9),
  ('fault_category', 'Noise / vibration', 10), ('fault_category', 'Control board / display', 11),
  ('fault_category', 'Installation', 12), ('fault_category', 'Customer misuse / damage', 13),
  ('fault_category', 'No fault found', 14);

-- One repair of one appliance for one Customer (GLOSSARY.md).
CREATE TABLE job (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES contact(id),
  payer_id TEXT NOT NULL REFERENCES contact(id),
  partner_id TEXT REFERENCES contact(id),
  service_line TEXT NOT NULL,
  service_suburb TEXT NOT NULL,
  lead_channel TEXT NOT NULL CHECK (lead_channel IN ('Partner', 'Website', 'Google', 'Repeat', 'Word of mouth', 'Other')),
  partner_reference TEXT,
  payer_reference TEXT,
  warranty INTEGER NOT NULL,
  appliance_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date TEXT,
  reported_fault TEXT NOT NULL,
  fault_category TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL REFERENCES app_user(id)
);
CREATE INDEX job_by_customer ON job (customer_id);
CREATE INDEX job_by_payer ON job (payer_id);
CREATE INDEX job_by_partner ON job (partner_id);
CREATE INDEX job_by_status ON job (status);

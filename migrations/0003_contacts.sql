-- People and organisations the business deals with. A Contact can be a
-- Customer, Payer or Partner on a Job (see GLOSSARY.md).
CREATE TABLE contact (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'organisation')),
  name TEXT NOT NULL,
  email TEXT,                              -- lower-case
  is_partner INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX contact_by_email ON contact (email);

CREATE TABLE contact_phone (
  contact_id TEXT NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  e164 TEXT NOT NULL,                      -- e.g. +27821234567
  national TEXT NOT NULL,                  -- e.g. 0821234567, for searching as typed
  PRIMARY KEY (contact_id, position)
);
CREATE INDEX contact_phone_by_e164 ON contact_phone (e164);

CREATE TABLE contact_address (
  contact_id TEXT NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  line TEXT NOT NULL,
  suburb TEXT NOT NULL,
  PRIMARY KEY (contact_id, position)
);

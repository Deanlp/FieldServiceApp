-- App-wide settings (key/value). Later tickets add base address, claim rates, etc.
CREATE TABLE app_setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_setting (key, value) VALUES ('app_name', 'Happy Home Field Service');

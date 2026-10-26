import { TEST_ENV } from '../../playwright.config';

// Muss vor lib/db geladen werden: Die Datenbank-Verbindung liest DATABASE_URL beim Import. Nur die Testdatenbank.
process.env.DATABASE_URL = TEST_ENV.DATABASE_URL;
process.env.SESSION_SECRET = TEST_ENV.SESSION_SECRET;

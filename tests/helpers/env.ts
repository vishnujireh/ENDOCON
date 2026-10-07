// Test environment – must load before any app module reads config.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'endocon_test';
process.env.PAYMENT_GATEWAY = 'fake';
process.env.EMAIL_TRANSPORT = 'console';
process.env.RUN_JOBS = 'false';
process.env.ADMIN_NOTIFICATION_EMAILS = 'team@endocon.test';
process.env.STORAGE_LOCAL_DIR = './storage-test';
process.env.ABSTRACT_SUBMISSION_OPENS = '2026-01-01T00:00:00+05:30';
process.env.ABSTRACT_SUBMISSION_CLOSES = '2027-12-31T23:59:59+05:30';
delete process.env.PRICING_NOW_OVERRIDE;

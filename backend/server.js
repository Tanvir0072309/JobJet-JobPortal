const app = require('./app');
const env = require('./src/config/env');
const db = require('./src/config/db');

const PORT = env.port;

app.listen(PORT, async () => {
  console.log(`JobJet backend running on http://localhost:${PORT}`);
  const dbOk = await db.checkConnection();
  if (dbOk) {
    console.log('Postgres connection OK.');
  } else {
    console.warn('Could not connect to Postgres. Check DATABASE_URL in backend/.env and that Postgres is running.');
  }
});

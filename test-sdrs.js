import jwt from 'jsonwebtoken';
import http from 'http';

const token = jwt.sign(
  {
    userId: 'd5e60535-9ebf-4d1d-b49b-059487fb3b55',
    tenantId: '143b52a8-05a1-457f-9bf0-3cc83c914f69',
    role: 'SUPERADMIN'
  },
  'vendai-secret-key-2026'
);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/sdrs',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});

req.on('error', error => console.error(error));
req.end();

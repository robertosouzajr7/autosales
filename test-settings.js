import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/settings',
  method: 'GET',
  headers: {
    'x-tenant-id': '143b52a8-05a1-457f-9bf0-3cc83c914f69'
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});

req.on('error', error => console.error(error));
req.end();

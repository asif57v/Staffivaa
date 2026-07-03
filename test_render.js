const token = "c9Du0W9gweKc_hGUBZ1j-Q:APA91bFMaymii7l8bPUgbl82R6ZWCfV4wzDo3dGTP-0HTVNT36D-A2FnuOJq_8nCf8zPD9_3ZRjQxRqZGdurSRB24NYOb7sbKkI4z4wY3xRhpTKkEby0yYQ";
fetch('https://staffivaa-backend.onrender.com/api/v1/notifications/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ token })
}).then(res => res.json()).then(console.log).catch(console.error);

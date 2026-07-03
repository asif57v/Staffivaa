const token = "fnUNLfiwFLNpWkjr1ImR0F:APA91bGqQrPyrKWLkvEpIzCjnPVxOWWKs3d8sRpWNvj0Z0fWSPOMSvLALJnTVcJPk0zuH8QsuRgOCin18p2kd1SOa2hGPJY1uULNqNFcE4XxrzoysEF-_1";
fetch('http://localhost:5000/api/v1/notifications/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ token })
}).then(res => res.json()).then(console.log).catch(console.error);

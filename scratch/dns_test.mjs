import dns from 'dns';
dns.setServers(['8.8.8.8']);
dns.resolveSrv('_mongodb._tcp.cluster0.dkrivan.mongodb.net', (err, addresses) => {
  if (err) {
    console.error('DNS Resolve SRV Error:', err);
  } else {
    console.log('DNS Resolve SRV Success:', addresses);
  }
});

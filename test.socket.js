const { io } = require('socket.io-client')

const socket = io('http://localhost:3010'); // URL ของเซิร์ฟเวอร์

socket.on('create-ticket', (data) => {
  console.log('Ticket created:', data);
});

socket.on('get-ticket', (data) => {
  console.log('Ticket get:', data);
});

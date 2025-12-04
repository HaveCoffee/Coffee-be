const io = require('socket.io-client');

console.log('🚀 Starting socket client test...');
console.log('📡 Connecting to: http://localhost:3001');

const socket = io('http://localhost:3001', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4ZTRkZTJlMzZhNjY3ZDhmNDM1YTFhNDRmODJjNjY0YiIsIm1vYmlsZU51bWJlciI6Iis5MTcwMDczMTM3MjUiLCJpYXQiOjE3NjQ4ODE5NzUsImV4cCI6MTc2NDg4NTU3NX0.rZTQfp8IMw5E3jMOfLDlBKInwwUhX5zbTdR8-i8Gz1Y'
      },
  transports: ['websocket', 'polling'],
  reconnection: true
});

socket.on('connect', () => {
  console.log('✅ Connected to chat server');
  console.log('🔌 Socket ID:', socket.id);
  
  // Send a message
  console.log('📤 Sending message to receiverId: f553efeb7bf2319a58c2b0e6eff428b0');
  socket.emit('send_message', {
    receiverId: 'f553efeb7bf2319a58c2b0e6eff428b0',
    content: 'Testing 3'
  }, (response) => {
    console.log('📤 Send response:', response);
  });
});

socket.on('new_message', (message) => {
  console.log('📨 New message received:', message);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected. Reason:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('❌ Error details:', error);
  if (error.data) {
    console.error('❌ Error data:', error.data);
  }
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Keep the process alive
setTimeout(() => {
  console.log('⏰ Test completed. Closing connection...');
  socket.disconnect();
  process.exit(0);
}, 10000); // Run for 10 seconds

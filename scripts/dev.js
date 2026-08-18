import { spawn } from 'child_process';

console.log('🚀 Launching Charge Hub local environment (Backend + Frontend)...');

const backend = spawn('node', ['backend/server.js'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

const frontend = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

const handleExit = () => {
  backend.kill();
  frontend.kill();
  process.exit();
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

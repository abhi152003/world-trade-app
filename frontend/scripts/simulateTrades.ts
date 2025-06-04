import { runTradeSimulation } from '../app/utils/tradeSimulator';
// Using Node's built-in process.env instead of dotenv
// since we're using tsx which supports loading .env files automatically

// Check for environment variables
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  console.error('PRIVATE_KEY environment variable is required');
  process.exit(1);
}

console.log('Starting trade simulation script...');

// Variable to store the cleanup function
let stopSimulationFn: (() => void) | undefined;

// Run the simulation and store the cleanup function when it resolves
runTradeSimulation(privateKey)
  .then((stopFn) => {
    stopSimulationFn = stopFn;
  })
  .catch((err) => {
    console.error('Error starting simulation:', err);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Stopping trade simulation...');
  if (stopSimulationFn) {
    stopSimulationFn();
  }
  process.exit(0);
});

console.log('Press Ctrl+C to stop the simulation'); 
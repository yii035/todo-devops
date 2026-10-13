import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';

const startServer = async () => {
  await mongoose.connect(env.mongoUri);
  console.log('MongoDB connected successfully.');

  const server = app.listen(env.port, () => {
    console.log(`FinTrack server is running on port ${env.port}`);
  });

  server.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use. Stop the existing server or configure a different PORT in server/.env.`);
    } else {
      console.error(`Unable to start the API server: ${error.message}`);
    }

    mongoose.disconnect().then(
      () => { process.exitCode = 1; },
      (disconnectError: unknown) => {
        console.error('Unable to disconnect from MongoDB after the server failed to start.', disconnectError);
        process.exitCode = 1;
      },
    );
  });
};

startServer().catch((error: unknown) => {
  const reason = error instanceof Error ? error.name : 'Unknown error';
  console.error(`Unable to connect to MongoDB (${reason}); server was not started.`);
  process.exitCode = 1;
});

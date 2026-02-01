import { MaveoClient, MaveoStatus, DoorState } from '../src';

// Configuration - set via environment variables or replace placeholders
const config = {
  username: process.env.MAVEO_USERNAME || 'user@email.com',
  password: process.env.MAVEO_PASSWORD || 'yourpassword',
  deviceId: process.env.MAVEO_DEVICE_ID || 'your-maveo-stick-id',
};

async function main() {
  console.log('Creating Maveo client...');
  const client = new MaveoClient(config);

  // Track when door is fully open
  let doorOpen = false;

  client.on('status', (status: MaveoStatus) => {
    console.log('Status:', MaveoClient.getDoorStateString(status.doorState));
    if (status.isOpen) {
      doorOpen = true;
    }
  });

  client.on('error', (error: Error) => {
    console.error('Error:', error.message);
  });

  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected!\n');

    const status = client.getCurrentStatus();

    if (status?.isOpen) {
      console.log('Door is already open.');
    } else {
      console.log('Opening garage door...');
      client.open();

      // Wait until door is fully open (max 30 seconds)
      const startTime = Date.now();
      while (!doorOpen && Date.now() - startTime < 30000) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (doorOpen) {
        console.log('\nDoor is now fully open!');
      } else {
        console.log('\nTimeout waiting for door to open.');
      }
    }

    await client.disconnect();
    console.log('Done.');

  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
}

main();

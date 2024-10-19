// import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({

	test: {
    // Default test settings for local function testing
    environment: 'node',  // Use 'node' environment for local functions
    globals: true,        // Use global variables in tests if needed
    // setupFiles: ['./test/setup.ts'], // Optional: setup files to run before tests
  },
	
});

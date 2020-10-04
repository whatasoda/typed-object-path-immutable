const concurrently = require('concurrently');

concurrently(['npm run tsc:cjs', 'npm run tsc:esm']);

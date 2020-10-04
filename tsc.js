const concurrently = require('concurrently');

let tailing = '';
if (process.env.NO_EMIT === '1') {
  tailing += '--noEmit'
}

if (tailing) {
  tailing = ' -- ' + tailing;
}

concurrently(['npm run tsc:cjs' + tailing, 'npm run tsc:esm' + tailing])
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

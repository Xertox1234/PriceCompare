// Temporary script to check for type issues
import { exec } from 'child_process';

console.log('Running TypeScript type check...');
exec('npx tsc --noEmit --pretty', (error, stdout, stderr) => {
  if (error) {
    console.log('Type errors found:');
    console.log(stdout);
    console.log(stderr);
  } else {
    console.log('No type errors found!');
  }
});
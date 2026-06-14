import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const targetPath = path.join(
  process.cwd(),
  'node_modules',
  'react-native-sqlite-storage',
  'platforms',
  'android',
  'build.gradle',
);

if (!existsSync(targetPath)) {
  process.exit(0);
}

const source = readFileSync(targetPath, 'utf8');
const patched = source.replace(/\bjcenter\(\)/g, 'mavenCentral()');

if (patched !== source) {
  writeFileSync(targetPath, patched, 'utf8');
  process.stdout.write('Patched react-native-sqlite-storage Android Gradle repositories.\n');
}

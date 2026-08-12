import { spawnSync } from 'child_process';

console.log("🚀 Starting Casino Bot...");

console.log("⚙️ Generating Prisma Client...");
spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', shell: true });

console.log("💻 Launching bot...");
spawnSync('npx', ['tsx', 'src/index.ts'], { stdio: 'inherit', shell: true });

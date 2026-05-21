import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

const schemaPath = path.join(rootDir, "prisma", "schema.prisma");
const envPath = path.join(rootDir, ".env");

const dbType = process.argv[2];

if (dbType !== "sqlite" && dbType !== "postgresql" && dbType !== "postgres") {
  console.error("Usage: node switch-db.js [sqlite|postgresql]");
  process.exit(1);
}

const targetProvider = dbType === "sqlite" ? "sqlite" : "postgresql";

// 1. Update schema.prisma
try {
  let schema = fs.readFileSync(schemaPath, "utf8");
  
  // Replace provider = "sqlite" or provider = "postgresql"
  const updatedSchema = schema.replace(
    /provider\s*=\s*"[^"]*"\s*\n\s*url\s*=\s*env\("DATABASE_URL"\)/,
    `provider = "${targetProvider}"\n  url      = env("DATABASE_URL")`
  );
  
  fs.writeFileSync(schemaPath, updatedSchema, "utf8");
  console.log(`✅ Prisma schema datasource provider switched to: "${targetProvider}"`);
} catch (error) {
  console.error("❌ Failed to update schema.prisma:", error.message);
  process.exit(1);
}

// 2. Update .env file (if exists, update DATABASE_URL commented lines)
try {
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    
    if (targetProvider === "sqlite") {
      // Uncomment sqlite URL, comment out postgres URL
      envContent = envContent.replace(
        /^#?\s*(DATABASE_URL\s*=\s*"file:[\s\S]*?")/m,
        `DATABASE_URL="file:./dev.db"`
      );
      envContent = envContent.replace(
        /^(DATABASE_URL\s*=\s*"postgres:[\s\S]*?")/m,
        `# DATABASE_URL="postgres://autosales:Rr756213Rr@localhost:5432/autosales?sslmode=disable"`
      );
    } else {
      // Comment out sqlite URL, uncomment postgres URL
      envContent = envContent.replace(
        /^(DATABASE_URL\s*=\s*"file:[\s\S]*?")/m,
        `# DATABASE_URL="file:./dev.db"`
      );
      
      // Look for the postgres URL line (local or production)
      if (envContent.includes("postgres://autosales:Rr756213Rr@localhost:5432")) {
        envContent = envContent.replace(
          /^#?\s*(DATABASE_URL\s*=\s*"postgres:\/\/autosales:Rr756213Rr@localhost:5432[\s\S]*?")/m,
          `DATABASE_URL="postgres://autosales:Rr756213Rr@localhost:5432/autosales?sslmode=disable"`
        );
      } else {
        envContent = envContent.replace(
          /^#?\s*(DATABASE_URL\s*=\s*"postgres:[\s\S]*?")/m,
          `DATABASE_URL="postgres://autosales:Rr756213Rr@localhost:5432/autosales?sslmode=disable"`
        );
      }
    }
    
    fs.writeFileSync(envPath, envContent, "utf8");
    console.log(`✅ Environment file (.env) DATABASE_URL updated for local: "${targetProvider}"`);
  }
} catch (error) {
  console.error("⚠️ Could not update .env file:", error.message);
}

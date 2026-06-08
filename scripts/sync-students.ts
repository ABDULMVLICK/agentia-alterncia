/**
 * CLI : npx tsx scripts/sync-students.ts
 * Sync students from Firestore into the local SQLite cache.
 */
import "dotenv/config";
import { syncStudents } from "../lib/students-cache";

(async () => {
  console.log("Syncing students from Firestore…");
  const r = await syncStudents();
  console.log(`✓ ${r.count} students synced`);
})();

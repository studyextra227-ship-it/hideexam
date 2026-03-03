// ─── Abyss Vault File Manager ────────────────────────────────────────────────
// Usage:
//   node delete-vault-files.mjs <PIN>           → list all files
//   node delete-vault-files.mjs <PIN> --all     → delete ALL files
//   node delete-vault-files.mjs <PIN> --file 1  → delete file #1 from the list
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://qhiaxfwpcoqptfhhpjgs.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoaWF4ZndwY29xcHRmaGhwamdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTczNjIsImV4cCI6MjA4ODAzMzM2Mn0.WaOy2ht_0LzmDDNVR_k-szFc6Z5E9s83C1WOyLOpISg";

const headers = {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${ANON_KEY}`,
};

async function invoke(name, body) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
        method: "POST", headers, body: JSON.stringify(body),
    });
    return res.json();
}

const [, , pin, action, fileNum] = process.argv;

if (!pin) {
    console.log("Usage:");
    console.log("  node delete-vault-files.mjs <PIN>           → list files");
    console.log("  node delete-vault-files.mjs <PIN> --all     → delete ALL");
    console.log("  node delete-vault-files.mjs <PIN> --file 1  → delete file #1");
    process.exit(0);
}

console.log("\n╔════════════════════════════════╗");
console.log("║    Abyss Vault File Manager    ║");
console.log("╚════════════════════════════════╝\n");

console.log("Fetching files...");
const data = await invoke("vault-files", { pin });

if (data.error) {
    console.log("❌ Error:", data.error, "(wrong PIN?)");
    process.exit(1);
}

const files = data.files ?? [];

if (!files.length) {
    console.log("✅ Vault is empty — no files to delete.");
    process.exit(0);
}

console.log(`\nFound ${files.length} file(s):\n`);
files.forEach((f, i) => {
    const name = f.name.replace(/^\d+-/, "");
    const sizeMB = (f.size / 1024 / 1024).toFixed(2);
    console.log(`  [${i + 1}] ${name}  (${sizeMB} MB)`);
});

// ── List only ────────────────────────────────────────────────────────────────
if (!action) {
    console.log("\nTo delete, run:");
    console.log("  node abyss-vault-keeper-main\\delete-vault-files.mjs " + pin + " --all        (delete everything)");
    console.log("  node abyss-vault-keeper-main\\delete-vault-files.mjs " + pin + " --file 1     (delete file #1)");
    process.exit(0);
}

// ── Delete all ───────────────────────────────────────────────────────────────
if (action === "--all") {
    console.log("\nDeleting all files...\n");
    for (const f of files) {
        const name = f.name.replace(/^\d+-/, "");
        process.stdout.write(`  Deleting "${name}"... `);
        const result = await invoke("vault-delete", { pin, fileName: f.name });
        console.log(result.success ? "✓" : `✗ ${result.error}`);
    }
    console.log("\n✅ Done!");
    process.exit(0);
}

// ── Delete single ────────────────────────────────────────────────────────────
if (action === "--file") {
    const idx = parseInt(fileNum) - 1;
    if (isNaN(idx) || idx < 0 || idx >= files.length) {
        console.log(`❌ Invalid file number. Pick 1–${files.length}`);
        process.exit(1);
    }
    const file = files[idx];
    const name = file.name.replace(/^\d+-/, "");
    process.stdout.write(`\nDeleting "${name}"... `);
    const result = await invoke("vault-delete", { pin, fileName: file.name });
    console.log(result.success ? "✓ Deleted!" : `✗ Failed: ${result.error}`);
    process.exit(0);
}

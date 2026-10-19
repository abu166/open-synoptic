import fs from "node:fs";
const messages = {};
for (const [index, line] of fs.readFileSync("src/i18n/catalog.tsv", "utf8").split("\n").entries()) {
  if (!line.trim()) continue;
  const [key, kk, ru, extra] = line.split("|");
  if (!key || !kk || !ru || extra) throw new Error(`Invalid catalog row ${index + 1}`);
  if (Object.hasOwn(messages, key)) throw new Error(`Duplicate catalog key at row ${index + 1}: ${key}`);
  messages[key] = [kk, ru];
}
fs.writeFileSync("src/i18n/messages.ts", `// Generated from catalog.tsv by npm run i18n:build.\nexport const catalog: Record<string, [string, string]> = ${JSON.stringify(messages, null, 2)};\n`);
console.log(`${Object.keys(messages).length} complete bilingual translations`);

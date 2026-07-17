import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync as exec } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

console.log("🚀 Starting ResearchFlow package validation...");

const jsonFiles = [
  "workflows/n8n_workflow_research_production.json",
  "workflows/n8n_workflow_ideas_whatsapp.json",
  "workflows/n8n_workflow_weekly_digest.json",
  "workflows/n8n_workflow_demo_import.json",
  "landing_page/vercel.json",
  "test_data/sample_request.json",
  "test_data/sample_request_solo_tema.json",
  "test_data/sample_demo_response.json"
];

// 1. Check all JSON files syntax
for (const file of jsonFiles) {
  const filePath = path.join(root, file);
  try {
    const content = fs.readFileSync(filePath, "utf8");
    JSON.parse(content);
    console.log(`✅ JSON OK: ${file}`);
  } catch (error) {
    console.error(`❌ Error parsing JSON file ${file}:`, error.message);
    process.exit(1);
  }
}

// 2. Validate JavaScript syntax in landing_page
try {
  exec(`node --check "${path.join(root, "landing_page/script.js")}"`);
  console.log("✅ JS OK: landing_page/script.js");
} catch (error) {
  console.error("❌ JS Syntax check failed for landing_page/script.js:", error.message);
  process.exit(1);
}

// 3. Deep validate workflows (connections and JS nodes)
const workflowFiles = [
  "workflows/n8n_workflow_research_production.json",
  "workflows/n8n_workflow_ideas_whatsapp.json",
  "workflows/n8n_workflow_weekly_digest.json",
  "workflows/n8n_workflow_demo_import.json"
];

for (const file of workflowFiles) {
  const filePath = path.join(root, file);
  try {
    const wf = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const names = new Set((wf.nodes || []).map(n => n.name));

    // Check connections point to existing nodes
    for (const [src, types] of Object.entries(wf.connections || {})) {
      if (!names.has(src)) {
        throw new Error(`Conexión desde nodo inexistente: "${src}"`);
      }
      for (const groups of Object.values(types || {})) {
        for (const g of groups || []) {
          for (const c of g || []) {
            if (!names.has(c.node)) {
              throw new Error(`Conexión hacia nodo inexistente: "${c.node}"`);
            }
          }
        }
      }
    }

    // Check inline Javascript code syntax
    for (const node of wf.nodes || []) {
      if (node.parameters && node.parameters.jsCode) {
        try {
          new Function(node.parameters.jsCode);
        } catch (jsError) {
          throw new Error(`Error de sintaxis JS en el nodo Code "${node.name}": ${jsError.message}`);
        }
      }
    }

    console.log(`✅ n8n OK (Nodos Code + conexiones): ${file}`);
  } catch (error) {
    console.error(`❌ Workflow validation failed for ${file}:`, error.message);
    process.exit(1);
  }
}

console.log("\n✨ ResearchFlow package validation completed successfully!");

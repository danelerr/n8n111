$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$jsonFiles = @(
  "n8n_workflow_research_production.json",
  "n8n_workflow_ideas_whatsapp.json",
  "n8n_workflow_weekly_digest.json",
  "n8n_workflow_demo_import.json",
  "workflow_blueprint.json",
  "landing_page/vercel.json",
  "test_data/sample_request.json",
  "test_data/sample_request_solo_tema.json",
  "test_data/sample_demo_response.json"
)

foreach ($file in $jsonFiles) {
  $path = Join-Path $root $file
  Get-Content -Raw -LiteralPath $path | ConvertFrom-Json | Out-Null
  Write-Host "JSON OK: $file"
}

node --check (Join-Path $root "landing_page/script.js")
Write-Host "JS OK: landing_page/script.js"

$workflowFiles = @(
  "n8n_workflow_research_production.json",
  "n8n_workflow_ideas_whatsapp.json",
  "n8n_workflow_weekly_digest.json",
  "n8n_workflow_demo_import.json"
)

node -e "const fs=require('fs'); for (const file of process.argv.slice(1)) { const wf=JSON.parse(fs.readFileSync(file,'utf8')); const names=new Set(wf.nodes.map(n=>n.name)); for (const [src, types] of Object.entries(wf.connections)) { if (!names.has(src)) throw new Error(file+': conexion desde nodo inexistente '+src); for (const groups of Object.values(types)) for (const g of groups) for (const c of g) if (!names.has(c.node)) throw new Error(file+': conexion hacia nodo inexistente '+c.node); } for (const n of wf.nodes || []) { if (n.parameters && n.parameters.jsCode) new Function(n.parameters.jsCode); } console.log('n8n OK (Code nodes + conexiones): ' + file); }" @($workflowFiles | ForEach-Object { Join-Path $root $_ })

Write-Host "ResearchFlow package validation completed."

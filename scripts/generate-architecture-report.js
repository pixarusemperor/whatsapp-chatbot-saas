const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const repoName = 'whatsapp-chatbot-saas';
const timestamp = Date.now();
const tmpDir = os.tmpdir();
const reportFilename = `architecture-review-${timestamp}.html`;
const reportPath = path.join(tmpDir, reportFilename);

const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture Review — ${repoName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans antialiased">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      
      <!-- Header -->
      <header class="border-b border-slate-200 pb-8">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-serif font-semibold tracking-tight text-slate-900">Codebase Architecture Review</h1>
          <span class="text-sm font-mono text-slate-500">${new Date().toISOString().split('T')[0]}</span>
        </div>
        <p class="mt-2 text-slate-600">Unified review of terminology covering merged namespaces and structural design.</p>
        
        <!-- Legend -->
        <div class="mt-6 flex flex-wrap gap-6 items-center text-xs font-mono uppercase tracking-wider text-slate-500 bg-white p-4 rounded-lg border border-slate-200">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 bg-slate-100 border border-slate-300 rounded"></div>
            <span>Module</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 deep rounded"></div>
            <span>Deep Module</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-8 border-t-2 border-slate-400 border-dashed"></div>
            <span>Seam</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-8 border-t-2 border-red-500"></div>
            <span class="text-red-600">Leakage</span>
          </div>
        </div>
      </header>

      <!-- Candidates -->
      <section id="candidates" class="space-y-12">
        <h2 class="text-2xl font-serif font-semibold text-slate-800">Deepening Candidates</h2>
        
        <!-- Candidate 1 -->
        <article class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <h3 class="text-xl font-semibold text-slate-900">Consolidate Redundant WhatsApp Client Wrappers</h3>
            <div class="flex gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Strong</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">ports & adapters</span>
            </div>
          </div>
          
          <div class="font-mono text-xs text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-100">
            src/lib/wasender.ts<br>
            src/lib/watssender.ts<br>
            src/lib/providers/watssender-provider.ts
          </div>

          <!-- Before / After diagrams -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Before: Shallow Redundant Wrappers</h4>
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 h-[320px] flex flex-col justify-between">
                <pre class="mermaid">
                  flowchart TD
                    classDef default fill:#f8fafc,stroke:#cbd5e1,stroke-width:1px;
                    classDef leak stroke:#dc2626,stroke-width:2px;
                    
                    Engine[CampaignEngine] -->|calls| WS1[wasender.ts]
                    Webhook[Webhook Route] -.leak.-> WS2[watssender.ts]
                    Chatbot[Chatbot Service] -->|calls| P[WhatsAppProvider]
                    P -->|adapter| WS3[WatsSenderProvider]
                    
                    class Webhook leak
                </pre>
                <div class="text-[10px] text-slate-400 text-center font-mono">Bypassed seams and duplicated logic</div>
              </div>
            </div>
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">After: Unified Deep Module</h4>
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 h-[320px] flex flex-col justify-between">
                <pre class="mermaid">
                  flowchart TD
                    classDef default fill:#f8fafc,stroke:#cbd5e1,stroke-width:1px;
                    classDef deep fill:#0f172a,stroke:#1e293b,stroke-width:2px,color:#fff;
                    
                    Engine[CampaignEngine] -->|uses| WC[WhatsAppClient]
                    Webhook[Webhook Route] -->|uses| WC
                    Chatbot[Chatbot Service] -->|uses| WC
                    
                    class WC deep
                </pre>
                <div class="text-[10px] text-slate-400 text-center font-mono">Behavior consolidated behind a single interface</div>
              </div>
            </div>
          </div>

          <div class="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Problem</h4>
              <p class="text-sm text-slate-700">Duplicated wrapper files make calls shallow and bypass the abstract provider seam, spreading endpoint configurations across callers.</p>
            </div>
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Solution</h4>
              <p class="text-sm text-slate-700">Consolidate all WatsSender operations into a single deep client, collapsing the unused hypothetical interface seam.</p>
            </div>
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Wins</h4>
              <ul class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700 list-disc list-inside">
                <li>Locality: API calls concentrate in one module</li>
                <li>Delete: 2 shallow wrapper files</li>
                <li>Seam: Prune bypassed hypothetical interface</li>
                <li>Leverage: Unified configuration for all call sites</li>
              </ul>
            </div>
          </div>
        </article>

        <!-- Candidate 2 -->
        <article class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <h3 class="text-xl font-semibold text-slate-900">Deepen the Campaign Scheduler</h3>
            <div class="flex gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Worth exploring</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">in-process</span>
            </div>
          </div>
          
          <div class="font-mono text-xs text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-100">
            src/lib/campaign-scheduler.ts<br>
            src/app/api/campaigns/route.ts<br>
            src/app/api/campaigns/[id]/control/route.ts
          </div>

          <!-- Before / After diagrams -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Before: Shallow Stateless Calculations</h4>
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 h-[320px] flex flex-col justify-between">
                <pre class="mermaid">
                  flowchart TD
                    classDef default fill:#f8fafc,stroke:#cbd5e1,stroke-width:1px;
                    classDef leak stroke:#dc2626,stroke-width:2px;
                    
                    Route[API Campaign Route] -->|fetches| DB[(Database)]
                    Route -->|passes arrays| CS[campaign-scheduler.ts]
                    CS -->|returns event array| Route
                    Route -.leak.->|inserts| DB
                    
                    class Route leak
                </pre>
                <div class="text-[10px] text-slate-400 text-center font-mono">API routes orchestrate DB loading and mapping</div>
              </div>
            </div>
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">After: Deep Domain-Aware Scheduler</h4>
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 h-[320px] flex flex-col justify-between">
                <pre class="mermaid">
                  flowchart TD
                    classDef default fill:#f8fafc,stroke:#cbd5e1,stroke-width:1px;
                    classDef deep fill:#0f172a,stroke:#1e293b,stroke-width:2px,color:#fff;
                    
                    Route[API Campaign Route] -->|sends ID| CS[CampaignScheduler]
                    subgraph CS [CampaignScheduler]
                      direction TB
                      M[Scheduler logic] -->|queries & writes| DB[(Database)]
                    end
                    
                    class CS deep
                </pre>
                <div class="text-[10px] text-slate-400 text-center font-mono font-sans text-slate-400">Stateless logic and DB operations unified</div>
              </div>
            </div>
          </div>

          <div class="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Problem</h4>
              <p class="text-sm text-slate-700">The scheduler helper is stateless and shallow, forcing API routes to manage data retrieval, array-shuffling, and database insertion orchestration.</p>
            </div>
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Solution</h4>
              <p class="text-sm text-slate-700">Deepen the scheduler module to accept a Campaign ID, loading the domain data internally and managing database state changes.</p>
            </div>
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Wins</h4>
              <ul class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700 list-disc list-inside">
                <li>Leverage: Simple API interfaces (single ID)</li>
                <li>Locality: Scheduling constraints contained in one module</li>
                <li>Testability: Seam acts as complete test surface</li>
                <li>Complexity: Reduced boilerplate in API endpoints</li>
              </ul>
            </div>
          </div>
        </article>

        <!-- Candidate 3 -->
        <article class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <h3 class="text-xl font-semibold text-slate-900">Unify Webhook Logging and Pipeline Routing</h3>
            <div class="flex gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Strong</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">in-process</span>
            </div>
          </div>
          
          <div class="font-mono text-xs text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-100">
            src/app/api/webhooks/whatsapp/[tenant_id]/[session_id]/route.ts<br>
            src/services/chatbot.ts
          </div>

          <!-- Before / After diagrams -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Before: Leaky Webhook Seam</h4>
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 h-[320px] flex flex-col justify-between">
                <pre class="mermaid">
                  flowchart TD
                    classDef default fill:#f8fafc,stroke:#cbd5e1,stroke-width:1px;
                    classDef leak stroke:#dc2626,stroke-width:2px;
                    
                    Route[Webhook Route] -->|logs msg & upserts chat| DB[(Database)]
                    Route -.leak.->|sends logged message| CB[chatbot.ts]
                    CB -->|logs reply & updates status| DB
                    
                    class Route,CB leak
                </pre>
                <div class="text-[10px] text-slate-400 text-center font-mono">Both webhook route and chatbot logic execute DB inserts</div>
              </div>
            </div>
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">After: Unified Webhook Pipeline</h4>
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 h-[320px] flex flex-col justify-between">
                <pre class="mermaid">
                  flowchart TD
                    classDef default fill:#f8fafc,stroke:#cbd5e1,stroke-width:1px;
                    classDef deep fill:#0f172a,stroke:#1e293b,stroke-width:2px,color:#fff;
                    
                    Route[Webhook Route] -->|passes payload| PL[WebhookPipeline]
                    subgraph PL [WebhookPipeline]
                      direction TB
                      L[Logging & Decryption] --> W[Workflow Trigger]
                      W --> LLM[LLM Response]
                      LLM --> S[Send & Log Reply]
                    end
                    PL --> DB[(Database)]
                    
                    class PL deep
                </pre>
                <div class="text-[10px] text-slate-400 text-center font-mono font-sans text-slate-400 font-semibold">Boilerplate webhook route separated from pipeline logic</div>
              </div>
            </div>
          </div>

          <div class="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Problem</h4>
              <p class="text-sm text-slate-700">The webhook route leaks database inserts, media calculations, and chat thread updates across its seam into the chatbot pipeline.</p>
            </div>
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Solution</h4>
              <p class="text-sm text-slate-700">Extract a deep WebhookPipeline module that absorbs all logging, threat detection, and message routing logic.</p>
            </div>
            <div>
              <h4 class="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Wins</h4>
              <ul class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700 list-disc list-inside">
                <li>Deletion test: Webhook route becomes simple pass-through</li>
                <li>Locality: Message logging and triggers concentrate together</li>
                <li>Leverage: Clean seam for webhook simulations</li>
                <li>Security: Isolated signature and auth validations</li>
              </ul>
            </div>
          </div>
        </article>
      </section>

      <!-- Top Recommendation -->
      <section id="top-recommendation" class="bg-slate-900 text-white rounded-xl p-8 space-y-4">
        <div class="flex items-center gap-3">
          <span class="bg-emerald-500 text-slate-900 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Top Recommendation</span>
          <h2 class="text-2xl font-serif font-semibold">Consolidate Redundant WhatsApp Client Wrappers</h2>
        </div>
        <p class="text-slate-300 text-sm md:text-base leading-relaxed">
          We recommend tackling the **WhatsApp Client wrappers** first. The codebase currently has three different modules wrapping the exact same external WatsSender API, with some parts of the system bypassing the provider interface entirely. Deepening this module by consolidating wasender, watssender, and the provider class into a single deep client will immediately yield high leverage and eliminate significant duplication, laying a robust foundation for testing.
        </p>
        <div class="pt-4">
          <a href="#candidates" class="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">View candidate details &rarr;</a>
        </div>
      </section>

    </main>
  </body>
</html>`;

fs.writeFileSync(reportPath, htmlContent);
console.log(`Successfully generated architecture review HTML file at: ${reportPath}`);

// Run xdg-open on Linux
if (os.platform() === 'linux') {
  console.log(`Opening report via xdg-open...`);
  exec(`xdg-open "${reportPath}"`, (err) => {
    if (err) {
      console.error(`Failed to open report via xdg-open:`, err.message);
    } else {
      console.log('Opened report successfully.');
    }
  });
}

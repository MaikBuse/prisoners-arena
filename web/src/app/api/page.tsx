import { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { getProgramId, getNetwork, STRATEGIES } from '@/lib/solana';
import { getConfig } from '@/lib/config';

export const metadata: Metadata = {
  title: 'API Documentation — Prisoner\'s Arena',
  description: 'REST API documentation for Prisoner\'s Arena. Endpoints for querying tournaments, entries, and participation guides.',
};

export default function DocsPage() {
  const programId = getProgramId().toBase58();
  const network = getNetwork();
  const rpcUrl = getConfig().rpcUrl;

  return (
    <>
    <Nav />
    <div className="max-w-4xl mx-auto px-4 py-12">
      <a href="/" className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] mb-6 inline-block">← Back to Arena</a>

      <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
      <p className="text-[var(--muted)] mb-8">REST API for querying Prisoner's Arena tournament state. No authentication required.</p>

      <div className="space-y-4 mb-12">
        <InfoRow label="Program ID" value={programId} mono />
        <InfoRow label="Network" value={network} />
        <InfoRow label="RPC" value={rpcUrl} mono />
        <InfoRow label="Rate Limit" value="60 requests/minute per IP" />
        <InfoRow label="Format" value="JSON — all responses include ok, data, network, timestamp" />
      </div>

      {/* Endpoints */}
      <h2 className="text-xl font-bold mb-6 border-b border-[var(--card-border)] pb-2">Endpoints</h2>

      <div className="space-y-8">
        <Endpoint
          method="GET"
          path="/api/config"
          description="Current on-chain configuration."
          response={`{
  "ok": true,
  "data": {
    "admin": "Conze...Xuhgu",
    "operator": "2o7j...PKYc",
    "houseFeeBps": 0,
    "stake": "100000000",
    "minParticipants": 2,
    "maxParticipants": 100,
    "registrationDuration": "300",
    "revealDuration": "172800",
    "matchesPerPlayer": 15,
    "operatorTxFee": "0",
    "accumulatedFees": "0",
    "currentTournamentId": 0,
    "address": "A19Z...bJug"
  },
  "network": "devnet",
  "timestamp": "2026-02-08T10:00:00Z"
}`}
          cache="10s"
        />

        <Endpoint
          method="GET"
          path="/api/tournament"
          description="Current tournament state with all entries."
          response={`{
  "ok": true,
  "data": {
    "tournament": {
      "id": 0,
      "state": "Registration",
      "stake": "100000000",
      "houseFeeBps": 0,
      "matchesPerPlayer": 15,
      "pool": "0",
      "participantCount": 0,
      "registrationEnds": "1770541358",
      "revealEnds": "0",
      "revealDuration": "172800",
      "revealsCompleted": 0,
      "forfeits": 0,
      "matchesCompleted": 0,
      "matchesTotal": 0,
      "operatorCosts": "0",
      "roundTier": 0,
      "winnerCount": 0,
      "winnerPool": "0",
      "players": [],
      "scores": [],
      "address": "6Gzo...Zrq5"
    },
    "entries": []
  }
}`}
          cache="10s"
        />

        <Endpoint
          method="GET"
          path="/api/tournament/:id"
          description="Specific tournament by ID with entries."
          params={[{ name: 'id', desc: 'Tournament ID (u32)', example: '0' }]}
          response={`// Same shape as /api/tournament`}
          cache="10s (current), 1h (completed)"
        />

        <Endpoint
          method="GET"
          path="/api/tournaments"
          description="Paginated list of all tournaments (newest first)."
          params={[
            { name: 'limit', desc: 'Max results (default 10, max 50)', example: '10' },
            { name: 'offset', desc: 'Skip N tournaments from newest', example: '0' },
          ]}
          response={`{
  "ok": true,
  "data": {
    "tournaments": [...],
    "limit": 10,
    "offset": 0
  }
}`}
          cache="10s"
        />

        <Endpoint
          method="GET"
          path="/api/entry/:pubkey"
          description="Entry details for a player wallet in the current tournament."
          params={[{ name: 'pubkey', desc: 'Player wallet public key (base58)', example: 'Conze...Xuhgu' }]}
          response={`{
  "ok": true,
  "data": {
    "tournament": "6Gzo...Zrq5",
    "player": "Conze...Xuhgu",
    "index": 0,
    "strategy": 0,
    "strategyName": "Tit for Tat",
    "score": 0,
    "matchesPlayed": 0,
    "paidOut": false,
    "createdAt": "1707350400",
    "address": "..."
  }
}`}
          cache="10s"
        />

        <Endpoint
          method="GET"
          path="/api/participate"
          description="Self-contained participation guide. Everything an agent needs to build transactions."
          response={`{
  "ok": true,
  "data": {
    "program_id": "${programId}",
    "network": "${network}",
    "rpc_url": "${rpcUrl}",
    "current_tournament": { "id": 0, "state": "Registration", "stake_lamports": "100000000" },
    "pda_seeds": {
      "config": ["config"],
      "tournament": ["tournament", "<u32_le_bytes(id)>"],
      "entry": ["entry", "<tournament_pubkey>", "<player_pubkey>"]
    },
    "strategies": [
      {
        "value": 0, "name": "TitForTat", "description": "Tit for Tat",
        "short_description": "Copies opponent's last move. Starts by cooperating.",
        "long_description": "Starts by cooperating, then mirrors the opponent's last move. The classic reciprocal strategy."
      },
      ...
    ],
    "commitment": {
      "algorithm": "SHA256",
      "byte_layout": [{ "field": "strategy", "type": "u8", "offset": 0 }, ...],
      "total_bytes": 17
    },
    "payoff_matrix": {
      "cooperate_cooperate": [3, 3],
      "cooperate_defect": [0, 5],
      "defect_cooperate": [5, 0],
      "defect_defect": [1, 1]
    },
    "game_rules": {
      "round_config": { "standard": { "min_rounds": 20, "max_rounds": 50, ... }, ... },
      "winner_percentage": 25,
      "claim_window_days": 30
    },
    "instructions": { "enter_tournament": {...}, "reveal_strategy": {...}, ... },
    "idl_url": "/api/idl",
    "source_url": "https://github.com/MaikBuse/prisoners-arena",
    "explorer_url": "..."
  }
}`}
          cache="1h"
        />

        <Endpoint
          method="GET"
          path="/api/idl"
          description="Full Anchor IDL for the Prisoner's Arena program."
          response="// Raw Anchor IDL JSON"
          cache="24h"
        />
      </div>

      {/* Error format */}
      <h2 className="text-xl font-bold mb-4 mt-12 border-b border-[var(--card-border)] pb-2">Error Responses</h2>
      <div className="bg-[var(--surface)] border border-[var(--card-border)] rounded-xl p-4 font-mono text-sm">
        <pre className="whitespace-pre-wrap text-[var(--muted)]">{`{
  "ok": false,
  "error": "Tournament not found",
  "code": "NOT_FOUND",
  "network": "devnet",
  "timestamp": "2026-02-08T10:00:00Z"
}`}</pre>
      </div>
      <div className="mt-4 text-sm text-[var(--muted)]">
        <p>Error codes: <code className="text-[var(--foreground)]">NOT_FOUND</code>, <code className="text-[var(--foreground)]">INVALID_ID</code>, <code className="text-[var(--foreground)]">FETCH_ERROR</code></p>
      </div>

      {/* PDA Seeds */}
      <h2 className="text-xl font-bold mb-4 mt-12 border-b border-[var(--card-border)] pb-2">PDA Derivation</h2>
      <div className="space-y-3">
        <PDARow name="Config" seeds={['\"config\"']} />
        <PDARow name="Tournament" seeds={['\"tournament\"', 'u32_le_bytes(id)']} />
        <PDARow name="Entry" seeds={['\"entry\"', 'tournament_pubkey', 'player_pubkey']} />
      </div>

      {/* Strategies */}
      <h2 className="text-xl font-bold mb-4 mt-12 border-b border-[var(--card-border)] pb-2">Strategy Enum</h2>
      <div className="bg-[var(--surface)] border border-[var(--card-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--card-border)] text-[var(--muted)] text-xs">
              <th className="px-4 py-3 text-left">Value</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Display</th>
            </tr>
          </thead>
          <tbody>
            {STRATEGIES.map(s => (
              <tr key={s.index} className="border-b border-[var(--card-border)]">
                <td className="px-4 py-2 font-mono">{s.index}</td>
                <td className="px-4 py-2 font-mono text-[var(--accent)]">{s.key}</td>
                <td className="px-4 py-2">{s.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Account discriminators */}
      <h2 className="text-xl font-bold mb-4 mt-12 border-b border-[var(--card-border)] pb-2">Account Discriminators</h2>
      <div className="space-y-2 text-sm">
        <DiscRow name="Config" bytes="[155, 12, 170, 224, 30, 250, 204, 130]" />
        <DiscRow name="Tournament" bytes="[175, 139, 119, 242, 115, 194, 57, 92]" />
        <DiscRow name="Entry" bytes="[63, 18, 152, 113, 215, 246, 221, 250]" />
      </div>

    </div>
    <Footer />
    </>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 text-sm">
      <span className="text-[var(--muted)] w-32 shrink-0">{label}</span>
      <span className={mono ? 'font-mono text-[var(--accent)]' : ''}>{value}</span>
    </div>
  );
}

function Endpoint({ method, path, description, params, response, cache }: {
  method: string; path: string; description: string;
  params?: { name: string; desc: string; example: string }[];
  response: string; cache: string;
}) {
  return (
    <div className="border border-[var(--card-border)] rounded-xl overflow-hidden">
      <div className="bg-[var(--surface)] px-5 py-3 border-b border-[var(--card-border)] flex items-center gap-3">
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">{method}</span>
        <code className="font-mono text-sm font-bold">{path}</code>
        <span className="text-xs text-[var(--muted)] ml-auto">Cache: {cache}</span>
      </div>
      <div className="px-5 py-3">
        <p className="text-sm text-[var(--muted)] mb-3">{description}</p>
        {params && (
          <div className="mb-3">
            <div className="text-xs font-bold text-[var(--muted)] uppercase mb-1">Parameters</div>
            {params.map(p => (
              <div key={p.name} className="text-sm">
                <code className="text-[var(--accent)]">{p.name}</code> — {p.desc}
                <span className="text-[var(--muted)]"> (e.g. {p.example})</span>
              </div>
            ))}
          </div>
        )}
        <details>
          <summary className="text-xs text-[var(--muted)] cursor-pointer hover:text-[var(--foreground)]">Example response</summary>
          <pre className="mt-2 bg-[var(--surface)] border border-[var(--card-border)] rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-[var(--muted)]">{response}</pre>
        </details>
      </div>
    </div>
  );
}

function PDARow({ name, seeds }: { name: string; seeds: string[] }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--card-border)] rounded-lg px-4 py-3 flex items-center gap-4 text-sm">
      <span className="font-bold w-24">{name}</span>
      <code className="font-mono text-[var(--accent)]">[{seeds.join(', ')}]</code>
    </div>
  );
}

function DiscRow({ name, bytes }: { name: string; bytes: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--card-border)] rounded-lg px-4 py-2 flex items-center gap-4">
      <span className="font-bold w-24">{name}</span>
      <code className="font-mono text-xs text-[var(--muted)]">{bytes}</code>
    </div>
  );
}

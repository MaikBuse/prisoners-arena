import { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TracingBeam } from '@/components/TracingBeam';

export const metadata: Metadata = {
  title: 'Custom Strategy VM — Prisoner\'s Arena',
  description: 'Specification for the Custom Strategy bytecode VM. Write arbitrary Prisoner\'s Dilemma strategies as compact programs interpreted on-chain.',
};

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'machine-model', label: 'Machine Model' },
  { id: 'instruction-set', label: 'Instruction Set' },
  { id: 'examples', label: 'Examples' },
  { id: 'commit-reveal', label: 'Commit-Reveal' },
  { id: 'validation', label: 'Validation' },
  { id: 'testing', label: 'Testing Locally' },
] as const;

export default function CustomStrategyVMPage() {
  return (
    <>
    <Nav />
    <TracingBeam className="max-w-5xl mx-auto px-4 py-12">
      <a href="/" className="text-sm text-accent hover:text-accent-hover mb-6 inline-block">&larr; Back to Arena</a>

      <h1 className="text-3xl font-bold mb-2">Custom Strategy VM</h1>
      <p className="text-muted mb-8">Write arbitrary Prisoner&apos;s Dilemma strategies as compact bytecode programs, interpreted on-chain within the match execution pipeline.</p>

      <div className="lg:flex lg:gap-10">
        {/* Sidebar TOC — desktop */}
        <nav className="hidden lg:block lg:w-48 shrink-0">
          <div className="sticky top-20">
            <div className="text-xs font-bold text-muted uppercase mb-3">Contents</div>
            <div className="space-y-1">
              {SECTIONS.map(s => (
                <TOCLink key={s.id} id={s.id} label={s.label} />
              ))}
            </div>
          </div>
        </nav>

        {/* Mobile TOC strip */}
        <nav className="lg:hidden mb-8 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full border border-card-border text-muted hover:text-foreground hover:border-accent transition-colors">
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-12">

          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="text-muted mb-4">
              The 9 built-in strategies cover the classic approaches, but the strategic <em>structure</em> is fixed. A player who wants &ldquo;cooperate for 5 rounds, then play Tit-for-Tat, but always defect if the opponent has defected more than 60% of the time&rdquo; cannot express that today.
            </p>
            <p className="text-muted mb-6">
              The Custom Strategy VM lets players compose arbitrary decision logic as compact bytecode programs (max 64 bytes). Programs are interpreted on-chain during match execution — fully deterministic, verifiable, and reproducible. <strong>Custom</strong> is strategy variant index <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">9</code>, alongside the existing built-in strategies.
            </p>

            <div className="bg-surface border border-card-border rounded-xl p-4 mb-4">
              <div className="text-xs font-bold text-muted uppercase mb-3">Architecture Flow</div>
              <div className="font-mono text-sm text-muted space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="bg-background border border-card-border rounded-lg px-3 py-1.5">Write bytecode (max 64 bytes)</span>
                  <span>&rarr;</span>
                  <span className="bg-background border border-card-border rounded-lg px-3 py-1.5">SHA256(hash) &rarr; commitment</span>
                  <span>&rarr;</span>
                  <span className="bg-background border border-card-border rounded-lg px-3 py-1.5">validate() &rarr; stored on-chain</span>
                  <span>&rarr;</span>
                  <span className="bg-background border border-card-border rounded-lg px-3 py-1.5">execute_bytecode() per round</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm text-muted">
              <p>Built-in strategies remain as native optimized code paths — zero performance regression for existing players.</p>
              <p>The VM lives in the <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">match-logic</code> crate and compiles to both native (on-chain contract) and WASM (frontend replay).</p>
            </div>
          </Section>

          {/* Machine Model */}
          <Section id="machine-model" title="Machine Model">
            <div className="bg-surface border border-card-border rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-muted text-xs">
                    <th className="px-4 py-3 text-left">Property</th>
                    <th className="px-4 py-3 text-left">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Stack depth', '8 elements'],
                    ['Value type', 'u8 (0\u2013255)'],
                    ['Max program size', '64 bytes'],
                    ['Fuel limit', '128 instructions per round'],
                    ['Default on error', 'Cooperate'],
                    ['Jump model', 'Forward-only (guarantees termination)'],
                  ].map(([prop, val]) => (
                    <tr key={prop} className="border-b border-card-border last:border-0">
                      <td className="px-4 py-2 font-medium">{prop}</td>
                      <td className="px-4 py-2 font-mono text-muted">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-6">
              <div className="text-xs font-bold text-muted uppercase mb-2">Inputs Available Per Round</div>
              <div className="bg-surface border border-card-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted text-xs">
                      <th className="px-4 py-3 text-left">Input</th>
                      <th className="px-4 py-3 text-left">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Opponent\u2019s move history', 'Slice, grows each round'],
                      ['Own move history', 'Slice, grows each round'],
                      ['Round number', 'u8, 0-indexed'],
                      ['Deterministic RNG', 'SeededRng, unique per player per round'],
                    ].map(([input, source]) => (
                      <tr key={input} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-2 font-medium">{input}</td>
                        <td className="px-4 py-2 text-muted">{source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-muted uppercase mb-2">Error Handling</div>
              <p className="text-sm text-muted mb-3">
                The VM never panics. Every anomalous condition falls back to <strong>Cooperate</strong>:
              </p>
              <ul className="list-disc list-inside text-sm text-muted space-y-1">
                <li><strong>Stack underflow</strong> &mdash; halt, Cooperate</li>
                <li><strong>Stack overflow</strong> &mdash; halt, Cooperate</li>
                <li><strong>Out-of-bounds history</strong> &mdash; returns 0 (Cooperate)</li>
                <li><strong>Unknown opcode</strong> &mdash; immediate halt, Cooperate</li>
                <li><strong>Fuel exhaustion</strong> &mdash; Cooperate</li>
                <li><strong>Program falls off end</strong> &mdash; Cooperate</li>
              </ul>
              <p className="text-sm text-muted mt-3">
                This &ldquo;fail-safe to cooperation&rdquo; penalizes broken programs without crashing the match.
              </p>
            </div>
          </Section>

          {/* Instruction Set */}
          <Section id="instruction-set" title="Instruction Set (25 opcodes)">

            {/* Terminals */}
            <div className="mb-6">
              <div className="text-xs font-bold text-muted uppercase mb-2">Terminals</div>
              <div className="bg-surface border border-card-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted text-xs">
                      <th className="px-4 py-3 text-left w-14">Hex</th>
                      <th className="px-4 py-3 text-left">Mnemonic</th>
                      <th className="px-4 py-3 text-left w-14">Bytes</th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">Stack</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['00', 'COOP', '1', '\u2192 halt', 'Return Cooperate immediately'],
                      ['16', 'DEFECT', '1', '\u2192 halt', 'Return Defect immediately'],
                      ['18', 'RETURN', '1', '[v] \u2192 halt', 'Pop top; 0 = Cooperate, nonzero = Defect'],
                    ].map(([hex, mnemonic, bytes, stack, desc]) => (
                      <tr key={hex} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-2 font-mono text-accent">{hex}</td>
                        <td className="px-4 py-2 font-mono font-medium">{mnemonic}</td>
                        <td className="px-4 py-2 font-mono text-muted">{bytes}</td>
                        <td className="px-4 py-2 font-mono text-muted text-xs hidden md:table-cell">{stack}</td>
                        <td className="px-4 py-2 text-muted text-xs hidden sm:table-cell">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Literals & Input */}
            <div className="mb-6">
              <div className="text-xs font-bold text-muted uppercase mb-2">Literals &amp; Input</div>
              <div className="bg-surface border border-card-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted text-xs">
                      <th className="px-4 py-3 text-left w-14">Hex</th>
                      <th className="px-4 py-3 text-left">Mnemonic</th>
                      <th className="px-4 py-3 text-left w-14">Bytes</th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">Stack</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['01', 'PUSH imm8', '2', '\u2192 [imm]', 'Push literal byte'],
                      ['02', 'OPP_LAST', '1', '\u2192 [0|1]', 'Opponent\u2019s last move (0 if round 0)'],
                      ['03', 'MY_LAST', '1', '\u2192 [0|1]', 'My last move (0 if round 0)'],
                      ['04', 'OPP_N', '1', '[n] \u2192 [0|1]', 'Opponent\u2019s move n rounds ago'],
                      ['05', 'MY_N', '1', '[n] \u2192 [0|1]', 'My move n rounds ago'],
                      ['06', 'OPP_DEFECTS', '1', '\u2192 [count]', 'Total opponent defections (cap 255)'],
                      ['07', 'MY_DEFECTS', '1', '\u2192 [count]', 'Total my defections (cap 255)'],
                      ['08', 'ROUND', '1', '\u2192 [n]', 'Current round number (0-indexed)'],
                      ['09', 'RAND', '1', '\u2192 [0..99]', 'Deterministic random 0\u201399'],
                      ['17', 'SCORE_LAST', '1', '\u2192 [0..5]', 'My payoff from last round (3 if round 0)'],
                    ].map(([hex, mnemonic, bytes, stack, desc]) => (
                      <tr key={hex} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-2 font-mono text-accent">{hex}</td>
                        <td className="px-4 py-2 font-mono font-medium">{mnemonic}</td>
                        <td className="px-4 py-2 font-mono text-muted">{bytes}</td>
                        <td className="px-4 py-2 font-mono text-muted text-xs hidden md:table-cell">{stack}</td>
                        <td className="px-4 py-2 text-muted text-xs hidden sm:table-cell">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Arithmetic */}
            <div className="mb-6">
              <div className="text-xs font-bold text-muted uppercase mb-2">Arithmetic (saturating)</div>
              <div className="bg-surface border border-card-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted text-xs">
                      <th className="px-4 py-3 text-left w-14">Hex</th>
                      <th className="px-4 py-3 text-left">Mnemonic</th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">Stack</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['0A', 'ADD', '[a, b] \u2192 [a+b]', 'Capped at 255'],
                      ['0B', 'SUB', '[a, b] \u2192 [a\u2212b]', 'Floored at 0'],
                      ['0C', 'MUL', '[a, b] \u2192 [a\u00d7b]', 'Capped at 255'],
                    ].map(([hex, mnemonic, stack, desc]) => (
                      <tr key={hex} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-2 font-mono text-accent">{hex}</td>
                        <td className="px-4 py-2 font-mono font-medium">{mnemonic}</td>
                        <td className="px-4 py-2 font-mono text-muted text-xs hidden md:table-cell">{stack}</td>
                        <td className="px-4 py-2 text-muted text-xs hidden sm:table-cell">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Comparison & Logic */}
            <div className="mb-6">
              <div className="text-xs font-bold text-muted uppercase mb-2">Comparison &amp; Logic</div>
              <div className="bg-surface border border-card-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted text-xs">
                      <th className="px-4 py-3 text-left w-14">Hex</th>
                      <th className="px-4 py-3 text-left">Mnemonic</th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">Stack</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['0D', 'GT', '[a, b] \u2192 [0|1]', '1 if a > b'],
                      ['0E', 'LT', '[a, b] \u2192 [0|1]', '1 if a < b'],
                      ['0F', 'EQ', '[a, b] \u2192 [0|1]', '1 if a == b'],
                      ['10', 'NOT', '[a] \u2192 [0|1]', '0 \u2192 1, nonzero \u2192 0'],
                      ['11', 'AND', '[a, b] \u2192 [0|1]', 'Both nonzero \u2192 1'],
                      ['12', 'OR', '[a, b] \u2192 [0|1]', 'Either nonzero \u2192 1'],
                    ].map(([hex, mnemonic, stack, desc]) => (
                      <tr key={hex} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-2 font-mono text-accent">{hex}</td>
                        <td className="px-4 py-2 font-mono font-medium">{mnemonic}</td>
                        <td className="px-4 py-2 font-mono text-muted text-xs hidden md:table-cell">{stack}</td>
                        <td className="px-4 py-2 text-muted text-xs hidden sm:table-cell">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stack & Control Flow */}
            <div>
              <div className="text-xs font-bold text-muted uppercase mb-2">Stack &amp; Control Flow</div>
              <div className="bg-surface border border-card-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted text-xs">
                      <th className="px-4 py-3 text-left w-14">Hex</th>
                      <th className="px-4 py-3 text-left">Mnemonic</th>
                      <th className="px-4 py-3 text-left w-14">Bytes</th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">Stack</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['13', 'DUP', '1', '[a] \u2192 [a, a]', 'Duplicate top'],
                      ['14', 'JMP_FWD off', '2', '\u2014', 'Jump forward off bytes (unconditional)'],
                      ['15', 'JMP_FWD_IF off', '2', '[cond] \u2192 \u2014', 'Pop; if nonzero, jump forward off bytes'],
                    ].map(([hex, mnemonic, bytes, stack, desc]) => (
                      <tr key={hex} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-2 font-mono text-accent">{hex}</td>
                        <td className="px-4 py-2 font-mono font-medium">{mnemonic}</td>
                        <td className="px-4 py-2 font-mono text-muted">{bytes}</td>
                        <td className="px-4 py-2 font-mono text-muted text-xs hidden md:table-cell">{stack}</td>
                        <td className="px-4 py-2 text-muted text-xs hidden sm:table-cell">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Examples */}
          <Section id="examples" title="Example Programs">
            <p className="text-sm text-muted mb-6">
              Classic strategies re-implemented as bytecode. These demonstrate how the VM&apos;s small instruction set can express complex decision logic.
            </p>

            <div className="space-y-6">
              <ExampleProgram
                name="TitForTat"
                size="2 bytes"
                description="Copy opponent's last move. Round 0: opponent history empty → 0 → Cooperate."
                code={`02 18       OPP_LAST RETURN`}
              />

              <ExampleProgram
                name="AlwaysDefect"
                size="1 byte"
                description="Defect unconditionally."
                code={`16          DEFECT`}
              />

              <ExampleProgram
                name="GrimTrigger"
                size="8 bytes"
                description="Cooperate until the opponent defects once, then defect forever."
                code={`06          OPP_DEFECTS         ; [count]
01 00       PUSH 0              ; [count, 0]
0D          GT                  ; [count > 0]
15 01       JMP_FWD_IF 1        ; if true, skip to DEFECT
00          COOP
16          DEFECT`}
              />

              <ExampleProgram
                name="Pavlov"
                size="10 bytes"
                description="Win-stay, lose-switch: repeat last move if payoff ≥ 3, otherwise switch."
                code={`17          SCORE_LAST          ; [score]
01 03       PUSH 3              ; [score, 3]
0E          LT                  ; [bad?]  1 if score < 3
03          MY_LAST             ; [bad?, my_d]
0F          EQ                  ; [should_coop]  bad==my_d → cooperate
15 01       JMP_FWD_IF 1        ; if true → COOP
16          DEFECT
00          COOP`}
              />

              <ExampleProgram
                name="TitForTwoTats"
                size="9 bytes"
                description="Only retaliate after two consecutive opponent defections."
                code={`02          OPP_LAST            ; [last]
01 01       PUSH 1              ; [last, 1]
04          OPP_N               ; [last, second_last]
11          AND                 ; [both_defected]
15 01       JMP_FWD_IF 1        ; if true → DEFECT
00          COOP
16          DEFECT`}
              />

              <ExampleProgram
                name="Forgiving Detective"
                size="25 bytes"
                description="Cooperate rounds 0–2, defect round 3 (probe). After: if opponent never defected, exploit (AlwaysDefect); otherwise play TitForTat. A novel strategy impossible to express with the 9 built-in strategies."
                code={`08          ROUND               ; [round]
01 03       PUSH 3              ; [round, 3]
0D          GT                  ; [past_opening?]
15 06       JMP_FWD_IF 6        ; if past opening → analysis
08          ROUND               ; [round]
01 03       PUSH 3              ; [round, 3]
0F          EQ                  ; [is_round_3?]
15 01       JMP_FWD_IF 1        ; if round 3 → defect
00          COOP                ; rounds 0-2: cooperate
16          DEFECT              ; round 3: probe defect
; -- analysis (round > 3) --
06          OPP_DEFECTS         ; [opp_d]
01 00       PUSH 0              ; [opp_d, 0]
0F          EQ                  ; [naive?]
15 02       JMP_FWD_IF 2        ; if never defected → exploit
02          OPP_LAST            ; [opp_last]
18          RETURN              ; TFT: mirror opponent
16          DEFECT              ; exploit naive opponent`}
              />
            </div>
          </Section>

          {/* Strategy Lab CTA */}
          <a href="/configure" className="block group">
            <div className="bg-surface border border-card-border rounded-2xl p-6 flex items-center gap-5 hover:border-accent transition-all">
              <div className="shrink-0 w-14 h-14 rounded-xl bg-background border border-card-border flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg mb-1">Try it in the Strategy Lab</div>
                <p className="text-sm text-muted">Write assembly, get instant WASM validation, and preview your custom strategy against all 9 built-ins — right in the browser.</p>
              </div>
              <svg className="w-5 h-5 text-muted shrink-0 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </a>

          {/* Commit-Reveal */}
          <Section id="commit-reveal" title="Commit-Reveal for Custom Strategies">
            <p className="text-muted mb-4">
              Custom strategies use a two-level hashing scheme to keep the commitment preimage fixed-length while allowing variable-length bytecode.
            </p>

            <div className="bg-surface border border-card-border rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-muted text-xs">
                    <th className="px-4 py-3 text-left">Strategy Type</th>
                    <th className="px-4 py-3 text-left">Commitment Hash</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-card-border">
                    <td className="px-4 py-2 font-medium">Built-in</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted">SHA256(strategy_u8 || salt[16])</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">Custom</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted">SHA256(9u8 || SHA256(bytecode[0..len]) || salt[16])</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-3 text-sm text-muted">
              <p>
                The inner <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">SHA256(bytecode)</code> hash produces a fixed 32-byte digest regardless of program length, keeping the outer preimage at a fixed 49 bytes (1 + 32 + 16). The bytecode hash can also be displayed independently as a program fingerprint.
              </p>
              <p>
                <strong>Forfeit handling:</strong> <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">commitment[0] % 9</code> always assigns a built-in strategy — forfeited players never receive Custom. No change to the existing forfeit mechanism.
              </p>
            </div>
          </Section>

          {/* Validation */}
          <Section id="validation" title="Bytecode Validation">
            <p className="text-muted mb-4">
              Six checks are performed on-chain during the reveal phase to reject malformed programs before they enter the match pipeline:
            </p>

            <div className="space-y-2 mb-4">
              {[
                ['1. Non-empty', 'Program length must be > 0'],
                ['2. Length limit', 'Program length must be \u2264 64 bytes'],
                ['3. Valid opcodes', 'Every byte must be a known opcode (0x00\u20130x18)'],
                ['4. Complete immediates', 'PUSH, JMP_FWD, and JMP_FWD_IF must have their operand byte present'],
                ['5. Jump bounds', 'pc + offset \u2264 bytecode.len() for all jumps'],
                ['6. Has terminal', 'At least one COOP, DEFECT, or RETURN instruction must exist'],
              ].map(([rule, desc]) => (
                <div key={rule} className="bg-surface border border-card-border rounded-lg px-4 py-3">
                  <div className="flex items-start gap-3 text-sm">
                    <span className="font-bold font-mono shrink-0">{rule}</span>
                    <span className="text-muted">{desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-muted">
              Stack depth is <strong>not</strong> validated statically — underflow and overflow are handled gracefully at runtime (see <a href="#machine-model" className="text-accent hover:text-accent-hover">Machine Model</a> error handling).
            </p>
          </Section>

          {/* Testing Locally */}
          <Section id="testing" title="Testing Locally">
            <p className="text-muted mb-4">
              The <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">match-logic</code> crate provides everything you need to validate and test custom bytecode programs locally before submitting them on-chain.
            </p>

            <div className="mb-6">
              <div className="text-xs font-bold text-muted uppercase mb-2">Key Functions</div>
              <div className="bg-surface border border-card-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-muted text-xs">
                      <th className="px-4 py-3 text-left">Function</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['validate_bytecode(bytecode: &[u8])', 'Runs all 6 validation checks. Returns Ok(()) or a BytecodeError variant (Empty, TooLong, UnknownOpcode, TruncatedImmediate, JumpOutOfBounds, NoTerminal).'],
                      ['run_match(strategy_a, strategy_b, seed, match_index, participant_count)', 'Executes a full match between two PlayerStrategy values. Returns a MatchResult with round-by-round history and total scores.'],
                      ['replay_match(...) (WASM)', 'Browser-compatible binding. Accepts JSON-serialized strategies, returns JSON MatchResult. Use for frontend testing.'],
                    ].map(([fn_, desc]) => (
                      <tr key={fn_} className="border-b border-card-border last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{fn_}</td>
                        <td className="px-4 py-2 text-muted text-xs hidden sm:table-cell">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-xs font-bold text-muted uppercase mb-2">Example: Validate &amp; Run a Custom Strategy</div>
              <pre className="bg-surface border border-card-border rounded-xl p-4 font-mono text-xs text-muted overflow-x-auto whitespace-pre">{`use match_logic::{validate_bytecode, run_match, PlayerStrategy};

fn main() {
    // TitForTat as bytecode: OPP_LAST RETURN
    let bytecode = vec![0x02, 0x18];

    // Validate before submitting on-chain
    validate_bytecode(&bytecode).expect("invalid program");

    // Test against AlwaysDefect
    let custom  = PlayerStrategy::Custom(bytecode);
    let defector = PlayerStrategy::Builtin(match_logic::Strategy::AlwaysDefect);

    let seed = [0u8; 32];
    let result = run_match(&custom, &defector, &seed, 0, 8);

    println!("Custom: {} | Defector: {}",
        result.total_score_a, result.total_score_b);
    println!("Rounds played: {}", result.round_count);
    for r in &result.rounds {
        println!("  R{}: {:?} vs {:?} → {}-{}",
            r.round, r.move_a, r.move_b, r.score_a, r.score_b);
    }
}`}</pre>
            </div>

            <div className="space-y-3 text-sm text-muted">
              <p>
                Add <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">match-logic</code> as a dependency in your <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">Cargo.toml</code> to test locally with <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">cargo run</code>. The same code that runs on-chain will execute on your machine &mdash; results are deterministic given the same seed.
              </p>
              <p>
                For browser-based testing, the WASM <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">replay_match()</code> binding accepts JSON strategies like <code className="bg-surface px-1.5 py-0.5 rounded text-xs font-mono">{`{"Custom": [2, 24]}`}</code> and returns a full JSON match result.
              </p>
            </div>
          </Section>

        </div>
      </div>
    </TracingBeam>
    <Footer />
    </>
  );
}

/* Inline helper components */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h2 className="text-xl font-bold mb-4 border-b border-card-border pb-2">{title}</h2>
      {children}
    </section>
  );
}

function TOCLink({ id, label }: { id: string; label: string }) {
  return (
    <a href={`#${id}`}
       className="block text-sm text-muted hover:text-foreground hover:border-l-2 hover:border-accent pl-3 py-1 transition-all">
      {label}
    </a>
  );
}

function ExampleProgram({ name, size, description, code }: { name: string; size: string; description: string; code: string }) {
  return (
    <div className="bg-surface border border-card-border rounded-xl p-4">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="font-bold font-mono text-accent">{name}</h3>
        <span className="text-xs text-muted">{size}</span>
      </div>
      <p className="text-sm text-muted mb-3">{description}</p>
      <pre className="bg-background border border-card-border rounded-lg p-3 font-mono text-xs text-muted overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

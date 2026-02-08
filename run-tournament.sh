#!/bin/bash
set -e
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$PATH"
cd /home/kusanagi/.openclaw/workspace/projects/dilemma-arena

OPERATOR="./target/debug/operator --rpc-url https://api.devnet.solana.com --keypair ~/.config/solana/operator.json --program-id 6GhLrCuPioYDRquc9xW6mmEu3s9EfuXdwkEN5mFKcE56 --manual"
ARENA="./target/debug/arena"

echo "=== Waiting for registration to expire ==="
while true; do
  NOW=$(date +%s)
  REMAINING=$((1770589174 - NOW))
  if [ $REMAINING -le 0 ]; then
    echo "Registration expired!"
    break
  fi
  echo "Waiting... ${REMAINING}s remaining"
  sleep 10
done

echo ""
echo "=== Step 1: Close Registration (start matches) ==="
$OPERATOR 2>&1
sleep 2

echo ""
echo "=== Step 2: Run Matches (loop until all done) ==="
while true; do
  OUTPUT=$($OPERATOR 2>&1)
  echo "$OUTPUT"
  # Check if matches are still running
  if echo "$OUTPUT" | grep -q "All matches complete\|Nothing to do\|Payout\|finaliz"; then
    break
  fi
  sleep 2
done

echo ""
echo "=== Step 3: Finalize (if not already done) ==="
$OPERATOR 2>&1
sleep 2

echo ""
echo "=== Tournament Status ==="
$ARENA tournament 0

echo ""
echo "=== Step 4: Claim Payouts ==="
for i in 1 2 3 4; do
  echo "Player $i claiming..."
  $ARENA claim --wallet wallets/player${i}.json --tournament 0 2>&1 || echo "  (not a winner or already claimed)"
done

echo ""
echo "=== Final Balances ==="
for i in 1 2 3 4; do
  echo "Player $i: $(solana balance wallets/player${i}.json)"
done
echo "Admin: $(solana balance)"
echo "Operator: $(solana balance ~/.config/solana/operator.json)"

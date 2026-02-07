import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { STRATEGY_INFO, StrategyBase, StrategyParams, Strategy } from '../types'

export default function Enter() {
  const { connected } = useWallet()
  const [stake, setStake] = useState(0.1)
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyBase>('TitForTat')
  const [params, setParams] = useState<StrategyParams>({
    forgiveness: 0,
    retaliation_delay: 0,
    noise_tolerance: 0,
    initial_moves: 0,
    cooperate_bias: 50,
  })

  const strategyInfo = STRATEGY_INFO.find(s => s.id === selectedStrategy)!

  const handleSubmit = async () => {
    const strategy: Strategy = {
      base: selectedStrategy,
      params,
    }
    console.log('Entering with:', { stake, strategy })
    // TODO: Send transaction
  }

  if (!connected) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <h1 className="text-3xl font-bold mb-4">Enter Tournament</h1>
        <p className="text-gray-400 mb-6">Connect your wallet to enter</p>
        <WalletMultiButton />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Enter Tournament</h1>

      <div className="space-y-8">
        {/* Stake Input */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Stake Amount</h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0.1}
              max={10}
              step={0.1}
              value={stake}
              onChange={(e) => setStake(parseFloat(e.target.value))}
              className="flex-1"
            />
            <div className="w-32">
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={stake}
                onChange={(e) => setStake(parseFloat(e.target.value) || 0.1)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 font-mono"
              />
            </div>
            <span className="text-gray-400">SOL</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Minimum: 0.1 SOL. Higher stakes mean higher potential winnings (same ROI%).
          </p>
        </div>

        {/* Strategy Selection */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Choose Strategy</h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {STRATEGY_INFO.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStrategy(s.id)}
                className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                  selectedStrategy === s.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <p className="text-gray-400">{strategyInfo.description}</p>
        </div>

        {/* Strategy Parameters */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Parameters</h2>
          <div className="space-y-4">
            {strategyInfo.params
              .filter((p) => p.applicable)
              .map((p) => (
                <div key={p.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-gray-400">{p.label}</label>
                    <span className="font-mono text-sm">{params[p.key]}</span>
                  </div>
                  <input
                    type="range"
                    min={p.min}
                    max={p.max}
                    value={params[p.key]}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        [p.key]: parseInt(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                </div>
              ))}
            {strategyInfo.params.filter((p) => p.applicable).length === 0 && (
              <p className="text-gray-500 text-sm">
                This strategy has no configurable parameters.
              </p>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Entry Preview</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Stake</span>
              <span className="font-mono">{stake} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Strategy</span>
              <span>{strategyInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Network Fee</span>
              <span className="font-mono">~0.001 SOL</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full bg-primary-600 hover:bg-primary-700 py-4 rounded-xl font-semibold text-lg transition-colors"
        >
          Enter Tournament
        </button>
      </div>
    </div>
  )
}

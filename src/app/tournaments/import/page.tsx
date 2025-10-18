'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface TournamentPreview {
  name: string;
  type: string;
  players: number;
  games: number;
  rounds: number;
}

interface ImportResult {
  success: boolean;
  tournament?: {
    id: string;
    name: string;
    type: string;
    players: number;
    rounds: number;
    games: number;
  };
  details?: {
    playersImported: number;
    roundsCreated: number;
    gamesLinked: number;
    gamesToAnalyze: string[];
    warnings: string[];
    suggestions: string[];
  };
  error?: string;
}

type ImportStep = 'input' | 'preview' | 'importing' | 'complete';

export default function TournamentImportPage() {
  const router = useRouter();

  // Form state
  const [pgnText, setPgnText] = useState('');
  const [analyzeGames, setAnalyzeGames] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<ImportStep>('input');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [preview, setPreview] = useState<TournamentPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Validate PGN
  const handleValidate = async () => {
    setError(null);

    if (!pgnText.trim()) {
      setError('Please enter PGN text');
      return;
    }

    try {
      const response = await fetch('/api/tournaments/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgnText }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to validate PGN');
        return;
      }

      if (!data.valid) {
        setError(data.error || 'Invalid PGN format');
        setValidation(data.validation || null);
        return;
      }

      setPreview(data.tournament);
      setValidation(data.validation);
      setCurrentStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate PGN');
    }
  };

  // Step 2: Import tournament
  const handleImport = async () => {
    setCurrentStep('importing');
    setError(null);

    try {
      const response = await fetch('/api/tournaments/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pgnText,
          analyzeGames,
          userId: 'system', // TODO: Replace with actual user ID
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to import tournament');
        setCurrentStep('preview');
        return;
      }

      setImportResult(data);
      setCurrentStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import tournament');
      setCurrentStep('preview');
    }
  };

  // Reset wizard
  const handleReset = () => {
    setPgnText('');
    setAnalyzeGames(false);
    setCurrentStep('input');
    setValidation(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Import Tournament</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Import tournament data from PGN files. All players must have FIDE identifiers.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${currentStep === 'input' ? 'text-blue-600 dark:text-blue-400' : currentStep === 'preview' || currentStep === 'importing' || currentStep === 'complete' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold ${currentStep === 'input' ? 'border-blue-600 dark:border-blue-400' : 'border-green-600 dark:border-green-400 bg-green-600 dark:bg-green-400 text-white'}`}>
              {currentStep === 'input' ? '1' : '✓'}
            </div>
            <span className="ml-2 font-medium">Input PGN</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600 mx-4"></div>
          <div className={`flex items-center ${currentStep === 'preview' ? 'text-blue-600 dark:text-blue-400' : currentStep === 'importing' || currentStep === 'complete' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold ${currentStep === 'preview' ? 'border-blue-600 dark:border-blue-400' : currentStep === 'importing' || currentStep === 'complete' ? 'border-green-600 dark:border-green-400 bg-green-600 dark:bg-green-400 text-white' : 'border-gray-400'}`}>
              {currentStep === 'importing' || currentStep === 'complete' ? '✓' : '2'}
            </div>
            <span className="ml-2 font-medium">Preview</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-600 mx-4"></div>
          <div className={`flex items-center ${currentStep === 'complete' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold ${currentStep === 'complete' ? 'border-green-600 dark:border-green-400 bg-green-600 dark:bg-green-400 text-white' : 'border-gray-400'}`}>
              {currentStep === 'complete' ? '✓' : '3'}
            </div>
            <span className="ml-2 font-medium">Complete</span>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">Error</h3>
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Step 1: Input PGN */}
      {currentStep === 'input' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Step 1: Input PGN Data</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              PGN Text
            </label>
            <textarea
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
              placeholder="Paste your PGN text here..."
              className="w-full h-64 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg font-mono text-sm"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Upload a PGN file containing all games from the tournament. Players must have WhiteFideId and BlackFideId headers.
            </p>
          </div>

          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={analyzeGames}
                onChange={(e) => setAnalyzeGames(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">
                Queue games for analysis (games that don't exist in the database will be analyzed)
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleValidate}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Validate & Continue
            </button>
            <button
              onClick={() => router.push('/tournaments')}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {currentStep === 'preview' && preview && validation && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Step 2: Preview Tournament</h2>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Tournament Information</h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Name</span>
                <p className="font-medium">{preview.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Type</span>
                <p className="font-medium capitalize">{preview.type.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Players</span>
                <p className="font-medium">{preview.players}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Rounds</span>
                <p className="font-medium">{preview.rounds}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Games</span>
                <p className="font-medium">{preview.games}</p>
              </div>
            </div>
          </div>

          {/* Validation results */}
          {validation.warnings.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Warnings</h3>
              <ul className="list-disc list-inside space-y-1">
                {validation.warnings.map((warning, i) => (
                  <li key={i} className="text-yellow-700 dark:text-yellow-300 text-sm">{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.suggestions.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Suggestions</h3>
              <ul className="list-disc list-inside space-y-1">
                {validation.suggestions.map((suggestion, i) => (
                  <li key={i} className="text-blue-700 dark:text-blue-300 text-sm">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Import Tournament
            </button>
            <button
              onClick={() => setCurrentStep('input')}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {currentStep === 'importing' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Importing Tournament...</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Please wait while we process the tournament data.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Analyzing games with Stockfish (depth 20)...
          </p>
        </div>
      )}

      {/* Step 4: Complete */}
      {currentStep === 'complete' && importResult && importResult.success && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <div className="inline-block w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Tournament has been successfully imported.
            </p>
          </div>

          {importResult.tournament && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Import Summary</h3>
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Tournament</span>
                  <p className="font-medium">{importResult.tournament.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Type</span>
                  <p className="font-medium capitalize">{importResult.tournament.type.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Players Imported</span>
                  <p className="font-medium">{importResult.tournament.players}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Rounds Created</span>
                  <p className="font-medium">{importResult.tournament.rounds}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Games Analyzed & Linked</span>
                  <p className="font-medium">{importResult.tournament.games}</p>
                </div>
              </div>
            </div>
          )}

          {importResult.details && importResult.details.warnings.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Warnings</h3>
              <ul className="list-disc list-inside space-y-1">
                {importResult.details.warnings.map((warning, i) => (
                  <li key={i} className="text-yellow-700 dark:text-yellow-300 text-sm">{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {importResult.details && importResult.details.gamesToAnalyze.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Games Queued for Analysis</h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                {importResult.details.gamesToAnalyze.length} game(s) have been queued for analysis and will be processed shortly.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/tournaments/${importResult.tournament?.id}`)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View Tournament
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Import Another
            </button>
            <button
              onClick={() => router.push('/tournaments')}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Back to Tournaments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

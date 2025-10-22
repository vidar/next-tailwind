"use client";

import { useState } from "react";

export interface RenderOptions {
  compositionType: "walkthrough" | "annotated";
  aspectRatio: "landscape" | "portrait";
  orientation: "white" | "black";
  musicGenre: string;
}

interface RenderOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRender: (options: RenderOptions) => void;
  hasAnnotations: boolean;
  initialOrientation?: "white" | "black";
}

const MUSIC_GENRES = [
  { value: "none", label: "No Music" },
  { value: "lofi", label: "Lo-Fi" },
  { value: "classical", label: "Classical" },
  { value: "ambient", label: "Ambient" },
  { value: "breakbeat", label: "Breakbeat" },
  { value: "funk", label: "Funk" },
  { value: "jazz", label: "Jazz" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "metal", label: "Metal" },
];

export function RenderOptionsModal({
  isOpen,
  onClose,
  onRender,
  hasAnnotations,
  initialOrientation = "white",
}: RenderOptionsModalProps) {
  const [compositionType, setCompositionType] = useState<"walkthrough" | "annotated">("walkthrough");
  const [aspectRatio, setAspectRatio] = useState<"landscape" | "portrait">("landscape");
  const [orientation, setOrientation] = useState<"white" | "black">(initialOrientation);
  const [musicGenre, setMusicGenre] = useState("none");

  if (!isOpen) return null;

  const handleRender = () => {
    onRender({
      compositionType,
      aspectRatio,
      orientation,
      musicGenre,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Render Video Options
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Composition Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Composition Type
            </label>
            <select
              value={compositionType}
              onChange={(e) => setCompositionType(e.target.value as "walkthrough" | "annotated")}
              disabled={!hasAnnotations && compositionType === "annotated"}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg font-medium transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed"
            >
              <option value="walkthrough">Walkthrough</option>
              <option value="annotated" disabled={!hasAnnotations}>
                Annotated {!hasAnnotations ? "(no annotations)" : ""}
              </option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Walkthrough shows the game moves, Annotated includes your commentary
            </p>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Aspect Ratio
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAspectRatio("landscape")}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  aspectRatio === "landscape"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <svg className="w-8 h-6" viewBox="0 0 32 24" fill="currentColor">
                    <rect width="32" height="24" rx="2" />
                  </svg>
                  <span className="text-sm">Landscape</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">16:9</span>
                </div>
              </button>
              <button
                onClick={() => setAspectRatio("portrait")}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  aspectRatio === "portrait"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <svg className="w-6 h-8" viewBox="0 0 24 32" fill="currentColor">
                    <rect width="24" height="32" rx="2" />
                  </svg>
                  <span className="text-sm">Portrait</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">9:16</span>
                </div>
              </button>
            </div>
          </div>

          {/* Board Orientation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Board Perspective
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOrientation("white")}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  orientation === "white"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                White's Perspective
              </button>
              <button
                onClick={() => setOrientation("black")}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                  orientation === "black"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                Black's Perspective
              </button>
            </div>
          </div>

          {/* Background Music */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Background Music
            </label>
            <select
              value={musicGenre}
              onChange={(e) => setMusicGenre(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              {MUSIC_GENRES.map((genre) => (
                <option key={genre.value} value={genre.value}>
                  {genre.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select background music style for your video
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRender}
            disabled={compositionType === "annotated" && !hasAnnotations}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Start Rendering
          </button>
        </div>
      </div>
    </div>
  );
}

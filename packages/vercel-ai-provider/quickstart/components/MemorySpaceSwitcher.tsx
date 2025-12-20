"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MemorySpaceSwitcherProps {
  value: string;
  onChange: (value: string) => void;
}

const spaces = [
  { id: "quickstart-demo", name: "Demo", icon: "🧪" },
  { id: "personal", name: "Personal", icon: "👤" },
  { id: "work", name: "Work", icon: "💼" },
];

export function MemorySpaceSwitcher({
  value,
  onChange,
}: MemorySpaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentSpace = spaces.find((s) => s.id === value) || spaces[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
      >
        <span>{currentSpace.icon}</span>
        <span className="text-sm font-medium">{currentSpace.name}</span>
        <motion.span
          className="text-gray-400 text-xs"
          animate={{ rotate: isOpen ? 180 : 0 }}
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden"
            >
              <div className="p-2">
                <div className="text-xs text-gray-500 px-2 py-1 mb-1">
                  Memory Space
                </div>

                {spaces.map((space) => (
                  <button
                    key={space.id}
                    onClick={() => {
                      onChange(space.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                      value === space.id
                        ? "bg-cortex-600/20 text-cortex-400"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <span>{space.icon}</span>
                    <span className="flex-1 font-medium">{space.name}</span>
                    <code className="text-xs text-gray-500">{space.id}</code>
                  </button>
                ))}
              </div>

              <div className="border-t border-white/10 p-3 bg-white/5">
                <p className="text-xs text-gray-400">
                  Switch memory spaces to demonstrate multi-tenant isolation.
                  Memories in one space don't appear in others.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

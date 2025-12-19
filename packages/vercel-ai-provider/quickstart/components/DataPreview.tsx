'use client';

interface DataPreviewProps {
  data: {
    id?: string;
    preview?: string;
    metadata?: Record<string, unknown>;
  };
}

export function DataPreview({ data }: DataPreviewProps) {
  return (
    <div className="space-y-2 text-sm">
      {/* ID */}
      {data.id && (
        <div className="flex items-center gap-2">
          <span className="text-gray-500">ID:</span>
          <code className="px-1.5 py-0.5 bg-black/30 rounded text-xs font-mono text-cortex-400">
            {data.id}
          </code>
        </div>
      )}

      {/* Preview */}
      {data.preview && (
        <div className="mt-2">
          <span className="text-gray-500 text-xs">Data:</span>
          <pre className="mt-1 p-2 bg-black/30 rounded text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
            {data.preview}
          </pre>
        </div>
      )}

      {/* Metadata */}
      {data.metadata && Object.keys(data.metadata).length > 0 && (
        <div className="mt-2">
          <span className="text-gray-500 text-xs">Metadata:</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {Object.entries(data.metadata).map(([key, value]) => (
              <span
                key={key}
                className="px-1.5 py-0.5 bg-white/5 rounded text-xs"
              >
                <span className="text-gray-500">{key}:</span>{' '}
                <span className="text-gray-300">
                  {typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { didToHttpsUrl } from '../lib/operations/didResolverLocal';
import { FileCode, ExternalLink, RefreshCw, AlertCircle, Info } from 'lucide-react';

interface DIDLogFileViewProps {
  did: string;
}

export default function DIDLogFileView({ did }: DIDLogFileViewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    fetchLogFile();
  }, [did]);

  const fetchLogFile = async () => {
    setLoading(true);
    setError(null);
    try {
      const logUrl = didToHttpsUrl(did);
      setUrl(logUrl);
      
      const response = await fetch(logUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const text = await response.text();
      // format JSONL for better readability: one JSON object per line
      const formatted = text.split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.stringify(JSON.parse(line), null, 2);
          } catch {
            return line;
          }
        })
        .join('\n\n---\n\n');
      
      setContent(formatted);
    } catch (err: any) {
      const logUrl = didToHttpsUrl(did);
      setError(`${err.message || 'An error occurred'} while fetching from: ${logUrl}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-900">did.jsonl</h3>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchLogFile}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Raw URL <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-md p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">About this file</p>
          <p>
            This is the append-only log file (`did.jsonl`) that contains the entire history of this DID. 
            Each line is a cryptographically signed version of the DID document, linked together in a hash chain.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 border-dashed">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-500">Fetching DID log...</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-8 bg-amber-50 rounded-lg border border-amber-200 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500" />
          <div>
            <p className="font-semibold text-amber-900">Resource Status</p>
            <p className="text-sm text-amber-800 mt-1 max-w-md">{error}</p>
          </div>
        </div>
      ) : (
        <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed max-h-[500px] shadow-inner">
          <code>{content}</code>
        </pre>
      )}
    </div>
  );
}

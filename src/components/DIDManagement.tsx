import { useState } from 'react';
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  ArrowRightLeft, 
  UserCircle,
  AlertCircle,
  CheckCircle,
  FileText
} from 'lucide-react';
import {
  createDID,
  readDID as readDIDOperation,
  updateDID,
  deactivateDID,
  transferOwnership,
  transferCustody
} from '../lib/didOperations';

export default function DIDManagement() {
  const [activeTab, setActiveTab] = useState<'create' | 'read' | 'update' | 'transfer' | 'deactivate'>('create');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // CREATE form state
  const [createForm, setCreateForm] = useState({
    owner: 'did:webvh:example.com:manufacturer123',
    productType: 'main' as 'main' | 'component',
    model: '',
    metadata: '',
  });

  // READ form state
  const [readDID, setReadDID] = useState('');

  // UPDATE form state
  const [updateForm, setUpdateForm] = useState({
    did: '',
    custodian: '',
    lifecycleStatus: 'active' as 'active' | 'installed' | 'maintenance' | 'disposed',
    metadata: '',
  });

  // TRANSFER form state
  const [transferForm, setTransferForm] = useState({
    did: '',
    newOwner: '',
    transferredBy: '',
    isOwnership: true,
  });

  // DEACTIVATE form state
  const [deactivateForm, setDeactivateForm] = useState({
    did: '',
    reason: '',
  });

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      let metadata = {};
      if (createForm.metadata) {
        metadata = JSON.parse(createForm.metadata);
      }

      const result = await createDID({
        owner: createForm.owner,
        productType: createForm.productType,
        model: createForm.model,
        metadata,
      });

      setResult(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRead = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const result = await readDIDOperation(readDID);
      if (!result) {
        setError('DID not found');
      } else {
        setResult(result);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      let metadata = {};
      if (updateForm.metadata) {
        metadata = JSON.parse(updateForm.metadata);
      }

      const result = await updateDID(updateForm.did, {
        custodian: updateForm.custodian || undefined,
        lifecycleStatus: updateForm.lifecycleStatus,
        metadata,
      });

      if (!result) {
        setError('DID not found');
      } else {
        setResult(result);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const result = transferForm.isOwnership
        ? await transferOwnership(transferForm.did, transferForm.newOwner, transferForm.transferredBy)
        : await transferCustody(transferForm.did, transferForm.newOwner, transferForm.transferredBy);

      if (!result.success) {
        setError('Transfer failed');
      } else {
        setResult(result);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const result = await deactivateDID(deactivateForm.did, deactivateForm.reason);

      if (!result.success) {
        setError('Deactivation failed');
      } else {
        setResult(result);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">DID:webvh Operations</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'create'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
        <button
          onClick={() => setActiveTab('read')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'read'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          Read
        </button>
        <button
          onClick={() => setActiveTab('update')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'update'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Edit className="w-4 h-4" />
          Update
        </button>
        <button
          onClick={() => setActiveTab('transfer')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'transfer'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Transfer
        </button>
        <button
          onClick={() => setActiveTab('deactivate')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'deactivate'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          Deactivate
        </button>
      </div>

      {/* CREATE Tab */}
      {activeTab === 'create' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner DID</label>
            <input
              type="text"
              value={createForm.owner}
              onChange={(e) => setCreateForm({ ...createForm, owner: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="did:webvh:example.com:manufacturer123"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
            <select
              value={createForm.productType}
              onChange={(e) => setCreateForm({ ...createForm, productType: e.target.value as 'main' | 'component' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="main">Main Product</option>
              <option value="component">Component</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input
              type="text"
              value={createForm.model}
              onChange={(e) => setCreateForm({ ...createForm, model: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Window-Pro-2000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Metadata (JSON)
            </label>
            <textarea
              value={createForm.metadata}
              onChange={(e) => setCreateForm({ ...createForm, metadata: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              rows={4}
              placeholder='{"dimensions": {"width": 1000, "height": 1200}, "material": "Aluminum"}'
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !createForm.model}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create DID
          </button>
        </div>
      )}

      {/* READ Tab */}
      {activeTab === 'read' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DID to Read</label>
            <input
              type="text"
              value={readDID}
              onChange={(e) => setReadDID(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="did:webvh:example.com:main-..."
            />
          </div>

          <button
            onClick={handleRead}
            disabled={loading || !readDID}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Read DID
          </button>
        </div>
      )}

      {/* UPDATE Tab */}
      {activeTab === 'update' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DID to Update</label>
            <input
              type="text"
              value={updateForm.did}
              onChange={(e) => setUpdateForm({ ...updateForm, did: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="did:webvh:example.com:main-..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custodian DID (optional)</label>
            <input
              type="text"
              value={updateForm.custodian}
              onChange={(e) => setUpdateForm({ ...updateForm, custodian: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="did:webvh:example.com:installer456"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lifecycle Status</label>
            <select
              value={updateForm.lifecycleStatus}
              onChange={(e) => setUpdateForm({ ...updateForm, lifecycleStatus: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="installed">Installed</option>
              <option value="maintenance">Maintenance</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Metadata (JSON)
            </label>
            <textarea
              value={updateForm.metadata}
              onChange={(e) => setUpdateForm({ ...updateForm, metadata: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              rows={4}
              placeholder='{"location": "Building A", "floor": 3}'
            />
          </div>

          <button
            onClick={handleUpdate}
            disabled={loading || !updateForm.did}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Update DID
          </button>
        </div>
      )}

      {/* TRANSFER Tab */}
      {activeTab === 'transfer' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTransferForm({ ...transferForm, isOwnership: true })}
              className={`flex-1 px-4 py-2 rounded-lg border-2 ${
                transferForm.isOwnership
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              <UserCircle className="w-4 h-4 mx-auto mb-1" />
              Transfer Ownership
            </button>
            <button
              onClick={() => setTransferForm({ ...transferForm, isOwnership: false })}
              className={`flex-1 px-4 py-2 rounded-lg border-2 ${
                !transferForm.isOwnership
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4 mx-auto mb-1" />
              Transfer Custody
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DID to Transfer</label>
            <input
              type="text"
              value={transferForm.did}
              onChange={(e) => setTransferForm({ ...transferForm, did: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="did:webvh:example.com:main-..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New {transferForm.isOwnership ? 'Owner' : 'Custodian'} DID
            </label>
            <input
              type="text"
              value={transferForm.newOwner}
              onChange={(e) => setTransferForm({ ...transferForm, newOwner: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="did:webvh:example.com:newowner789"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transferred By (DID)</label>
            <input
              type="text"
              value={transferForm.transferredBy}
              onChange={(e) => setTransferForm({ ...transferForm, transferredBy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="did:webvh:example.com:currentowner"
            />
          </div>

          <button
            onClick={handleTransfer}
            disabled={loading || !transferForm.did || !transferForm.newOwner || !transferForm.transferredBy}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transfer {transferForm.isOwnership ? 'Ownership' : 'Custody'}
          </button>
        </div>
      )}

      {/* DEACTIVATE Tab */}
      {activeTab === 'deactivate' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="text-sm text-red-800">
              <strong>Warning:</strong> Deactivating a DID marks it as end-of-life. This action should only be performed when the product is being disposed or recycled.
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DID to Deactivate</label>
            <input
              type="text"
              value={deactivateForm.did}
              onChange={(e) => setDeactivateForm({ ...deactivateForm, did: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              placeholder="did:webvh:example.com:main-..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Deactivation</label>
            <textarea
              value={deactivateForm.reason}
              onChange={(e) => setDeactivateForm({ ...deactivateForm, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              rows={3}
              placeholder="Product end-of-life, recycling initiated..."
            />
          </div>

          <button
            onClick={handleDeactivate}
            disabled={loading || !deactivateForm.did}
            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Deactivate DID
          </button>
        </div>
      )}

      {/* Results */}
      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <strong className="text-green-800">Success!</strong>
          </div>
          <pre className="text-xs text-gray-800 overflow-auto bg-white p-3 rounded border border-green-200 mt-2">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

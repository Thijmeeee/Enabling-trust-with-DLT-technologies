import { localDB } from '../data/localData';

export class DPPWatcher {
  private watcherId: string | null = null;

  async initialize(name: string, type: string, monitoredDids: string[]) {
    const watcher = await localDB.insertWatcher({
      name,
      watcher_type: type,
      monitored_dids: monitoredDids,
      config: {},
      active: true,
      last_check: null,
    });
    this.watcherId = watcher.id;
    return this;
  }

  async checkHierarchy() {
    if (!this.watcherId) return;
    
    const dpps = await localDB.getDPPs();
    for (const dpp of dpps) {
      if (dpp.type === 'component' && !dpp.parent_did) {
        await localDB.insertAlert({
          watcher_id: this.watcherId,
          dpp_id: dpp.id,
          did: dpp.did,
          alert_type: 'orphan',
          severity: 'warning',
          message: 'Component DPP without parent detected',
          details: { dpp_id: dpp.id },
          resolved: false,
        });
      }
    }
  }
}

export async function createWitnessAttestation(
  dppId: string,
  did: string,
  witnessDid: string,
  attestationType: string,
  attestationData: Record<string, unknown>
) {
  return localDB.insertAttestation({
    dpp_id: dppId,
    did,
    witness_did: witnessDid,
    attestation_type: attestationType,
    attestation_data: attestationData,
    signature: `sig_${Date.now()}`,
  });
}

export async function runWatchers() {
  const watchers = await localDB.getWatchers();
  
  for (const watcher of watchers.filter(w => w.active)) {
    if (watcher.watcher_type === 'hierarchy') {
      await checkHierarchyIntegrity(watcher.id, watcher.monitored_dids);
    } else if (watcher.watcher_type === 'integrity') {
      await checkDataIntegrity(watcher.id, watcher.monitored_dids);
    }
  }
}

async function checkHierarchyIntegrity(watcherId: string, dids: string[]) {
  for (const did of dids) {
    const dpp = await localDB.getDPPByDID(did);
    if (!dpp) continue;

    if (dpp.type === 'component' && !dpp.parent_did) {
      await localDB.insertAlert({
        watcher_id: watcherId,
        dpp_id: dpp.id,
        did: dpp.did,
        alert_type: 'orphan',
        severity: 'warning',
        message: 'Component DPP has no parent',
        details: { dpp_id: dpp.id },
        resolved: false,
      });
    }
  }
}

async function checkDataIntegrity(watcherId: string, dids: string[]) {
  for (const did of dids) {
    const dpp = await localDB.getDPPByDID(did);
    if (!dpp) {
      await localDB.insertAlert({
        watcher_id: watcherId,
        dpp_id: null,
        did,
        alert_type: 'missing',
        severity: 'critical',
        message: 'DPP not found',
        details: { did },
        resolved: false,
      });
    }
  }
}

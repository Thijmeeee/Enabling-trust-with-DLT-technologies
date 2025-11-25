/**
 * Bulk Operations and Test Data Generator
 */

import { enhancedDB } from './enhancedDataStore';
import { PRODUCT_SCHEMAS } from './schemas/productSchema';
import { 
  generateWitnessAttestations, 
  generateAnchoringEvents,
  generateDefaultLifecycleEvents 
} from './lifecycleHelpers';

type BulkDPPInput = {
  productType: string;
  count: number;
  generateComponents?: boolean;
  customMetadata?: Record<string, any>;
};

/**
 * Generate bulk test data for any product type
 */
export async function generateBulkTestData(input: BulkDPPInput): Promise<void> {
  const schema = PRODUCT_SCHEMAS[input.productType];
  if (!schema) {
    throw new Error(`Unknown product type: ${input.productType}`);
  }
  
  const baseTimestamp = Date.now();
  
  for (let i = 0; i < input.count; i++) {
    const uniqueId = `${baseTimestamp + i}-${Math.random().toString(36).substr(2, 9)}`;
    const did = `did:webvh:example.com:products:${input.productType}-${uniqueId}`;
    
    // Generate metadata from schema
    const metadata: Record<string, any> = {
      productType: input.productType,
      ...input.customMetadata,
    };
    
    // Add image URLs for different product types
    const baseUrl = import.meta.env.BASE_URL || '/';
    if (input.productType === 'window') {
      metadata.image_url = `${baseUrl}images/window.png`;
    } else if (input.productType === 'glass') {
      metadata.image_url = `${baseUrl}images/glass.png`;
    } else if (input.productType === 'frame') {
      metadata.image_url = `${baseUrl}images/frame.png`;
    }
    
    for (const prop of schema.properties) {
      if (prop.key in metadata) continue;
      
      switch (prop.type) {
        case 'string':
          if (prop.validation?.enum) {
            metadata[prop.key] = prop.validation.enum[i % prop.validation.enum.length];
          } else {
            metadata[prop.key] = `${prop.label}-${i + 1}`;
          }
          break;
        case 'number':
          metadata[prop.key] = (prop.validation?.min || 10) + (i % 100);
          break;
        case 'boolean':
          metadata[prop.key] = i % 2 === 0;
          break;
        case 'date':
          metadata[prop.key] = new Date(Date.now() - i * 86400000).toISOString();
          break;
        case 'object':
          if (prop.key === 'dimensions') {
            metadata[prop.key] = {
              width: 1000 + i * 100,
              height: 1200 + i * 100,
              unit: 'mm',
            };
          } else {
            metadata[prop.key] = {};
          }
          break;
      }
    }
    
    // Create components if needed
    const componentDids: string[] = [];
    if (input.generateComponents && schema.componentSlots.length > 0) {
      for (const slot of schema.componentSlots) {
        if (!slot.required && Math.random() > 0.7) continue;
        
        const allowedType = slot.allowedTypes?.[0];
        if (!allowedType) continue;
        
        const compSchema = PRODUCT_SCHEMAS[allowedType];
        if (!compSchema) continue;
        
        for (let j = 0; j < slot.minQuantity; j++) {
          const compDid = `did:webvh:example.com:products:${allowedType}-${uniqueId}-${j}`;
          const compMetadata: Record<string, any> = { productType: allowedType };
          
          // Add image URLs for component types
          const baseUrl = import.meta.env.BASE_URL || '/';
          if (allowedType === 'glass') {
            compMetadata.image_url = `${baseUrl}images/glass.png`;
          } else if (allowedType === 'frame') {
            compMetadata.image_url = `${baseUrl}images/frame.png`;
          }
          
          for (const prop of compSchema.properties) {
            switch (prop.type) {
              case 'string':
                if (prop.validation?.enum) {
                  compMetadata[prop.key] = prop.validation.enum[j % prop.validation.enum.length];
                } else {
                  compMetadata[prop.key] = `${prop.label}-${i}-${j}`;
                }
                break;
              case 'number':
                compMetadata[prop.key] = (prop.validation?.min || 5) + (j % 50);
                break;
              case 'boolean':
                compMetadata[prop.key] = j % 2 === 0;
                break;
              case 'date':
                compMetadata[prop.key] = new Date(Date.now() - (i + j) * 86400000).toISOString();
                break;
            }
          }
          
          const compDpp = await enhancedDB.insertDPP({
            did: compDid,
            type: 'component',
            model: `${compSchema.name}-${i + 1}-${j + 1}`,
            parent_did: did,
            lifecycle_status: 'active',
            owner: `did:webvh:example.com:organizations:${allowedType}-supplier`,
            custodian: `did:webvh:example.com:organizations:${input.productType}-manufacturer`,
            metadata: compMetadata,
            version: 1,
            previous_version_id: null,
          });
          
          componentDids.push(compDid);
          
          // Create DID document for component
          await enhancedDB.insertDIDDocument({
            dpp_id: compDpp.id,
            did: compDid,
            controller: compDpp.owner,
            verification_method: [
              {
                id: `${compDid}#key-1`,
                type: 'Ed25519VerificationKey2020',
                controller: compDpp.owner,
                publicKeyMultibase: `z6Mk${Math.random().toString(36).substring(2, 15)}`,
              },
            ],
            service_endpoints: [
              {
                id: `${compDid}#dpp-service`,
                type: 'DPPService',
                serviceEndpoint: `https://example.com/dpp/${compDid.split(':').pop()}`,
              },
            ],
            proof: { 
              type: 'Ed25519Signature2020',
              created: new Date(Date.now() - i * 86400000).toISOString(),
            },
            document_metadata: { bulk: true, productType: allowedType },
          });
          
          // Create relationship
          await enhancedDB.insertRelationship({
            parent_did: did,
            child_did: compDid,
            relationship_type: 'component',
            position: j + 1,
            metadata: { role: slot.type, quantity: 1 },
          });
          
          // Generate attestations
          await generateWitnessAttestations(compDpp.id, compDid, 'component');
          
          // Generate default lifecycle events for component
          await generateDefaultLifecycleEvents(compDpp.id, compDid, 'component', 0);
          
          // Generate anchoring
          await generateAnchoringEvents(compDpp.id, compDid);
        }
      }
    }
    
    // Create main DPP
    const mainDpp = await enhancedDB.insertDPP({
      did,
      type: schema.category === 'main' ? 'main' : 'component',
      model: `${schema.name}-${i + 1}`,
      parent_did: null,
      lifecycle_status: 'active',
      owner: `did:webvh:example.com:organizations:${input.productType}-manufacturer`,
      custodian: null,
      metadata,
      version: 1,
      previous_version_id: null,
    });
    
    // Create DID document
    await enhancedDB.insertDIDDocument({
      dpp_id: mainDpp.id,
      did,
      controller: mainDpp.owner,
      verification_method: [
        {
          id: `${did}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: mainDpp.owner,
          publicKeyMultibase: `z6Mk${Math.random().toString(36).substring(2, 15)}`,
        },
      ],
      service_endpoints: [
        {
          id: `${did}#dpp-service`,
          type: 'DPPService',
          serviceEndpoint: `https://example.com/dpp/${did.split(':').pop()}`,
        },
      ],
      proof: { 
        type: 'Ed25519Signature2020',
        created: new Date().toISOString(),
      },
      document_metadata: { bulk: true, productType: input.productType },
    });
    
    // Generate attestations
    await generateWitnessAttestations(mainDpp.id, did, mainDpp.type);
    
    // Generate anchoring with component hashes
    await generateAnchoringEvents(mainDpp.id, did, componentDids);
    
    // Generate default lifecycle events
    await generateDefaultLifecycleEvents(mainDpp.id, did, mainDpp.type, componentDids.length);
    
    // Generate credentials based on schema
    for (const credDef of schema.credentials.filter(c => c.required)) {
      const credData: Record<string, any> = {};
      for (const prop of credDef.properties.filter(p => p.required)) {
        switch (prop.type) {
          case 'string':
            credData[prop.key] = `${prop.label}-${i}`;
            break;
          case 'number':
            credData[prop.key] = 10 + (i % 90);
            break;
          case 'object':
            credData[prop.key] = { value: 10 + i, unit: 'standard' };
            break;
        }
      }
      
      await enhancedDB.insertCredential({
        dpp_id: mainDpp.id,
        credential_id: `urn:uuid:${uniqueId}-${credDef.type}`,
        issuer: `did:webvh:example.com:organizations:${credDef.issuerTypes[0]}`,
        credential_type: credDef.type,
        credential_data: credData,
        issued_date: new Date(Date.now() - i * 86400000).toISOString(),
        expiry_date: credDef.expiryDays 
          ? new Date(Date.now() + credDef.expiryDays * 86400000).toISOString() 
          : null,
        verification_status: 'valid',
      });
    }
  }
}

/**
 * Export DPPs to JSON
 */
export async function exportDPPsToJSON(dppIds: string[]): Promise<string> {
  const exportData: any[] = [];
  
  for (const id of dppIds) {
    const dpp = await enhancedDB.getDPPById(id);
    if (!dpp) continue;
    
    const didDoc = await enhancedDB.getDIDDocumentByDID(dpp.did);
    const relationships = await enhancedDB.getRelationshipsByParent(dpp.did);
    const credentials = await enhancedDB.getCredentialsByDPPId(id);
    const attestations = await enhancedDB.getAttestationsByDID(dpp.did);
    const anchoringEvents = await enhancedDB.getAnchoringEventsByDID(dpp.did);
    const specifications = await enhancedDB.getSpecificationsByDPPId(id);
    
    exportData.push({
      dpp,
      didDocument: didDoc,
      relationships,
      credentials,
      attestations,
      anchoringEvents,
      specifications,
    });
  }
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Export hierarchy to JSON (including all children)
 */
export async function exportHierarchyToJSON(rootDid: string): Promise<string> {
  const hierarchy = await enhancedDB.getFullHierarchy(rootDid);
  
  const collectDPPIds = (node: any): string[] => {
    const ids = [node.dpp.id];
    if (node.children) {
      for (const child of node.children) {
        ids.push(...collectDPPIds(child));
      }
    }
    return ids;
  };
  
  const allIds = collectDPPIds(hierarchy);
  return await exportDPPsToJSON(allIds);
}

/**
 * Import DPPs from JSON
 */
export async function importDPPsFromJSON(jsonData: string): Promise<{ success: number; errors: string[] }> {
  const errors: string[] = [];
  let success = 0;
  
  try {
    const data = JSON.parse(jsonData);
    const items = Array.isArray(data) ? data : [data];
    
    for (const item of items) {
      try {
        if (item.dpp) {
          const { id, created_at, updated_at, ...dppData } = item.dpp;
          await enhancedDB.insertDPP(dppData);
        }
        
        if (item.didDocument) {
          const { id, created_at, updated_at, ...didData } = item.didDocument;
          await enhancedDB.insertDIDDocument(didData);
        }
        
        if (item.relationships) {
          for (const rel of item.relationships) {
            const { id, created_at, updated_at, ...relData } = rel;
            await enhancedDB.insertRelationship(relData);
          }
        }
        
        if (item.credentials) {
          for (const cred of item.credentials) {
            const { id, created_at, ...credData } = cred;
            await enhancedDB.insertCredential(credData);
          }
        }
        
        if (item.attestations) {
          for (const att of item.attestations) {
            const { id, timestamp, created_at, ...attData } = att;
            await enhancedDB.insertAttestation(attData);
          }
        }
        
        if (item.anchoringEvents) {
          for (const event of item.anchoringEvents) {
            const { id, timestamp, ...eventData } = event;
            await enhancedDB.insertAnchoringEvent(eventData);
          }
        }
        
        if (item.specifications) {
          for (const spec of item.specifications) {
            const { id, created_at, updated_at, ...specData } = spec;
            await enhancedDB.insertSpecification(specData);
          }
        }
        
        success++;
      } catch (error) {
        errors.push(`Failed to import item: ${error}`);
      }
    }
  } catch (error) {
    errors.push(`JSON parse error: ${error}`);
  }
  
  return { success, errors };
}

/**
 * Generate mixed product types for testing
 */
export async function generateMixedTestData(): Promise<void> {
  console.log('Generating mixed test data...');
  
  // Windows with full components
  await generateBulkTestData({
    productType: 'window',
    count: 50,
    generateComponents: true,
  });
  
  // Standalone glass panels
  await generateBulkTestData({
    productType: 'glass',
    count: 20,
    generateComponents: false,
  });
  
  // Standalone frames
  await generateBulkTestData({
    productType: 'frame',
    count: 20,
    generateComponents: false,
  });
  
  console.log('Mixed test data generated!');
}

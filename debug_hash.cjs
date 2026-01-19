const crypto = require('crypto');

const line1 = '{"versionId":"1","versionTime":"2026-01-15T16:41:39.734Z","parameters":{"method":"did:webvh:1.0","scid":"z-demo-window-003","updateKeys":["z6Mk4775d0bf4a3192d3e69cac0188dc215612c9e70d8c8"]},"state":{"@context":["https://www.w3.org/ns/did/v1","https://w3id.org/security/multikey/v1"],"id":"did:webvh:localhost:3000:z-demo-window-003","verificationMethod":[{"id":"did:webvh:localhost:3000:z-demo-window-003#key-1","controller":"did:webvh:localhost:3000:z-demo-window-003","type":"Multikey","publicKeyMultibase":"z6Mk9d21e4df3bbb0845365231ca7900a1e3cf0d5b17c71"}],"authentication":["did:webvh:localhost:3000:z-demo-window-003#key-1"],"assertionMethod":["did:webvh:localhost:3000:z-demo-window-003#key-1"],"service":[{"id":"did:webvh:localhost:3000:z-demo-window-003#domain","type":"LinkedDomains","serviceEndpoint":"https://localhost:3000"}]},"proof":[{"type":"DataIntegrityProof","cryptosuite":"eddsa-jcs-2022","verificationMethod":"did:webvh:localhost:3000:z-demo-window-003#key-1","proofPurpose":"assertionMethod","created":"2026-01-15T16:41:39.734Z","proofValue":"zgQ7H-c4MMbNayKHIXIP-0ZRROsbaC_x6bH4LtsMV2BpjpaDZjaAbDg6uVV-10bSC_sG_goTc96JOUkmwWqWzKw"},{"type":"MerkleProof2019","proofPurpose":"witness","merkleRoot":"0xb88d2b5aed595c154f31b6c8f4c7138e024cb8f2085bbe3b778c8b277d90bc36","path":["0xd94118b1bbe003cde2f54987b2c1a267569f556968e8774aa8faa91f734ef1f1","0x8eb00e284a7c3b80dd5f21c7a387ac733af0a2618845423845216f75f2930116"],"anchor":{"type":"EthereumSepolia","contract":"0x1234...Placeholder","block":5432100}}]}';
const entry = JSON.parse(line1);

// Filter proof as frontend does
if (entry.proof) {
  entry.proof = entry.proof.filter(p => p.proofPurpose !== 'witness');
}

const hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
console.log('Hashed Result:', hash);
console.log('Expected:', '5f6ff6bc1a4db2d04a4b4d1f49a92159d10225d1e8e703a586ecf2aa23cad731');

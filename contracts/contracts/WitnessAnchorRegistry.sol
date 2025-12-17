// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WitnessAnchorRegistry
 * @notice Stores Merkle roots of batched DPP events for immutable verification
 * @dev Each batch contains multiple events hashed into a Merkle tree
 */
contract WitnessAnchorRegistry {
    /// @notice Counter for batch IDs (auto-incrementing)
    uint256 public batchCount;
    
    /// @notice Mapping from batchId to Merkle root
    mapping(uint256 => bytes32) public roots;
    
    /// @notice Mapping from batchId to block timestamp
    mapping(uint256 => uint256) public timestamps;
    
    /// @notice Mapping from batchId to block number (for Etherscan links)
    mapping(uint256 => uint256) public blockNumbers;

    /// @notice Emitted when a new batch is anchored
    event Anchored(
        uint256 indexed batchId, 
        bytes32 indexed root, 
        uint256 timestamp,
        uint256 blockNumber
    );

    /**
     * @notice Anchor a Merkle root to the blockchain
     * @param merkleRoot The root hash of the Merkle tree containing event hashes
     * @return batchId The ID assigned to this batch
     */
    function anchor(bytes32 merkleRoot) external returns (uint256 batchId) {
        batchId = batchCount++;
        roots[batchId] = merkleRoot;
        timestamps[batchId] = block.timestamp;
        blockNumbers[batchId] = block.number;
        
        emit Anchored(batchId, merkleRoot, block.timestamp, block.number);
    }

    /**
     * @notice Verify that a given root matches the stored root for a batch
     * @param batchId The batch to check
     * @param expectedRoot The root to compare against
     * @return bool True if roots match
     */
    function verify(uint256 batchId, bytes32 expectedRoot) external view returns (bool) {
        return roots[batchId] == expectedRoot;
    }
    
    /**
     * @notice Get full batch details
     * @param batchId The batch to query
     * @return root The Merkle root
     * @return timestamp When the batch was anchored
     * @return blockNum The block number
     */
    function getBatch(uint256 batchId) external view returns (
        bytes32 root,
        uint256 timestamp,
        uint256 blockNum
    ) {
        return (roots[batchId], timestamps[batchId], blockNumbers[batchId]);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WitnessAnchorRegistry
 * @notice Stores Merkle roots of batched DPP events for immutable verification
 * @dev Each batch contains multiple events hashed into a Merkle tree
 *      Only authorized witnesses can anchor new batches
 */
contract WitnessAnchorRegistry {
    /// @notice Contract owner (deployer)
    address public owner;
    
    /// @notice Mapping of authorized witness addresses
    mapping(address => bool) public authorizedWitnesses;
    
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
    
    /// @notice Emitted when a witness is added
    event WitnessAdded(address indexed witness);
    
    /// @notice Emitted when a witness is removed
    event WitnessRemoved(address indexed witness);

    /// @notice Only owner can call this function
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    /// @notice Only authorized witnesses can call this function
    modifier onlyWitness() {
        require(authorizedWitnesses[msg.sender], "Not an authorized witness");
        _;
    }
    
    /// @notice Constructor sets deployer as owner and first authorized witness
    constructor() {
        owner = msg.sender;
        authorizedWitnesses[msg.sender] = true;
        emit WitnessAdded(msg.sender);
    }
    
    /**
     * @notice Add a new authorized witness
     * @param witness The address to authorize as witness
     */
    function addWitness(address witness) external onlyOwner {
        require(witness != address(0), "Invalid witness address");
        require(!authorizedWitnesses[witness], "Already a witness");
        authorizedWitnesses[witness] = true;
        emit WitnessAdded(witness);
    }
    
    /**
     * @notice Remove an authorized witness
     * @param witness The address to remove from witnesses
     */
    function removeWitness(address witness) external onlyOwner {
        require(authorizedWitnesses[witness], "Not a witness");
        authorizedWitnesses[witness] = false;
        emit WitnessRemoved(witness);
    }
    
    /**
     * @notice Check if an address is an authorized witness
     * @param witness The address to check
     * @return bool True if the address is a witness
     */
    function isWitness(address witness) external view returns (bool) {
        return authorizedWitnesses[witness];
    }

    /**
     * @notice Anchor a Merkle root to the blockchain
     * @dev Only authorized witnesses can call this function
     * @param merkleRoot The root hash of the Merkle tree containing event hashes
     * @return batchId The ID assigned to this batch
     */
    function anchor(bytes32 merkleRoot) external onlyWitness returns (uint256 batchId) {
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

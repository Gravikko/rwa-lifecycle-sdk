// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestRWA
 * @notice Simple ERC-721 token for testing RWA Lifecycle SDK
 * @dev This is a minimal implementation for demonstration purposes
 */
contract TestRWA is ERC721, Ownable {
    uint256 private _nextTokenId;

    /// @notice Emitted when a new RWA token is minted
    event RWAMinted(uint256 indexed tokenId, address indexed to, string metadataURI);

    constructor() ERC721("Test Real World Asset", "tRWA") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    /**
     * @notice Mint a new RWA token
     * @param to Address to mint the token to
     * @return tokenId The ID of the minted token
     */
    function mint(address to) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        emit RWAMinted(tokenId, to, "");
        return tokenId;
    }

    /**
     * @notice Mint a new RWA token with metadata
     * @param to Address to mint the token to
     * @param metadataURI URI pointing to token metadata (IPFS, EigenDA, etc.)
     * @return tokenId The ID of the minted token
     */
    function mintWithMetadata(address to, string calldata metadataURI) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        emit RWAMinted(tokenId, to, metadataURI);
        return tokenId;
    }

    /**
     * @notice Get the next token ID that will be minted
     * @return The next token ID
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}

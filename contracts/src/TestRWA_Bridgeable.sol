// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IOptimismMintableERC721.sol";

/**
 * @title TestRWA_Bridgeable
 * @notice Bridgeable ERC-721 token for testing RWA Lifecycle SDK on L1
 * @dev Implements IOptimismMintableERC721 for Mantle bridge compatibility
 */
contract TestRWA_Bridgeable is ERC721Enumerable, Ownable, IOptimismMintableERC721 {
    uint256 private _nextTokenId;

    /// @notice Address of the bridge contract (L1ERC721Bridge)
    address public immutable BRIDGE;

    /// @notice Address of the remote token on L2
    address public immutable REMOTE_TOKEN;

    /// @notice Chain ID of the remote chain
    uint256 public immutable REMOTE_CHAIN_ID;

    /// @notice Emitted when a new RWA token is minted
    event RWAMinted(uint256 indexed tokenId, address indexed to, string metadataURI);

    /**
     * @param _bridge Address of the L1ERC721Bridge contract
     * @param _remoteToken Address of the L2 token (can be zero address initially)
     * @param _remoteChainId Chain ID of the remote chain (5003 for Mantle Sepolia, 5000 for Mantle mainnet)
     */
    constructor(
        address _bridge,
        address _remoteToken,
        uint256 _remoteChainId
    ) ERC721("Test Real World Asset", "tRWA") Ownable(msg.sender) {
        require(_bridge != address(0), "Bridge address cannot be zero");
        BRIDGE = _bridge;
        REMOTE_TOKEN = _remoteToken;
        REMOTE_CHAIN_ID = _remoteChainId;
        _nextTokenId = 1;
    }

    /**
     * @notice Mint a new RWA token (owner only)
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
     * @notice Mint a new RWA token with metadata (owner only)
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

    // ============================================
    // IOptimismMintableERC721 Implementation
    // ============================================

    /**
     * @notice Returns the chain ID of the remote chain
     * @return Chain ID where the remote token is deployed
     */
    function remoteChainId() external view override returns (uint256) {
        return REMOTE_CHAIN_ID;
    }

    /**
     * @notice Returns the address of the remote token on L2
     * @return Address of the L2 token
     */
    function remoteToken() external view override returns (address) {
        return REMOTE_TOKEN;
    }

    /**
     * @notice Returns the address of the bridge
     * @return Address of the L1ERC721Bridge
     */
    function bridge() external view override returns (address) {
        return BRIDGE;
    }

    /**
     * @notice Mints a token (only callable by bridge)
     * @dev This is called by the bridge when tokens are withdrawn from L2
     * @param _to Address to mint the token to
     * @param _tokenId Token ID to mint
     */
    function safeMint(address _to, uint256 _tokenId) external override {
        require(msg.sender == BRIDGE, "Only bridge can mint");
        _safeMint(_to, _tokenId);
        emit Mint(_to, _tokenId);
    }

    /**
     * @notice Burns a token (only callable by bridge)
     * @dev This is called by the bridge when tokens are deposited to L2
     * @param _from Address to burn the token from
     * @param _tokenId Token ID to burn
     */
    function burn(address _from, uint256 _tokenId) external override {
        require(msg.sender == BRIDGE, "Only bridge can burn");
        require(ownerOf(_tokenId) == _from, "Not token owner");
        _burn(_tokenId);
        emit Burn(_from, _tokenId);
    }

    /**
     * @notice Returns true if this contract implements the interface
     * @param interfaceId The interface identifier
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IOptimismMintableERC721).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}

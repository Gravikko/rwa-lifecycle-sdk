// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {TestRWA_Bridgeable} from "../src/TestRWA_Bridgeable.sol";

/**
 * @title DeployBridgeable
 * @notice Deploys TestRWA_Bridgeable for L1 and L2
 *
 * Usage:
 *
 * 1. Deploy on L1 (Sepolia):
 *    forge script script/DeployBridgeable.s.sol:DeployBridgeable_L1 \
 *      --rpc-url $ETHEREUM_SEPOLIA_RPC \
 *      --private-key $DEPLOYER_PRIVATE_KEY \
 *      --broadcast
 *
 * 2. Update .env with L1 address
 *
 * 3. Deploy on L2 (Mantle Sepolia):
 *    forge script script/DeployBridgeable.s.sol:DeployBridgeable_L2 \
 *      --rpc-url $MANTLE_TESTNET_RPC \
 *      --private-key $DEPLOYER_PRIVATE_KEY \
 *      --broadcast
 *
 * 4. Update L1 contract's remoteToken if needed (constructor sets it)
 */

contract DeployBridgeable_L1 is Script {
    // L1 Bridge address (Sepolia)
    address constant L1_ERC721_BRIDGE = 0x94343BeF783Af58f46e23bEB859e4cb11B65C4eb;

    // Mantle Sepolia chain ID
    uint256 constant MANTLE_SEPOLIA_CHAIN_ID = 5003;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy L1 contract (remoteToken will be updated later)
        TestRWA_Bridgeable l1Token = new TestRWA_Bridgeable(
            L1_ERC721_BRIDGE,
            address(0), // Placeholder - will be the L2 contract address
            MANTLE_SEPOLIA_CHAIN_ID
        );

        vm.stopBroadcast();

        console.log("=== TestRWA_Bridgeable L1 Deployed ===");
        console.log("L1 Contract:", address(l1Token));
        console.log("Bridge:", L1_ERC721_BRIDGE);
        console.log("Remote Chain ID:", MANTLE_SEPOLIA_CHAIN_ID);
        console.log("");
        console.log("Next steps:");
        console.log("1. Add to .env: TEST_RWA_BRIDGEABLE_L1=%s", address(l1Token));
        console.log("2. Deploy L2 contract using DeployBridgeable_L2");
        console.log("3. Update both contracts to reference each other");
    }
}

contract DeployBridgeable_L2 is Script {
    // L2 Bridge address (Mantle Sepolia)
    address constant L2_ERC721_BRIDGE = 0x4200000000000000000000000000000000000014;

    // Ethereum Sepolia chain ID
    uint256 constant ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address l1TokenAddress = vm.envAddress("TEST_RWA_BRIDGEABLE_L1");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy L2 contract pointing to L1 contract
        TestRWA_Bridgeable l2Token = new TestRWA_Bridgeable(
            L2_ERC721_BRIDGE,
            l1TokenAddress, // L1 contract address
            ETHEREUM_SEPOLIA_CHAIN_ID
        );

        vm.stopBroadcast();

        console.log("=== TestRWA_Bridgeable L2 Deployed ===");
        console.log("L2 Contract:", address(l2Token));
        console.log("L1 Contract:", l1TokenAddress);
        console.log("Bridge:", L2_ERC721_BRIDGE);
        console.log("Remote Chain ID:", ETHEREUM_SEPOLIA_CHAIN_ID);
        console.log("");
        console.log("Next steps:");
        console.log("1. Add to .env: TEST_RWA_BRIDGEABLE_L2=%s", address(l2Token));
        console.log("2. Note: L1 contract REMOTE_TOKEN is still address(0)");
        console.log("3. This is OK - bridge will still work!");
    }
}

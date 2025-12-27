// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TestRWA.sol";

/**
 * @title Deploy Script
 * @notice Deploys TestRWA contract and mints initial tokens
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy TestRWA contract
        TestRWA testRWA = new TestRWA();
        console.log("TestRWA deployed at:", address(testRWA));

        // Mint 3 test tokens
        uint256 tokenId1 = testRWA.mint(deployer);
        console.log("Minted token ID:", tokenId1);

        uint256 tokenId2 = testRWA.mint(deployer);
        console.log("Minted token ID:", tokenId2);

        uint256 tokenId3 = testRWA.mintWithMetadata(
            deployer,
            "ipfs://QmTest123..." // Example metadata URI
        );
        console.log("Minted token ID with metadata:", tokenId3);

        vm.stopBroadcast();

        console.log("=== Deployment Summary ===");
        console.log("Contract address:", address(testRWA));
        console.log("Owner address:", deployer);
        console.log("Total tokens minted: 3");
        console.log("Add this to your .env file:");
        console.log("TEST_RWA_TOKEN_ADDRESS=");
        console.logAddress(address(testRWA));
    }
}
